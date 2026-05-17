import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.PORT || 8787)
const PROVIDERS_PATH = path.join(process.cwd(), 'providers.local.json')
const PROVIDERS_EXAMPLE_PATH = path.join(process.cwd(), 'providers.example.json')
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
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || process.env.QWEN_MODEL || 'qwen2.5:3b'

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

const knownBooks = [
  {
    triggers: ['机器学习实战', 'machine learning in action', 'peter harrington', 'machine learning peter'],
    title: '机器学习实战',
    author: 'Peter Harrington',
    publisher: '人民邮电出版社 / Manning Publications',
    year: '2012',
    isbn: '',
    edition: 'Machine Learning in Action 中文版 / 英文原版',
    confidence: 0.96,
    reason: '用户同时提到“机器学习实战”和 Peter，最常见对应 Peter Harrington 的 Machine Learning in Action。',
  },
  {
    triggers: ['sicp', '计算机程序的构造和解释', 'structure and interpretation of computer programs'],
    title: '计算机程序的构造和解释',
    author: 'Harold Abelson, Gerald Jay Sussman, Julie Sussman',
    publisher: '机械工业出版社 / MIT Press',
    year: '1985',
    isbn: '',
    edition: 'Structure and Interpretation of Computer Programs 中文版 / 英文原版',
    confidence: 0.97,
    reason: 'SICP 是该书的通用缩写。',
  },
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

function maskKey(key = '') {
  if (!key) return ''
  if (key.length <= 10) return `${key.slice(0, 2)}***`
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

function normalizeProvider(provider, index = 0) {
  const type = provider.type === 'openai' ? 'cloud' : provider.type || 'cloud'
  return {
    id: provider.id || `provider-${index + 1}`,
    name: provider.name || provider.id || `Provider ${index + 1}`,
    type,
    model: provider.model || '',
    baseUrl: provider.baseUrl || (type === 'ollama' ? OLLAMA_BASE_URL : ''),
    apiKey: provider.apiKey || '',
  }
}

function readProviderFile(filePath) {
  if (!fs.existsSync(filePath)) return []
  try {
    const providers = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''))
    return Array.isArray(providers) ? providers.map(normalizeProvider) : []
  } catch {
    return []
  }
}

function ensureLocalProviders() {
  if (fs.existsSync(PROVIDERS_PATH)) return
  const defaults = readProviderFile(PROVIDERS_EXAMPLE_PATH)
  if (defaults.length > 0) {
    fs.writeFileSync(PROVIDERS_PATH, JSON.stringify(defaults, null, 2), 'utf8')
  }
}

function loadProviders({ includeSecrets = false } = {}) {
  ensureLocalProviders()
  return readProviderFile(PROVIDERS_PATH).map((provider) => {
    if (includeSecrets) return provider
    return {
      ...provider,
      apiKey: '',
      hasApiKey: Boolean(provider.apiKey),
      apiKeyMasked: maskKey(provider.apiKey),
    }
  })
}

function providerFromPayload(provider = {}) {
  const localProviders = loadProviders({ includeSecrets: true })
  const localProvider = provider.id
    ? localProviders.find((item) => item.id === provider.id)
    : undefined
  return {
    ...(localProvider || {}),
    ...provider,
    apiKey: provider.apiKey || localProvider?.apiKey || '',
  }
}

function stripHtml(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value = '', length = 220) {
  const text = stripHtml(value)
  return text.length > length ? `${text.slice(0, length - 1)}...` : text
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
    error: '',
    candidates: [
      {
        title: title || text.trim(),
        author: '',
        publisher: '',
        year: '',
        isbn: isbn || '',
        edition: '',
        confidence: 0.25,
        reason: '本地关键词解析结果。',
      },
    ],
  }
}

function buildBookParsePrompt(text) {
  return `你是合法找书与采购路线助手的 AI 书目解析器。你的任务是把用户的模糊描述解析为准确书目候选，而不是搜索资源文件。

用户输入：
${text}

返回严格 JSON，不要 markdown，不要解释。结构如下：
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
4. 不要返回任何下载链接、网盘链接、提取码、公众号路径、转存路径。
5. 不确定时也必须给出最可能的书名候选，不要把 title 留空。
6. 只围绕用户输入识别，不要复述本提示词里的任何要求。`
}

function parseJsonObject(content) {
  const trimmed = String(content || '').trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON object in model response')
    return JSON.parse(match[0])
  }
}

function normalizeAiParse(text, parsed, source) {
  const fallback = fallbackParse(text)
  const seeded = findKnownBookCandidates(text)
  const aiCandidates = Array.isArray(parsed.candidates) && parsed.candidates.length > 0
    ? parsed.candidates
    : fallback.candidates
  const candidates = mergeCandidates([...seeded, ...aiCandidates])
  const first = candidates[0] || {}
  return {
    ...fallback,
    ...parsed,
    title: parsed.title || first.title || fallback.title,
    author: parsed.author || first.author || fallback.author,
    isbn: parsed.isbn || first.isbn || fallback.isbn,
    aiEnabled: true,
    needsAiKey: false,
    source,
    error: '',
    candidates,
  }
}

