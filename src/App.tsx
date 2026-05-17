import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { buildSearchUrl, targetCategories, targetSites } from './data/targetSites'

type ProviderType = 'auto' | 'ollama' | 'cloud'

type ProviderConfig = {
  id?: string
  type: ProviderType
  name: string
  baseUrl: string
  model: string
  apiKey: string
  hasApiKey?: boolean
  apiKeyMasked?: string
}

type BookCandidate = {
  title: string
  author: string
  publisher?: string
  year?: string
  isbn?: string
  edition?: string
  confidence?: number
  reason?: string
}

type ParsedQuery = {
  title: string
  author?: string
  isbn?: string
  intent: 'buy' | 'borrow' | 'open_access' | 'unknown'
  risk: 'clean' | 'piracy_requested'
  aiEnabled?: boolean
  needsAiKey?: boolean
  source?: 'cloud' | 'ollama' | 'fallback'
  error?: string
  candidates: BookCandidate[]
}

type SearchResult = {
  title: string
  url: string
  source: string
  snippet: string
  meta: string
}

const AI_BRIDGE_URL =
  import.meta.env.VITE_AI_BRIDGE_URL || 'http://127.0.0.1:8787/api/parse-book-query'
const AI_PROVIDER_URL =
  import.meta.env.VITE_AI_PROVIDER_URL || 'http://127.0.0.1:8787/api/providers'

const defaultProvider: ProviderConfig = {
  type: 'auto',
  name: 'Local Qwen / Cloud fallback',
  baseUrl: 'http://127.0.0.1:11434',
  model: 'qwen2.5:3b',
  apiKey: '',
}

const providerPresets: ProviderConfig[] = [
  {
    type: 'ollama',
    name: 'Local Ollama Qwen',
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen2.5:3b',
    apiKey: '',
  },
  {
    type: 'cloud',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    apiKey: '',
  },
  {
    type: 'cloud',
    name: 'Qwen DashScope Compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    apiKey: '',
  },
  {
    type: 'cloud',
    name: 'Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    apiKey: '',
  },
]

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

const cleanSearch = (value: string) =>
  value
    .replace(/pdf|epub|mobi|azw3|完整版|高清版|扫描版|电子书/gi, '')
    .replace(/[^\p{L}\p{N}\s·.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const fallbackParse = (raw: string): ParsedQuery => {
  const normalized = raw.trim()
  const lower = normalized.toLowerCase()
  const title = cleanSearch(normalized) || normalized
  const risk = piracyTerms.some((term) => lower.includes(term.toLowerCase()))
    ? 'piracy_requested'
    : 'clean'
  const isbn = normalized.match(/97[89][-\d\s]{10,17}/)?.[0]?.replace(/[^\dXx]/g, '')

  return {
    title,
    isbn,
    intent: 'unknown',
    risk,
    aiEnabled: false,
    needsAiKey: true,
    source: 'fallback',
    error: 'AI bridge unavailable.',
    candidates: [
      {
        title,
        author: '',
        isbn,
        confidence: 0.25,
        reason: 'AI bridge unavailable. This local result is only a fallback.',
      },
    ],
  }
}

function loadProvider() {
  try {
    const saved = localStorage.getItem('bookroute-provider')
    if (!saved) return defaultProvider
    return { ...defaultProvider, ...JSON.parse(saved) }
  } catch {
    return defaultProvider
  }
}

async function parseWithBridge(text: string, provider: ProviderConfig): Promise<ParsedQuery> {
  try {
    const response = await fetch(AI_BRIDGE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, provider }),
    })
    if (!response.ok) return fallbackParse(text)
    const data = await response.json()
    const fallback = fallbackParse(text)
    return {
      ...fallback,
      ...data,
      title: data.title || fallback.title,
      author: data.author || fallback.author,
      isbn: data.isbn || fallback.isbn,
      intent: data.intent || fallback.intent,
      risk: data.risk === 'piracy_requested' ? 'piracy_requested' : fallback.risk,
      candidates: Array.isArray(data.candidates) && data.candidates.length > 0
        ? data.candidates
        : fallback.candidates,
      error: data.error,
      aiEnabled: Boolean(data.aiEnabled),
      needsAiKey: Boolean(data.needsAiKey),
    }
  } catch {
    return fallbackParse(text)
  }
}

async function searchPublic(provider: string, keyword: string): Promise<SearchResult[]> {
  const response = await fetch('http://127.0.0.1:8787/api/search-public', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider, keyword }),
  })
  if (!response.ok) throw new Error('Search failed')
  const data = await response.json()
  if (!data.ok) throw new Error(data.error || 'Search failed')
  return data.results || []
}

