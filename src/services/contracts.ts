// 链接
export interface Link {
  id: number | string
  title: string
  url: string
  description: string | null
  category_id: number | string
  icon: string | null
  sort_order: number
  is_visible: boolean
  created_at: string
  updated_at: string
}

export interface ILinkService {
  getAll(): Promise<Link[]>
  getByCategory(categoryId: number | string): Promise<Link[]>
  getById(id: number | string): Promise<Link | null>
  create(data: Partial<Link>): Promise<Link>
  update(id: number | string, data: Partial<Link>): Promise<Link>
  remove(id: number | string): Promise<void>
  reorder(items: { id: number | string; sort_order: number }[]): Promise<void>
  checkDeadLinks(): Promise<{ id: number | string; status: number }[]>
}

// 分组
export interface Category {
  id: number | string
  name: string
  sort_order: number
  is_visible: boolean
  created_at: string
}

export interface ICategoryService {
  getAll(): Promise<Category[]>
  getById(id: number | string): Promise<Category | null>
  create(data: Partial<Category>): Promise<Category>
  update(id: number | string, data: Partial<Category>): Promise<Category>
  remove(id: number | string): Promise<void>
  reorder(items: { id: number | string; sort_order: number }[]): Promise<void>
}

// 站点配置
export interface IConfigService {
  getAll(): Promise<Record<string, string>>
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

// 收录申请
export interface Apply {
  id: number | string
  name: string
  url: string
  category_id: number | string
  icon: string | null
  description: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface IApplyService {
  getAll(): Promise<Apply[]>
  getByStatus(status: string): Promise<Apply[]>
  create(data: Partial<Apply>): Promise<Apply>
  approve(id: number | string): Promise<void>
  reject(id: number | string): Promise<void>
}

// 鉴权
export interface IAuthService {
  login(username: string, password: string): Promise<string>
  logout(): void
  getToken(): string | null
  isAuthenticated(): boolean
}

// 搜索引擎
export interface SearchEngine {
  id: number | string
  name: string
  url_template: string
  icon: string | null
  sort_order: number
  is_active: boolean
}

export interface ISearchEngineService {
  getAll(): Promise<SearchEngine[]>
  create(data: Partial<SearchEngine>): Promise<SearchEngine>
  update(id: number | string, data: Partial<SearchEngine>): Promise<SearchEngine>
  remove(id: number | string): Promise<void>
}

// 点击统计
export interface ClickStat {
  id: number | string
  link_id: number | string
  clicked_at: string
  user_agent: string
}

export interface StatsOverview {
  total_links: number
  total_clicks: number
  today_clicks: number
  week_clicks: number
}

export interface IStatsService {
  getOverview(): Promise<StatsOverview>
  getTopLinks(limit?: number): Promise<{ link_id: number | string; title: string; count: number }[]>
  getTrend(days?: number): Promise<{ date: string; count: number }[]>
  recordClick(linkId: number | string): Promise<void>
}

// 统一服务聚合
export interface Services {
  links: ILinkService
  categories: ICategoryService
  config: IConfigService
  apply: IApplyService
  auth: IAuthService
  searchEngines: ISearchEngineService
  stats: IStatsService
  frontendData: IFrontendDataService
}

// 公开只读快照（边缘函数 /api/frontend-data 返回的聚合数据；命中 Blob 快照时零回源 Neon）
export interface FrontendData {
  config: Record<string, string>
  categories: Category[]
  links: Link[]
  search_engines: SearchEngine[]
}

export interface IFrontendDataService {
  getAll(): Promise<FrontendData>
}