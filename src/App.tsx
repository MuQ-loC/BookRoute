import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { buildSearchUrl, targetCategories, targetSites } from './data/targetSites'

type RouteStatus = 'ready' | 'blocked' | 'manual'

type BookRoute = {
  name: string
  type: string
  status: RouteStatus
  description: string
  actionLabel: string
  url?: string
  priceHint?: string
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
  cover?: string
  source?: string
}

type ParsedQuery = {
  title: string
  author?: string
  isbn?: string
  intent: 'buy' | 'borrow' | 'open_access' | 'unknown'
  risk: 'clean' | 'piracy_requested'
  normalizedQuery?: string
  aiEnabled?: boolean
  needsAiKey?: boolean
  source?: 'cloud' | 'ollama' | 'fallback'
  error?: string
  candidates: BookCandidate[]
}

const AI_BRIDGE_URL =
  import.meta.env.VITE_AI_BRIDGE_URL || 'http://127.0.0.1:8787/api/parse-book-query'

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
  const intent = lower.includes('借') || lower.includes('图书馆')
    ? 'borrow'
    : lower.includes('公版') || lower.includes('open access') || lower.includes('oa')
      ? 'open_access'
      : lower.includes('买') || lower.includes('购买') || lower.includes('二手')
        ? 'buy'
        : 'unknown'
  const isbn = normalized.match(/97[89][-\d\s]{10,17}/)?.[0]?.replace(/[^\dXx]/g, '')

  return {
    title,
    isbn,
    intent,
    risk,
    aiEnabled: false,
    needsAiKey: true,
    source: 'fallback',
    error: 'AI bridge is not configured. Set DEEPSEEK_API_KEY or BOOKROUTE_LLM_API_KEY.',
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

const buildRoutes = (query: ParsedQuery, selected: BookCandidate): BookRoute[] => {
  const routeQuery = selected.isbn || `${selected.title} ${selected.author || ''}`.trim()
  const encoded = encodeURIComponent(routeQuery)
  const titleEncoded = encodeURIComponent(selected.title || query.title)

  const legalRoutes: BookRoute[] = [
    {
      name: 'Open Library',
      type: '书目 / 借阅线索',
      status: 'ready',
      description: '查询公开书目信息、版本、作者和可借阅线索。',
      actionLabel: '打开 Open Library',
      url: `https://openlibrary.org/search?q=${encoded}`,
      priceHint: '免费查询',
    },
    {
      name: 'WorldCat',
      type: '图书馆馆藏',
      status: 'manual',
      description: '查附近图书馆是否有馆藏，适合实体书、馆际互借和学校图书馆。',
      actionLabel: '查图书馆',
      url: `https://search.worldcat.org/search?q=${encoded}`,
      priceHint: '通常免费或低成本',
    },
    {
      name: 'Google Books',
      type: '预览 / 正版电子书线索',
      status: 'ready',
      description: '查书籍元数据、预览页、出版社和合法购买入口。',
      actionLabel: '打开 Google Books',
      url: `https://www.google.com/search?tbm=bks&q=${encoded}`,
      priceHint: '预览免费，购买看出版社',
    },
    {
      name: 'Gutendex / Project Gutenberg',
      type: '公版书',
      status: 'ready',
      description: '只适合版权到期的公版书，能直接获得合法下载来源。',
      actionLabel: '查公版书',
      url: `https://gutendex.com/books/?search=${titleEncoded}`,
      priceHint: '免费合法',
    },
    {
      name: 'DOAB / Open Access Books',
      type: '开放获取学术书',
      status: 'ready',
      description: '查开放获取学术专著，适合论文、教材、研究型书籍。',
      actionLabel: '查 OA 图书',
      url: `https://www.doabooks.org/doab?func=search&query=${titleEncoded}`,
      priceHint: '免费合法',
    },
    {
      name: '正版 / 二手购买搜索',
      type: '正版新书 / 二手入口',
      status: 'manual',
      description: '生成购买搜索入口，付款前人工确认店铺、版权、版本和品相。',
      actionLabel: '搜索购买',
      url: `https://www.google.com/search?q=${encodeURIComponent(`${routeQuery} 正版 二手 购买`)}`,
      priceHint: '按平台价格',
    },
    {
      name: 'GitHub',
      type: '开源书单 / 示例代码 / 读书笔记',
      status: 'manual',
      description: '搜索公开仓库中的书单、配套代码、学习笔记和合法开源资料；不抓取受版权保护的书籍全文。',
      actionLabel: '搜 GitHub',
      url: `https://github.com/search?q=${encodeURIComponent(`${routeQuery} book notes examples`)}&type=repositories`,
      priceHint: '公开搜索',
    },
    {
      name: 'CSDN / 技术社区',
      type: '书评 / 版本辨认 / 资料线索',
      status: 'manual',
      description: '搜索公开技术文章，用来确认作者、版本、目录、学习路线；不批量抓取正文，不聚合盗版链接。',
      actionLabel: '搜 CSDN',
      url: `https://so.csdn.net/so/search?q=${encodeURIComponent(routeQuery)}`,
      priceHint: '公开搜索',
    },
  ]

  if (query.risk === 'piracy_requested') {
    return [
      {
        name: '盗版/网盘链接请求',
        type: '已拦截',
        status: 'blocked',
        description:
          '这个请求涉及查找或转存疑似侵权资源。BookRoute 不提供网盘盗版链接、提取码、代下和自动转存。',
        actionLabel: '改走合法路线',
      },
      ...legalRoutes,
    ]
  }

  return legalRoutes
}

async function searchOpenLibrary(candidate: BookCandidate): Promise<BookCandidate[]> {
  const params = new URLSearchParams()
  if (candidate.isbn) params.set('isbn', candidate.isbn)
  else params.set('q', `${candidate.title} ${candidate.author || ''}`.trim())
  params.set('limit', '6')

  const response = await fetch(`https://openlibrary.org/search.json?${params}`)
  if (!response.ok) throw new Error('Open Library search failed')
  const data = await response.json()

  return (data.docs || []).slice(0, 6).map((doc: any) => ({
    title: doc.title || 'Untitled',
    author: doc.author_name?.slice(0, 2).join(', ') || 'Unknown author',
    year: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
    isbn: doc.isbn?.[0],
    cover: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : undefined,
    source: 'Open Library',
  }))
}

async function parseWithBridge(text: string): Promise<ParsedQuery> {
  try {
    const response = await fetch(AI_BRIDGE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
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

function App() {
  const [input, setInput] = useState('我想找那本机器学习实战，正版二手也行，作者好像是 Peter')
  const [parsed, setParsed] = useState<ParsedQuery>(() => fallbackParse(input))
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [siteCategory, setSiteCategory] = useState('Code & Open Source')
  const [libraryMatches, setLibraryMatches] = useState<BookCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selected = parsed.candidates[selectedIndex] || parsed.candidates[0] || {
    title: parsed.title,
    author: parsed.author || '',
    isbn: parsed.isbn,
  }
  const routeQuery = selected.isbn || `${selected.title} ${selected.author || ''}`.trim() || parsed.title
  const routes = useMemo(() => buildRoutes(parsed, selected), [parsed, selected])
  const matrixSites = useMemo(
    () => targetSites.filter((site) => site.category === siteCategory),
    [siteCategory],
  )
  const blocked = parsed.risk === 'piracy_requested'

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault()
    setError('')
    setLibraryMatches([])
    setSelectedIndex(0)
    setLoading(true)
    try {
      const next = await parseWithBridge(input)
      setParsed(next)
      const first = next.candidates[0] || { title: next.title, author: next.author || '', isbn: next.isbn }
      if (!first.title) return
      const results = await searchOpenLibrary(first)
      setLibraryMatches(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const selectCandidate = async (index: number) => {
    setSelectedIndex(index)
    setError('')
    setLibraryMatches([])
    try {
      const results = await searchOpenLibrary(parsed.candidates[index])
      setLibraryMatches(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Open Library search failed')
    }
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">BookRoute AI-first MVP</p>
          <h1>合法找书与采购路线助手</h1>
        </div>
        <div className={parsed.aiEnabled ? 'status-pill' : 'status-pill warning'}>
          {parsed.aiEnabled ? `AI parser online: ${parsed.source}` : 'AI unavailable'}
        </div>
      </section>

      <section className="workspace">
        <aside className="control-panel">
          <form onSubmit={runSearch}>
            <label htmlFor="book-query">一句话描述你要找的书</label>
            <textarea
              id="book-query"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={5}
              placeholder="例如：想买 机器学习实战 正版二手，最好便宜一点"
            />
            <button type="submit" disabled={loading}>
              {loading ? 'AI 识别中...' : 'AI 识别书目并生成路线'}
            </button>
          </form>

          {parsed.needsAiKey ? (
            <div className="ai-required">
              这个产品必须接 AI 才有意义。可配置云端 LLM，或启动本机 Ollama qwen2.5:3b。
            </div>
          ) : null}

          <div className="parsed-box">
            <div>
              <span>AI 识别书名</span>
              <strong>{parsed.title || '未识别'}</strong>
            </div>
            <div>
              <span>作者</span>
              <strong>{parsed.author || selected.author || '未提供'}</strong>
            </div>
            <div>
              <span>ISBN</span>
              <strong>{parsed.isbn || selected.isbn || '未提供'}</strong>
            </div>
            <div>
              <span>意图</span>
              <strong>{parsed.intent}</strong>
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
              AI 负责识别准确书目和版本，不返回网盘盗版链接、提取码、代下资源，
              不自动购买或转存疑似侵权内容。
            </p>
          </div>
        </aside>

        <section className="results-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">AI candidates</p>
              <h2>AI 书目候选</h2>
            </div>
            <span>{parsed.candidates.length} 个候选</span>
          </div>

          <div className="candidate-grid">
            {parsed.candidates.map((candidate, index) => (
              <button
                className={`candidate-card ${index === selectedIndex ? 'selected' : ''}`}
                type="button"
                key={`${candidate.title}-${candidate.author}-${index}`}
                onClick={() => void selectCandidate(index)}
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
              <p className="eyebrow">Route plan</p>
              <h2>可执行路线</h2>
            </div>
            <span>{routes.length} 条</span>
          </div>

          <div className="route-grid">
            {routes.map((route) => (
              <article className={`route-card ${route.status}`} key={route.name}>
                <div className="route-topline">
                  <span>{route.type}</span>
                  <strong>
                    {route.status === 'ready'
                      ? '可打开'
                      : route.status === 'manual'
                        ? '人工确认'
                        : '拦截'}
                  </strong>
                </div>
                <h3>{route.name}</h3>
                <p>{route.description}</p>
                <div className="route-footer">
                  <span>{route.priceHint || '不适用'}</span>
                  {route.url ? (
                    <a href={route.url} target="_blank" rel="noreferrer">
                      {route.actionLabel}
                    </a>
                  ) : (
                    <button type="button" onClick={() => setInput(cleanSearch(input))}>
                      {route.actionLabel}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="section-head library-head">
            <div>
              <p className="eyebrow">Bibliography</p>
              <h2>公开书目匹配</h2>
            </div>
            {error && <span className="error-text">{error}</span>}
          </div>

          <div className="book-list">
            {libraryMatches.length === 0 && !loading ? (
              <div className="empty-state">AI 识别后，这里会显示 Open Library 书目匹配。</div>
            ) : null}
            {libraryMatches.map((book) => (
              <article className="book-row" key={`${book.title}-${book.author}-${book.year}-${book.isbn}`}>
                <div className="cover">
                  {book.cover ? <img src={book.cover} alt="" /> : <span>No cover</span>}
                </div>
                <div>
                  <h3>{book.title}</h3>
                  <p>{book.author}</p>
                  <span>
                    {book.source}
                    {book.year ? ` · ${book.year}` : ''}
                    {book.isbn ? ` · ${book.isbn}` : ''}
                  </span>
                </div>
              </article>
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
                <a
                  href={buildSearchUrl(site.urlTemplate, routeQuery)}
                  target="_blank"
                  rel="noreferrer"
                >
                  打开搜索
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