async function loadServerProviders(): Promise<ProviderConfig[]> {
  const response = await fetch(AI_PROVIDER_URL)
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data.providers) ? data.providers : []
}

function App() {
  const [input, setInput] = useState('我想找那本机器学习实战，正版二手也行，作者好像是 Peter')
  const [provider, setProvider] = useState<ProviderConfig>(() => loadProvider())
  const [serverProviders, setServerProviders] = useState<ProviderConfig[]>([])
  const [showKey, setShowKey] = useState(false)
  const [parsed, setParsed] = useState<ParsedQuery>(() => fallbackParse(input))
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [siteCategory, setSiteCategory] = useState('Code & Open Source')
  const [loading, setLoading] = useState(false)
  const [searchingSite, setSearchingSite] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [resultError, setResultError] = useState('')

  useEffect(() => {
    localStorage.setItem('bookroute-provider', JSON.stringify(provider))
  }, [provider])

  useEffect(() => {
    let cancelled = false
    loadServerProviders()
      .then((next) => {
        if (!cancelled && next.length > 0) setServerProviders(next)
      })
      .catch(() => {
        if (!cancelled) setServerProviders([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selected = parsed.candidates[selectedIndex] || parsed.candidates[0] || {
    title: parsed.title,
    author: parsed.author || '',
    isbn: parsed.isbn,
  }
  const routeQuery = selected.isbn || `${selected.title} ${selected.author || ''}`.trim() || parsed.title
  const matrixSites = useMemo(
    () => targetSites.filter((site) => site.category === siteCategory),
    [siteCategory],
  )
  const blocked = parsed.risk === 'piracy_requested'

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault()
    setSelectedIndex(0)
    setLoading(true)
    try {
      const next = await parseWithBridge(input, provider)
      setParsed(next)
    } finally {
      setLoading(false)
    }
  }

  const visibleProviders = serverProviders.length > 0 ? serverProviders : providerPresets

  const applyPreset = (preset: ProviderConfig) => {
    setProvider((current) => ({
      ...current,
      ...preset,
      apiKey: preset.hasApiKey ? '' : current.apiKey,
    }))
  }

  const runSiteSearch = async (siteName: string, siteProvider?: string) => {
    setResultError('')
    setResults([])
    if (!siteProvider) {
      setResultError(`${siteName} 暂时只提供手动打开入口。`)
      return
    }
    setSearchingSite(siteName)
    try {
      const next = await searchPublic(siteProvider, routeQuery)
      setResults(next)
    } catch (error) {
      setResultError(error instanceof Error ? error.message : 'Search failed')
    } finally {
      setSearchingSite('')
    }
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">BookRoute Matrix</p>
          <h1>AI 公开资料搜索矩阵</h1>
        </div>
        <div className={parsed.aiEnabled ? 'status-pill' : 'status-pill warning'}>
          {parsed.aiEnabled ? `AI parser online: ${parsed.source}` : 'AI unavailable'}
        </div>
      </section>

      <section className="workspace">
        <aside className="control-panel">
          <form onSubmit={runSearch}>
            <label htmlFor="book-query">一句话描述你要找的资料</label>
            <textarea
              id="book-query"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={5}
              placeholder="例如：想找 机器学习实战 的作者、版本、配套代码和公开读书笔记"
            />
            <button type="submit" disabled={loading}>
              {loading ? 'AI 识别中...' : 'AI 识别关键词'}
            </button>
          </form>

          <section className="provider-panel">
            <div className="section-minihead">
              <h2>API / 本地模型配置</h2>
              <span>{serverProviders.length > 0 ? '已读取本地 providers' : '保存在浏览器本地'}</span>
            </div>

            <div className="preset-row">
              {visibleProviders.map((preset) => (
                <button type="button" key={preset.name} onClick={() => applyPreset(preset)}>
                  {preset.hasApiKey ? `${preset.name} · key ${preset.apiKeyMasked}` : preset.name}
                </button>
              ))}
            </div>

            <label>
              <span>Provider</span>
              <select
                value={provider.type}
                onChange={(event) =>
                  setProvider((current) => ({ ...current, type: event.target.value as ProviderType }))
                }
              >
                <option value="auto">Auto</option>
                <option value="ollama">Ollama / local URL</option>
                <option value="cloud">OpenAI-compatible API</option>
              </select>
            </label>

            <label>
              <span>Base URL</span>
              <input
                value={provider.baseUrl}
                onChange={(event) => setProvider((current) => ({ ...current, baseUrl: event.target.value }))}
                placeholder="http://127.0.0.1:11434 或 https://api.example.com/v1"
              />
            </label>

            <label>
              <span>Model</span>
              <input
                value={provider.model}
                onChange={(event) => setProvider((current) => ({ ...current, model: event.target.value }))}
                placeholder="qwen2.5:3b / qwen-plus / deepseek-chat"
              />
            </label>

            <label>
              <span>API Key</span>
              <div className="secret-row">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={provider.apiKey}
                  onChange={(event) => setProvider((current) => ({ ...current, apiKey: event.target.value }))}
                  placeholder={provider.hasApiKey ? `已保存 ${provider.apiKeyMasked}` : '本地 Ollama 可留空'}
                />
                <button type="button" onClick={() => setShowKey((value) => !value)}>
                  {showKey ? '隐藏' : '显示'}
                </button>
              </div>
            </label>
          </section>

          <div className="parsed-box">
            <div>
              <span>关键词</span>
              <strong>{routeQuery || '未识别'}</strong>
            </div>
            <div>
              <span>书名</span>
              <strong>{parsed.title || selected.title || '未识别'}</strong>
            </div>
            <div>
              <span>作者</span>
              <strong>{parsed.author || selected.author || '未提供'}</strong>
            </div>
            <div>
              <span>合规状态</span>
              <strong className={blocked ? 'danger' : 'ok'}>
                {blocked ? '已拦截盗版意图' : '可继续'}
              </strong>
            </div>
          </div>

          {parsed.error ? <div className="bridge-error">{parsed.error}</div> : null}

          <div className="policy-card">
            <h2>边界</h2>
            <p>
              只生成公开网站搜索入口；不抓取正文，不返回网盘盗版链接、提取码、代下资源。
            </p>
          </div>
        </aside>

        <section className="results-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">AI candidates</p>
              <h2>AI 关键词候选</h2>
            </div>
            <span>{parsed.candidates.length} 个候选</span>
          </div>

          <div className="candidate-grid">
            {parsed.candidates.map((candidate, index) => (
              <button
                className={`candidate-card ${index === selectedIndex ? 'selected' : ''}`}
                type="button"
                key={`${candidate.title}-${candidate.author}-${index}`}
                onClick={() => setSelectedIndex(index)}
              >
                <span className="confidence">
                  {Math.round((candidate.confidence || 0) * 100)}%
                </span>
                <strong>{candidate.title}</strong>
                <small>{candidate.author || '作者待确认'}</small>
                <p>
                  {[candidate.publisher, candidate.year, candidate.edition, candidate.isbn]
                    .filter(Boolean)
                    .join(' · ') || '版本信息待确认'}
                </p>
                <em>{candidate.reason || 'AI 解析候选'}</em>
              </button>
            ))}
          </div>

          <div className="section-head library-head">
            <div>
              <p className="eyebrow">Target site matrix</p>
              <h2>公开站点搜索矩阵</h2>
            </div>
            <span>{targetSites.length} 个入口</span>
          </div>

          <div className="category-tabs">
            {targetCategories.map((category) => (
              <button
                type="button"
                key={category}
                className={category === siteCategory ? 'active' : ''}
                onClick={() => setSiteCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="site-grid">
            {matrixSites.map((site) => (
              <article className="site-card" key={site.name}>
                <div>
                  <strong>{site.name}</strong>
                  <span>{site.category}</span>
                </div>
                <p>{site.note}</p>
                <div className="site-actions">
                  {site.searchable ? (
                    <button
                      type="button"
                      onClick={() => void runSiteSearch(site.name, site.provider)}
                      disabled={searchingSite === site.name}
                    >
                      {searchingSite === site.name ? '搜索中...' : '返回结果'}
                    </button>
                  ) : null}
                  <a
                    href={buildSearchUrl(site.urlTemplate, routeQuery)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开搜索
                  </a>
                </div>
              </article>
            ))}
          </div>

          <div className="section-head library-head">
            <div>
              <p className="eyebrow">Search results</p>
              <h2>搜索结果列表</h2>
            </div>
            <span>{results.length} 条</span>
          </div>

          {resultError ? <div className="bridge-error">{resultError}</div> : null}

          <div className="result-list">
            {results.length === 0 && !resultError ? (
              <div className="empty-state">选择支持 API 的站点，点击“返回结果”，这里会显示标题、摘要、来源和可打开链接。</div>
            ) : null}
            {results.map((result) => (
              <article className="result-card" key={`${result.source}-${result.url}`}>
                <div>
                  <strong>{result.title}</strong>
                  <span>{result.source} · {result.meta}</span>
                </div>
                <p>{result.snippet || 'No summary provided.'}</p>
                <a href={result.url} target="_blank" rel="noreferrer">
                  打开结果
                </a>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
