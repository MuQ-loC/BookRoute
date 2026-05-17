import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

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
  year?: string
  cover?: string
  source: string
}

type ParsedQuery = {
  title: string
  author?: string
  isbn?: string
  intent: 'buy' | 'borrow' | 'open_access' | 'unknown'
  risk: 'clean' | 'piracy_requested'
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

const parseQuery = (raw: string): ParsedQuery => {
  const normalized = raw.trim()
  const lower = normalized.toLowerCase()
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

  const isbnMatch = normalized.match(/97[89][-\d\s]{10,17}/)

  return {
    title: cleanSearch(normalized) || normalized,
    isbn: isbnMatch?.[0]?.replace(/[^\dXx]/g, ''),
    intent,
    risk,
  }
}

const buildRoutes = (query: ParsedQuery): BookRoute[] => {
  const encoded = encodeURIComponent(query.isbn || query.title)
  const titleEncoded = encodeURIComponent(query.title)

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
      name: '京东 / 当当 / 淘宝',
      type: '正版新书 / 二手入口',
      status: 'manual',
      description: '只生成搜索入口，购买前人工确认店铺、版权和版本。',
      actionLabel: '搜索购买',
      url: `https://www.google.com/search?q=${titleEncoded}+正版+二手+购买`,
      priceHint: '按平台价格',
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

async function searchOpenLibrary(query: ParsedQuery): Promise<BookCandidate[]> {
  const params = new URLSearchParams()
  if (query.isbn) params.set('isbn', query.isbn)
  else params.set('q', query.title)
  params.set('limit', '6')

  const response = await fetch(`https://openlibrary.org/search.json?${params}`)
  if (!response.ok) throw new Error('Open Library search failed')
  const data = await response.json()

  return (data.docs || []).slice(0, 6).map((doc: any) => ({
    title: doc.title || 'Untitled',
    author: doc.author_name?.slice(0, 2).join(', ') || 'Unknown author',
    year: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
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
    if (!response.ok) return parseQuery(text)
    const data = await response.json()
    return {
      ...parseQuery(text),
      title: data.title || parseQuery(text).title,
      author: data.author || '',
      isbn: data.isbn || parseQuery(text).isbn,
      intent: data.intent || parseQuery(text).intent,
      risk: data.risk === 'piracy_requested' ? 'piracy_requested' : parseQuery(text).risk,
    }
  } catch {
    return parseQuery(text)
  }
}

function App() {
  const [input, setInput] = useState('机器学习实战 正版 二手')
  const [parsed, setParsed] = useState<ParsedQuery>(() => parseQuery(input))
  const [candidates, setCandidates] = useState<BookCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const routes = useMemo(() => buildRoutes(parsed), [parsed])
  const blocked = parsed.risk === 'piracy_requested'

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault()
    setError('')
    setCandidates([])

    setLoading(true)
    try {
      const next = await parseWithBridge(input)
      setParsed(next)
      if (!next.title) return
      const results = await searchOpenLibrary(next)
      setCandidates(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">BookRoute MVP</p>
          <h1>合法找书与采购路线助手</h1>
        </div>
        <div className="status-pill">AI bridge ready</div>
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
              {loading ? '查询中...' : '生成合法路线'}
            </button>
          </form>

          <div className="parsed-box">
            <div>
              <span>识别书名</span>
              <strong>{parsed.title || '未识别'}</strong>
            </div>
            <div>
              <span>ISBN</span>
              <strong>{parsed.isbn || '未提供'}</strong>
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

          <div className="policy-card">
            <h2>边界</h2>
            <p>
              不返回网盘盗版链接、提取码、代下资源，不自动购买或转存疑似侵权内容。
              可以做正版新书、二手书、公版书、开放获取和图书馆路线。
            </p>
          </div>
        </aside>

        <section className="results-panel">
          <div className="section-head">
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
              <h2>书目候选</h2>
            </div>
            {error && <span className="error-text">{error}</span>}
          </div>

          <div className="book-list">
            {candidates.length === 0 && !loading ? (
              <div className="empty-state">点击查询后，这里会显示公开书目候选。</div>
            ) : null}
            {candidates.map((book) => (
              <article className="book-row" key={`${book.title}-${book.author}-${book.year}`}>
                <div className="cover">
                  {book.cover ? <img src={book.cover} alt="" /> : <span>No cover</span>}
                </div>
                <div>
                  <h3>{book.title}</h3>
                  <p>{book.author}</p>
                  <span>
                    {book.source}
                    {book.year ? ` · ${book.year}` : ''}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
