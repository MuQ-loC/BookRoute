export type TargetSite = {
  name: string
  category: string
  urlTemplate: string
  note: string
}

export const targetSites: TargetSite[] = [
  {
    name: 'GitHub',
    category: 'Code & Open Source',
    urlTemplate: 'https://github.com/search?q={keyword}',
    note: 'README, issues, wiki, companion code, reading notes.',
  },
  {
    name: 'Gitee',
    category: 'Code & Open Source',
    urlTemplate: 'https://search.gitee.com/?q={keyword}',
    note: 'Chinese open-source repositories and project docs.',
  },
  {
    name: 'GitLab',
    category: 'Code & Open Source',
    urlTemplate: 'https://gitlab.com/search?search={keyword}',
    note: 'Public repositories and project documentation.',
  },
  {
    name: 'Codeberg',
    category: 'Code & Open Source',
    urlTemplate: 'https://codeberg.org/explore/repos?q={keyword}',
    note: 'Public free-software repositories.',
  },
  {
    name: 'Juejin',
    category: 'Chinese Tech Communities',
    urlTemplate: 'https://juejin.cn/search?query={keyword}',
    note: 'Frontend, full-stack, AI engineering articles.',
  },
  {
    name: 'CSDN',
    category: 'Chinese Tech Communities',
    urlTemplate: 'https://so.csdn.net/so/search?q={keyword}',
    note: 'Version clues, troubleshooting notes, reviews. Manual open only.',
  },
  {
    name: 'CNBlogs',
    category: 'Chinese Tech Communities',
    urlTemplate: 'https://zzk.cnblogs.com/s?w={keyword}',
    note: 'Long-form technical blogs and implementation notes.',
  },
  {
    name: 'SegmentFault',
    category: 'Chinese Tech Communities',
    urlTemplate: 'https://segmentfault.com/search?q={keyword}',
    note: 'Q&A, columns, Chinese developer notes.',
  },
  {
    name: 'InfoQ China',
    category: 'Chinese Tech Communities',
    urlTemplate: 'https://www.infoq.cn/search?q={keyword}',
    note: 'Architecture, industry, AI engineering articles.',
  },
  {
    name: 'OSCHINA',
    category: 'Chinese Tech Communities',
    urlTemplate: 'https://www.oschina.net/search?scope=blog&q={keyword}',
    note: 'Open-source news and technical blogs.',
  },
  {
    name: 'Tencent Cloud Developer',
    category: 'Official Tech Blogs',
    urlTemplate: 'https://cloud.tencent.com/developer/search?keyword={keyword}',
    note: 'Official cloud and engineering articles.',
  },
  {
    name: 'Alibaba Cloud Developer',
    category: 'Official Tech Blogs',
    urlTemplate: 'https://developer.aliyun.com/search?q={keyword}',
    note: 'Official cloud, middleware, AI, and DevOps articles.',
  },
  {
    name: 'Meituan Tech',
    category: 'Official Tech Blogs',
    urlTemplate: 'https://tech.meituan.com/?s={keyword}',
    note: 'High-quality engineering team blog.',
  },
  {
    name: 'ByteDance Tech',
    category: 'Official Tech Blogs',
    urlTemplate: 'https://tech.bytedance.com/search?q={keyword}',
    note: 'Engineering articles and architecture notes.',
  },
  {
    name: 'Stack Overflow',
    category: 'Global Tech Communities',
    urlTemplate: 'https://stackoverflow.com/search?q={keyword}',
    note: 'Troubleshooting and implementation details.',
  },
  {
    name: 'Dev.to',
    category: 'Global Tech Communities',
    urlTemplate: 'https://dev.to/search?q={keyword}',
    note: 'Practical developer articles.',
  },
  {
    name: 'Hacker News',
    category: 'Global Tech Communities',
    urlTemplate: 'https://hn.algolia.com/?q={keyword}',
    note: 'Industry discussion and new open-source projects.',
  },
  {
    name: 'Reddit MachineLearning',
    category: 'Global Tech Communities',
    urlTemplate: 'https://www.reddit.com/r/MachineLearning/search?q={keyword}&restrict_sr=1',
    note: 'ML discussion threads and paper discussions.',
  },
  {
    name: 'arXiv',
    category: 'Academic & AI',
    urlTemplate: 'https://arxiv.org/search/?query={keyword}&searchtype=all',
    note: 'Open preprints for AI, ML, CS, and math.',
  },
  {
    name: 'Papers with Code',
    category: 'Academic & AI',
    urlTemplate: 'https://paperswithcode.com/search?q_meta=&q={keyword}',
    note: 'Papers connected to code implementations.',
  },
  {
    name: 'Semantic Scholar',
    category: 'Academic & AI',
    urlTemplate: 'https://www.semanticscholar.org/search?q={keyword}',
    note: 'Academic search and citation graph.',
  },
  {
    name: 'DBLP',
    category: 'Academic & AI',
    urlTemplate: 'https://dblp.org/search?q={keyword}',
    note: 'Computer science bibliography.',
  },
  {
    name: 'Kaggle',
    category: 'Data Science',
    urlTemplate: 'https://www.kaggle.com/search?q={keyword}',
    note: 'Datasets, notebooks, competitions.',
  },
  {
    name: 'Hugging Face',
    category: 'Data Science',
    urlTemplate: 'https://huggingface.co/search?q={keyword}',
    note: 'Models, datasets, spaces, papers.',
  },
  {
    name: 'MDN Web Docs',
    category: 'Official Docs & Tutorials',
    urlTemplate: 'https://developer.mozilla.org/en-US/search?q={keyword}',
    note: 'Authoritative web platform documentation.',
  },
  {
    name: 'freeCodeCamp News',
    category: 'Official Docs & Tutorials',
    urlTemplate: 'https://www.freecodecamp.org/news/search/?query={keyword}',
    note: 'Tutorials and learning notes.',
  },
  {
    name: 'Project Gutenberg',
    category: 'Legal Books',
    urlTemplate: 'https://www.gutenberg.org/ebooks/search/?query={keyword}',
    note: 'Public-domain books.',
  },
  {
    name: 'Open Library',
    category: 'Legal Books',
    urlTemplate: 'https://openlibrary.org/search?q={keyword}',
    note: 'Bibliographic records and lending clues.',
  },
  {
    name: 'FreeTechBooks',
    category: 'Legal Books',
    urlTemplate: 'https://www.freetechbooks.com/search.html?q={keyword}',
    note: 'Free and legal technical book listings.',
  },
]

export const targetCategories = Array.from(new Set(targetSites.map((site) => site.category)))

export function buildSearchUrl(template: string, keyword: string) {
  return template.replace('{keyword}', encodeURIComponent(keyword))
}
