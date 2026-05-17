import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.PORT || 8787)
loadEnvFile()
loadWorkspaceKeys()

const DEEPSEEK_API_KEY =
  process.env.DEEPSEEK_API_KEY ||
  process.env.DEEP_SEEK_API_KEY ||
  process.env.BOOKROUTE_LLM_API_KEY ||
  ''
const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL ||
  process.env.BOOKROUTE_LLM_BASE_URL ||
  'https://api.deepseek.com'
const DEEPSEEK_MODEL =
  process.env.DEEPSEEK_MODEL || process.env.BOOKROUTE_LLM_MODEL || 'deepseek-chat'

const piracyTerms = [
  '盗版',
  '破解版',
  '网盘',
  '百度网盘',
  '阿里云盘',
  '夸克网盘',
  '提取码',
  '代下',
  '一元',
  '白嫖',
  '公众号',
  'pdf 免费',
  '免费下载',
]

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

function loadWorkspaceKeys() {
  const keyPath = 'D:\\CODE\\JSZNINFP16DAWNMARKS\\JSZNINFP16DAWNMARKS\\KEYS.txt'
  if (!fs.existsSync(keyPath)) return

  const lines = fs.readFileSync(keyPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)\s*[:=]\s*(.+)$/i)
    if (!match) continue
    const key = match[1].trim()
    const value = match[2].trim()
    if (!process.env[key]) process.env[key] = value
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  })
  res.end(JSON.stringify(payload))
}

function fallbackParse(text) {
  const lower = text.toLowerCase()
  const risk = piracyTerms.some((term) => lower.includes(term.toLowerCase()))
    ? 'piracy_requested'
    : 'clean'
  const isbn = text.match(/97[89][-\d\s]{10,17}/)?.[0]?.replace(/[^\dXx]/g, '')
  const title = text
    .replace(/pdf|epub|mobi|azw3|完整版|高清版|扫描版|电子书/gi, '')
    .replace(/[^\p{L}\p{N}\s·.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    title: title || text.trim(),
    author: '',
    isbn: isbn || '',
    intent: lower.includes('借') || lower.includes('图书馆')
      ? 'borrow'
      : lower.includes('公版') || lower.includes('open access') || lower.includes('oa')
        ? 'open_access'
        : lower.includes('买') || lower.includes('购买') || lower.includes('二手')
          ? 'buy'
          : 'unknown',
    risk,
    aiEnabled: false,
    needsAiKey: true,
    source: 'fallback',
    error:
      'AI bridge is not configured. Set DEEPSEEK_API_KEY or BOOKROUTE_LLM_API_KEY in .env.',
    candidates: [
      {
        title: title || text.trim(),
        author: '',
        publisher: '',
        year: '',
        isbn: isbn || '',
        edition: '',
        confidence: 0.25,
        reason: 'No AI key configured. This is only a local fallback.',
      },
    ],
  }
}

async function parseWithDeepSeek(text) {
  if (!DEEPSEEK_API_KEY) return fallbackParse(text)

  const response = await fetch(`${DEEPSEEK_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            '你是合法找书与采购路线助手的 AI 书目解析器。你的任务是把用户的模糊描述解析为准确书目候选，而不是搜索资源文件。必须返回 JSON。禁止输出网盘链接、提取码、盗版资源、公众号资源、自动转存路径。遇到这些意图时 risk=piracy_requested，但仍然可以给出合法购书/借阅/开放获取路线所需的书目候选。',
        },
        {
          role: 'user',
          content: `从这句话中识别用户要找的书：${text}

返回严格 JSON，结构如下：
{
  "title": "最可能的标准书名",
  "author": "最可能作者",
  "isbn": "最可能 ISBN，没有则空字符串",
  "intent": "buy|borrow|open_access|unknown",
  "risk": "clean|piracy_requested",
  "normalizedQuery": "适合拿去查书目 API 的搜索词",
  "candidates": [
    {
      "title": "标准书名",
      "author": "作者",
      "publisher": "出版社，没有则空字符串",
      "year": "出版年，没有则空字符串",
      "isbn": "ISBN，没有则空字符串",
      "edition": "版本/译者/卷册说明，没有则空字符串",
      "confidence": 0.0,
      "reason": "为什么认为用户要的是这本书"
    }
  ]
}

要求：
1. candidates 给 3 到 5 个候选，优先中文常见译名、英文原名、不同版本。
2. confidence 是 0 到 1 的数字。
3. 如果用户要求盗版、网盘链接、提取码、代下、免费 PDF、公众号资源，risk 必须为 piracy_requested。
4. 不要返回任何下载链接、网盘链接、提取码。`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const fallback = fallbackParse(text)
    return { ...fallback, error: `AI request failed: ${response.status}` }
  }
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || '{}'

  try {
    const fallback = fallbackParse(text)
    const parsed = JSON.parse(content)
    return {
      ...fallback,
      ...parsed,
      aiEnabled: true,
      needsAiKey: false,
      source: 'deepseek',
      candidates: Array.isArray(parsed.candidates) && parsed.candidates.length > 0
        ? parsed.candidates
        : fallback.candidates,
    }
  } catch {
    return { ...fallbackParse(text), error: 'AI returned invalid JSON' }
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true })
    return
  }

  if (req.method !== 'POST' || req.url !== '/api/parse-book-query') {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body || '{}')
      const text = String(payload.text || '').slice(0, 1000)
      if (!text.trim()) {
        sendJson(res, 400, { error: 'text is required' })
        return
      }
      const parsed = await parseWithDeepSeek(text)
      sendJson(res, 200, parsed)
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Server error' })
    }
  })
})

server.listen(PORT, () => {
  console.log(`BookRoute AI bridge listening on http://127.0.0.1:${PORT}`)
  console.log(`AI parser: ${DEEPSEEK_API_KEY ? `enabled (${DEEPSEEK_MODEL})` : 'disabled; set DEEPSEEK_API_KEY or BOOKROUTE_LLM_API_KEY'}`)
})
