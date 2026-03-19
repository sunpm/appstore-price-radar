const APP_STORE_GENRE_LABELS: Record<string, string> = {
  books: '图书',
  business: '商务',
  developertools: '开发工具',
  education: '教育',
  entertainment: '娱乐',
  finance: '财务',
  fooddrink: '美食佳饮',
  games: '游戏',
  graphicsdesign: '图形与设计',
  healthfitness: '健康健美',
  kids: '儿童',
  lifestyle: '生活',
  magazinesnewspapers: '杂志与报刊',
  medical: '医疗',
  music: '音乐',
  navigation: '导航',
  news: '新闻',
  photo: '摄影与录像',
  productivity: '效率',
  reference: '参考',
  shopping: '购物',
  socialnetworking: '社交',
  sports: '体育',
  travel: '旅游',
  utilities: '工具',
  weather: '天气',
}

function normalizeGenreKey(genreName: string): string {
  return genreName.trim().replaceAll('&', '').replaceAll('/', '').replaceAll(' ', '').toLowerCase()
}

export function resolveAppStoreGenreLabel(genreName: string | null | undefined): string | null {
  const normalized = genreName?.trim()

  if (!normalized) {
    return null
  }

  return APP_STORE_GENRE_LABELS[normalizeGenreKey(normalized)] ?? normalized
}

export function resolveAppStoreGenreLabels(genres: Array<string | null | undefined>): string[] {
  const resolved = genres
    .map(resolveAppStoreGenreLabel)
    .filter((value): value is string => Boolean(value))

  return Array.from(new Set(resolved))
}