function findKnownBookCandidates(text) {
  const lower = text.toLowerCase()
  return knownBooks
    .filter((book) => book.triggers.some((trigger) => lower.includes(trigger.toLowerCase())))
    .map(({ triggers, ...book }) => book)
}

function mergeCandidates(candidates) {
  const seen = new Set()
  const result = []
  for (const candidate of candidates) {
    const title = String(candidate.title || '').trim()
    const author = String(candidate.author || '').trim()
    if (!title && !author) continue
    const key = `${title.toLowerCase()}|${author.toLowerCase()}|${candidate.isbn || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(candidate)
  }
  return result.slice(0, 6)
}

async function parseWithCloudLLM(text, provider = {}) {
  const apiKey = provider.apiKey || DEEPSEEK_API_KEY
  const baseUrl = provider.baseUrl || DEEPSEEK_BASE_URL
  const model = provider.model || DEEPSEEK_MODEL
  if (!apiKey) throw new Error('Cloud LLM key missing')

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
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
          content: buildBookParsePrompt(text),
        },
      ],
    }),
  })

  if (!response.ok) throw new Error(`Cloud LLM request failed: ${response.status}`)
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || '{}'
  return normalizeAiParse(text, parseJsonObject(content), 'cloud')
}

async function parseWithOllama(text, provider = {}) {
  const baseUrl = (provider.baseUrl || OLLAMA_BASE_URL).replace(/\/$/, '')
  const model = provider.model || OLLAMA_MODEL
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: buildBookParsePrompt(text),
      stream: false,
      format: 'json',
      options: {
        temperature: 0,
      },
    }),
  })

  if (!response.ok) throw new Error(`Ollama request failed: ${response.status}`)
  const data = await response.json()
  return normalizeAiParse(text, parseJsonObject(data.response), 'ollama')
}

async function parseWithAI(text, provider = {}) {
  const errors = []
  const resolvedProvider = providerFromPayload(provider)
  const type = resolvedProvider.type || 'auto'

  if ((type === 'cloud' || type === 'auto') && (resolvedProvider.apiKey || DEEPSEEK_API_KEY)) {
    try {
      return await parseWithCloudLLM(text, resolvedProvider)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  if (type === 'ollama' || type === 'auto') {
    try {
      return await parseWithOllama(text, resolvedProvider)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  return {
    ...fallbackParse(text),
    error: errors.length ? errors.join(' | ') : fallbackParse(text).error,
  }
}

async function searchGitHub(keyword) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(keyword)}&sort=stars&order=desc&per_page=8`
  const response = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'BookRoute',
    },
  })
  if (!response.ok) throw new Error(`GitHub search failed: ${response.status}`)
  const data = await response.json()
  return (data.items || []).map((item) => ({
    title: item.full_name,
    url: item.html_url,
    source: 'GitHub',
    snippet: truncate(item.description || ''),
    meta: `${item.stargazers_count || 0} stars · ${item.language || 'unknown'} · updated ${item.updated_at?.slice(0, 10) || ''}`,
  }))
}

async function searchHackerNews(keyword) {
  const response = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}&tags=story&hitsPerPage=8`)
  if (!response.ok) throw new Error(`Hacker News search failed: ${response.status}`)
  const data = await response.json()
  return (data.hits || []).map((item) => ({
    title: item.title || item.story_title || 'Untitled',
    url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
    source: 'Hacker News',
    snippet: truncate(item._highlightResult?.title?.value || item.title || ''),
    meta: `${item.points || 0} points · ${item.num_comments || 0} comments · ${item.created_at?.slice(0, 10) || ''}`,
  }))
}

async function searchOpenLibrary(keyword) {
  const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(keyword)}&limit=8`)
  if (!response.ok) throw new Error(`Open Library search failed: ${response.status}`)
  const data = await response.json()
  return (data.docs || []).map((item) => ({
    title: item.title || 'Untitled',
    url: item.key ? `https://openlibrary.org${item.key}` : `https://openlibrary.org/search?q=${encodeURIComponent(keyword)}`,
    source: 'Open Library',
    snippet: truncate([item.author_name?.slice(0, 3).join(', '), item.publisher?.[0]].filter(Boolean).join(' · ')),
    meta: [item.first_publish_year, item.isbn?.[0]].filter(Boolean).join(' · '),
  }))
}

