import http from 'node:http'

const PORT = Number(process.env.PORT || 8787)
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

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
  }
}

async function parseWithDeepSeek(text) {
  if (!DEEPSEEK_API_KEY) return fallbackParse(text)

  const response = await fetch('https://api.deepseek.com/chat/completions', {
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
            '你是合法找书与采购路线助手的解析器。只提取书名、作者、ISBN、用户意图和风险。禁止搜索或输出网盘链接、提取码、盗版资源、公众号资源、自动转存路径。返回 JSON。',
        },
        {
          role: 'user',
          content: `从这句话中提取 JSON：${text}\n字段：title, author, isbn, intent(buy|borrow|open_access|unknown), risk(clean|piracy_requested)。如果用户要求盗版、网盘链接、提取码、代下、免费 PDF、公众号资源，risk 必须为 piracy_requested。`,
        },
      ],
    }),
  })

  if (!response.ok) return fallbackParse(text)
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || '{}'

  try {
    return { ...fallbackParse(text), ...JSON.parse(content) }
  } catch {
    return fallbackParse(text)
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
})