async function searchArxiv(keyword) {
  const response = await fetch(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(keyword)}&start=0&max_results=8`, {
    headers: { 'user-agent': 'BookRoute/0.1 public-search-result-list' },
  })
  if (!response.ok) throw new Error(`arXiv search failed: ${response.status}`)
  const xml = await response.text()
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1])
  return entries.map((entry) => {
    const title = stripHtml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || 'Untitled')
    const summary = stripHtml(entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || '')
    const id = stripHtml(entry.match(/<id>([\s\S]*?)<\/id>/)?.[1] || '')
    const published = stripHtml(entry.match(/<published>([\s\S]*?)<\/published>/)?.[1] || '').slice(0, 10)
    const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((author) => stripHtml(author[1])).slice(0, 3)
    return {
      title,
      url: id,
      source: 'arXiv',
      snippet: truncate(summary),
      meta: [authors.join(', '), published].filter(Boolean).join(' · '),
    }
  })
}

async function searchPublic(provider, keyword) {
  const configs = {
    github: {
      source: 'GitHub',
      url: `https://github.com/search?q=${encodeURIComponent(keyword)}`,
      run: searchGitHub,
    },
    hackernews: {
      source: 'Hacker News',
      url: `https://hn.algolia.com/?q=${encodeURIComponent(keyword)}`,
      run: searchHackerNews,
    },
    openlibrary: {
      source: 'Open Library',
      url: `https://openlibrary.org/search?q=${encodeURIComponent(keyword)}`,
      run: searchOpenLibrary,
    },
    arxiv: {
      source: 'arXiv',
      url: `https://arxiv.org/search/?query=${encodeURIComponent(keyword)}&searchtype=all`,
      run: searchArxiv,
    },
  }
  const config = configs[provider]
  if (config) {
    try {
      const results = await config.run(keyword)
      if (results.length > 0) return results
      return [buildSearchPageResult(config.source, config.url, keyword, 'No API result matched this query.')]
    } catch (error) {
      const message = error instanceof Error ? error.message : 'API request failed'
      return [buildSearchPageResult(config.source, config.url, keyword, message)]
    }
  }
  throw new Error(`Provider ${provider} is manual-only`)
}

function buildUrlFromTemplate(template = '', keyword = '') {
  return template.includes('{keyword}')
    ? template.replace('{keyword}', encodeURIComponent(keyword))
    : template
}

async function searchSite(site, keyword) {
  const provider = String(site.provider || '')
  if (provider) return searchPublic(provider, keyword)

  return [
    buildSearchPageResult(
      site.name || 'Search site',
      buildUrlFromTemplate(site.urlTemplate || '', keyword),
      keyword,
      'This site has no stable public result API configured.',
    ),
  ]
}

async function searchAllPublic(sites, keyword) {
  const safeSites = Array.isArray(sites) ? sites.slice(0, 80) : []
  const batches = await Promise.all(
    safeSites.map(async (site) => {
      try {
        return await searchSite(site, keyword)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Search failed'
        return [
          buildSearchPageResult(
            site.name || 'Search site',
            buildUrlFromTemplate(site.urlTemplate || '', keyword),
            keyword,
            message,
          ),
        ]
      }
    }),
  )
  return batches.flat()
}

function buildSearchPageResult(source, url, keyword, reason) {
  return {
    title: `${source} 搜索入口：${keyword}`,
    url,
    source,
    snippet: `该来源暂未接入稳定公开结果 API，已生成同关键词搜索入口。${reason ? `状态：${reason}` : ''}`,
    meta: '搜索页兜底',
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true })
    return
  }

  if (req.method === 'POST' && req.url === '/api/search-public') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}')
        const keyword = String(payload.keyword || '').slice(0, 200)
        const provider = String(payload.provider || '')
        if (!keyword.trim()) {
          sendJson(res, 400, { error: 'keyword is required' })
          return
        }
        const results = await searchPublic(provider, keyword)
        sendJson(res, 200, { ok: true, provider, keyword, results })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : 'Search failed' })
      }
    })
    return
  }

  if (req.method === 'POST' && req.url === '/api/search-all-public') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}')
        const keyword = String(payload.keyword || '').slice(0, 200)
        if (!keyword.trim()) {
          sendJson(res, 400, { error: 'keyword is required' })
          return
        }
        const results = await searchAllPublic(payload.sites || [], keyword)
        sendJson(res, 200, { ok: true, keyword, results })
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : 'Search failed' })
      }
    })
    return
  }

  if (req.method === 'GET' && req.url === '/api/providers') {
    sendJson(res, 200, { ok: true, providers: loadProviders() })
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
      const parsed = await parseWithAI(text, payload.provider || {})
      sendJson(res, 200, parsed)
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Server error' })
    }
  })
})

server.listen(PORT, () => {
  console.log(`BookRoute AI bridge listening on http://127.0.0.1:${PORT}`)
  console.log(`Cloud parser: ${DEEPSEEK_API_KEY ? `enabled (${DEEPSEEK_MODEL})` : 'disabled'}`)
  console.log(`Local parser: Ollama ${OLLAMA_MODEL} at ${OLLAMA_BASE_URL}`)
})
