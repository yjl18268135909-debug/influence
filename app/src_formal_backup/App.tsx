import { useEffect, useMemo, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  Download,
  LogOut,
  MessageCircle,
  Plane,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react'
import './App.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const DATA_KEY = 'mcn-formal-data-v1'
const AUTH_KEY = 'mcn-formal-current-user'
const DEFAULT_PASSWORD = '123456'

type Role = 'owner' | 'finance' | 'operator' | 'staff' | 'external'
type Collection = 'talents' | 'merchants' | 'sessions' | 'employees' | 'records' | 'finance'

type User = {
  username: string
  name: string
  role: Role
}

type BaseRow = { id: string }

type Talent = BaseRow & {
  name: string
  platform: string
  category: string
  fans: number
  fee: number
  status: string
  contact: string
}

type Merchant = BaseRow & {
  name: string
  category: string
  owner: string
  phone: string
  settlement: string
  status: string
}

type Employee = BaseRow & {
  name: string
  roleName: string
  team: string
  shift: string
  commissionRate: number
  status: string
}

type Session = BaseRow & {
  title: string
  date: string
  start: string
  end: string
  talentId: string
  merchantId: string
  employeeId: string
  room: string
  status: string
  targetGmv: number
}

type LiveRecord = BaseRow & {
  sessionId: string
  viewers: number
  orders: number
  gmv: number
  refund: number
  adCost: number
  remark: string
}

type FinanceRecord = BaseRow & {
  date: string
  type: string
  source: string
  amount: number
  status: string
  note: string
}

type AppData = {
  talents: Talent[]
  merchants: Merchant[]
  employees: Employee[]
  sessions: Session[]
  records: LiveRecord[]
  finance: FinanceRecord[]
}

type AnyRow = Talent | Merchant | Employee | Session | LiveRecord | FinanceRecord

type FieldConfig = {
  name: string
  label: string
  type?: 'text' | 'number' | 'date' | 'time' | 'select' | 'textarea'
  required?: boolean
  full?: boolean
  default?: string | number
  options?: () => { value: string; label: string }[]
}

type ColumnConfig<T extends AnyRow> = {
  label: string
  render: (row: T) => string
}

type ModuleConfig = {
  id: Collection | 'schedule' | 'travel'
  title: string
  icon: ComponentType<{ size?: number }>
  financeOnly?: boolean
  path: string
}

const modules: ModuleConfig[] = [
  { id: 'schedule', title: '达人排期沟通', icon: MessageCircle, path: '/schedule-communication' },
  { id: 'sessions', title: '直播场次管理', icon: CalendarDays, path: '/live-sessions' },
  { id: 'travel', title: '达人机酒管理', icon: Plane, path: '/travel-costs' },
  { id: 'talents', title: '达人管理', icon: UserRound, path: '/influencers' },
  { id: 'merchants', title: '商家管理', icon: Building2, path: '/merchants' },
  { id: 'employees', title: '员工管理', icon: UsersRound, path: '/employees' },
  { id: 'finance', title: '财务管理', icon: CircleDollarSign, financeOnly: true, path: '/finance' },
]

const demoData: AppData = {
  talents: [
    { id: 't1', name: '林安安', platform: '抖音', category: '美妆个护', fans: 1280000, fee: 18000, status: '重点合作', contact: 'Anan / 13800010001' },
    { id: 't2', name: '阿哲严选', platform: '快手', category: '食品生鲜', fans: 860000, fee: 12000, status: '稳定排期', contact: 'Zhe / 13800010002' },
    { id: 't3', name: '小周穿搭', platform: '淘宝直播', category: '服饰鞋包', fans: 530000, fee: 9000, status: '待复盘', contact: 'Zhou / 13800010003' },
  ],
  merchants: [
    { id: 'm1', name: '青禾美妆', category: '护肤', owner: '陈经理', phone: '13900020001', settlement: '坑位费+佣金', status: '执行中' },
    { id: 'm2', name: '北境食品', category: '零食', owner: '刘总', phone: '13900020002', settlement: '纯佣', status: '待签约' },
    { id: 'm3', name: '云裳服饰', category: '女装', owner: '王总', phone: '13900020003', settlement: '保底+佣金', status: '已结算' },
  ],
  employees: [
    { id: 'e1', name: '沈可', roleName: '运营负责人', team: '直播运营组', shift: '早班 09:00-18:00', commissionRate: 0.018, status: '在岗' },
    { id: 'e2', name: '赵一鸣', roleName: '中控', team: '直播运营组', shift: '晚班 15:00-24:00', commissionRate: 0.01, status: '在岗' },
    { id: 'e3', name: '苏棠', roleName: '商务', team: '商务组', shift: '弹性', commissionRate: 0.012, status: '休假' },
  ],
  sessions: [
    { id: 's1', title: '青禾美妆 618 预热专场', date: '2026-05-11', start: '19:00', end: '23:00', talentId: 't1', merchantId: 'm1', employeeId: 'e1', room: 'A 棚', status: '已排期', targetGmv: 680000 },
    { id: 's2', title: '北境食品新品试吃', date: '2026-05-14', start: '13:00', end: '17:00', talentId: 't2', merchantId: 'm2', employeeId: 'e2', room: 'B 棚', status: '待确认', targetGmv: 320000 },
    { id: 's3', title: '云裳夏装上新', date: '2026-05-18', start: '20:00', end: '24:00', talentId: 't3', merchantId: 'm3', employeeId: 'e3', room: 'C 棚', status: '已排期', targetGmv: 450000 },
  ],
  records: [
    { id: 'r1', sessionId: 's1', viewers: 186000, orders: 4300, gmv: 736000, refund: 32000, adCost: 58000, remark: '爆品面膜转化稳定，建议追加库存。' },
    { id: 'r2', sessionId: 's3', viewers: 92000, orders: 1850, gmv: 398000, refund: 18000, adCost: 26000, remark: '客单价高，尺码咨询消耗客服资源。' },
  ],
  finance: [
    { id: 'f1', date: '2026-05-20', type: '收入', source: '青禾美妆坑位费', amount: 80000, status: '已收款', note: '对应 s1' },
    { id: 'f2', date: '2026-05-21', type: '支出', source: '投流消耗', amount: 58000, status: '已付款', note: '青禾美妆专场' },
    { id: 'f3', date: '2026-05-25', type: '收入', source: '云裳服饰佣金', amount: 39800, status: '待收款', note: '按 GMV 10%' },
  ],
}

const roleLabel: Record<Role, string> = {
  owner: '老板',
  finance: '财务',
  operator: '运营',
  staff: '员工',
  external: '外部协作',
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(Number(value || 0))

const formatNumber = (value: number) => Number(value || 0).toLocaleString('zh-CN')

function uid(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(value: string, amount: number) {
  const [year, month] = value.split('-').map(Number)
  return monthKey(new Date(year, month - 1 + amount, 1))
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function timelineDaysFrom(month: string, anchorDay: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = new Date(year, monthNumber - 1, anchorDay)
  const end = new Date(year, monthNumber, anchorDay)
  const count = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(start, index)
    return {
      iso: isoDate(date),
      label: `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
      weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
    }
  })
}

function timelineRange(month: string, anchorDay: number, count: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = new Date(year, monthNumber - 1, anchorDay)
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(start, index)
    return {
      iso: isoDate(date),
      label: `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
      weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
    }
  })
}

function escapeCsvCell(value: string | number) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function formatChineseDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${year}年${month}月${day}日`
}

function initialTimelineAnchor(sessions: Session[]) {
  const currentMonth = monthKey()
  const firstSession = [...sessions].filter((session) => session.date.startsWith(currentMonth)).sort((a, b) => a.date.localeCompare(b.date))[0]
  if (!firstSession) return new Date().getDate()
  return Number(firstSession.date.slice(8, 10))
}

function moduleFromPath(pathname: string): ModuleConfig['id'] {
  if (pathname.startsWith('/live-sessions')) return 'sessions'
  if (pathname.startsWith('/travel-costs')) return 'travel'
  if (pathname.startsWith('/influencers')) return 'talents'
  if (pathname.startsWith('/merchants')) return 'merchants'
  if (pathname.startsWith('/employees')) return 'employees'
  if (pathname.startsWith('/finance')) return 'finance'
  return 'schedule'
}

function pathForModule(moduleId: ModuleConfig['id']) {
  return modules.find((item) => item.id === moduleId)?.path || '/schedule-communication'
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function getEmployeeSystemRole(employee: Employee): Role {
  if (employee.roleName.includes('财务')) return 'finance'
  if (employee.roleName.includes('运营') || employee.roleName.includes('负责人') || employee.roleName.includes('商务')) return 'operator'
  return 'staff'
}

function canViewFinance(user: User | null) {
  return user ? user.role === 'owner' || user.role === 'finance' : false
}

function loginEmail(username: string) {
  return username.includes('@') ? username.trim() : `${username.trim()}@mcn.local`
}

function profileToUser(profile: { id: string; name: string; role: Role }): User {
  return { username: profile.id, name: profile.name, role: profile.role }
}

function mapRemoteData(remote: {
  talents: Record<string, unknown>[]
  merchants: Record<string, unknown>[]
  employees: Record<string, unknown>[]
  sessions: Record<string, unknown>[]
  records: Record<string, unknown>[]
  finance: Record<string, unknown>[]
}): AppData {
  return {
    talents: remote.talents.map((item) => ({
      id: String(item.id),
      name: String(item.name || ''),
      platform: String(item.platform || ''),
      category: String(item.category || ''),
      fans: Number(item.fans || 0),
      fee: Number(item.fee || 0),
      status: String(item.status || ''),
      contact: String(item.contact || ''),
    })),
    merchants: remote.merchants.map((item) => ({
      id: String(item.id),
      name: String(item.name || ''),
      category: String(item.category || ''),
      owner: String(item.owner_name || ''),
      phone: String(item.phone || ''),
      settlement: String(item.settlement || ''),
      status: String(item.status || ''),
    })),
    employees: remote.employees.map((item) => ({
      id: String(item.id),
      name: String(item.name || ''),
      roleName: String(item.role_name || ''),
      team: String(item.team || ''),
      shift: String(item.shift || ''),
      commissionRate: Number(item.commission_rate || 0),
      status: String(item.status || ''),
    })),
    sessions: remote.sessions.map((item) => ({
      id: String(item.id),
      title: String(item.title || ''),
      date: String(item.session_date || ''),
      start: String(item.start_time || '').slice(0, 5),
      end: String(item.end_time || '').slice(0, 5),
      talentId: String(item.talent_id || ''),
      merchantId: String(item.merchant_id || ''),
      employeeId: String(item.employee_id || ''),
      room: String(item.room || ''),
      status: String(item.status || ''),
      targetGmv: Number(item.target_gmv || 0),
    })),
    records: remote.records.map((item) => ({
      id: String(item.id),
      sessionId: String(item.session_id || ''),
      viewers: Number(item.viewers || 0),
      orders: Number(item.orders || 0),
      gmv: Number(item.gmv || 0),
      refund: Number(item.refund || 0),
      adCost: Number(item.ad_cost || 0),
      remark: String(item.remark || ''),
    })),
    finance: remote.finance.map((item) => ({
      id: String(item.id),
      date: String(item.record_date || ''),
      type: String(item.type || ''),
      source: String(item.source || ''),
      amount: Number(item.amount || 0),
      status: String(item.status || ''),
      note: String(item.note || ''),
    })),
  }
}

async function fetchRemoteData(): Promise<AppData> {
  if (!supabase) return demoData
  const [talents, merchants, employees, sessions, records, finance] = await Promise.all([
    supabase.from('talents').select('*').order('created_at', { ascending: false }),
    supabase.from('merchants').select('*').order('created_at', { ascending: false }),
    supabase.from('employees').select('*').order('created_at', { ascending: false }),
    supabase.from('live_sessions').select('*').order('session_date', { ascending: true }),
    supabase.from('live_records').select('*').order('created_at', { ascending: false }),
    supabase.from('finance_records').select('*').order('record_date', { ascending: false }),
  ])
  const firstError = [talents, merchants, employees, sessions, records, finance].find((result) => result.error)?.error
  if (firstError) throw firstError
  return mapRemoteData({
    talents: talents.data || [],
    merchants: merchants.data || [],
    employees: employees.data || [],
    sessions: sessions.data || [],
    records: records.data || [],
    finance: finance.data || [],
  })
}

function toRemotePayload(collection: Collection, row: AnyRow) {
  if (collection === 'talents') {
    const item = row as Talent
    return { name: item.name, platform: item.platform, category: item.category, fans: item.fans, fee: item.fee, status: item.status, contact: item.contact }
  }
  if (collection === 'merchants') {
    const item = row as Merchant
    return { name: item.name, category: item.category, owner_name: item.owner, phone: item.phone, settlement: item.settlement, status: item.status }
  }
  if (collection === 'employees') {
    const item = row as Employee
    return { name: item.name, role_name: item.roleName, team: item.team, shift: item.shift, commission_rate: item.commissionRate, status: item.status }
  }
  if (collection === 'sessions') {
    const item = row as Session
    return { title: item.title, session_date: item.date, start_time: item.start, end_time: item.end, talent_id: item.talentId || null, merchant_id: item.merchantId || null, employee_id: item.employeeId || null, room: item.room, status: item.status, target_gmv: item.targetGmv }
  }
  if (collection === 'records') {
    const item = row as LiveRecord
    return { session_id: item.sessionId || null, viewers: item.viewers, orders: item.orders, gmv: item.gmv, refund: item.refund, ad_cost: item.adCost, remark: item.remark }
  }
  const item = row as FinanceRecord
  return { record_date: item.date, type: item.type, source: item.source, amount: item.amount, status: item.status, note: item.note }
}

const tableNameByCollection: Record<Collection, string> = {
  talents: 'talents',
  merchants: 'merchants',
  employees: 'employees',
  sessions: 'live_sessions',
  records: 'live_records',
  finance: 'finance_records',
}

function App() {
  const [data, setData] = useState<AppData>(() => readStorage(DATA_KEY, demoData))
  const [currentUser, setCurrentUser] = useState<User | null>(() => readStorage(AUTH_KEY, null))
  const [usingCloud, setUsingCloud] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [activeModule, setActiveModule] = useState<ModuleConfig['id']>(() => moduleFromPath(window.location.pathname))
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<{ collection: Collection; row?: AnyRow } | null>(null)
  const [toast, setToast] = useState('')

  const accounts = useMemo(
    () => [
      { username: 'weilun', password: DEFAULT_PASSWORD, name: 'weilun', role: 'owner' as Role },
      { username: 'boss', password: DEFAULT_PASSWORD, name: '老板', role: 'owner' as Role },
      { username: 'finance', password: DEFAULT_PASSWORD, name: '财务', role: 'finance' as Role },
      ...data.employees
        .filter((employee) => employee.status !== '离职')
        .map((employee) => ({
          username: employee.name,
          password: DEFAULT_PASSWORD,
          name: employee.name,
          role: getEmployeeSystemRole(employee),
        })),
    ],
    [data.employees],
  )

  const visibleModules = modules.filter((item) => !item.financeOnly || canViewFinance(currentUser))

  const flash = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2200)
  }

  const persistData = (nextData: AppData) => {
    setData(nextData)
    localStorage.setItem(DATA_KEY, JSON.stringify(nextData))
  }

  const loadCloudWorkspace = async () => {
    if (!supabase) return null
    const remoteData = await fetchRemoteData()
    setData(remoteData)
    setUsingCloud(true)
    return remoteData
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return

    let cancelled = false
    const client = supabase

    const restoreSession = async () => {
      const { data: sessionData } = await client.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId || cancelled) return

      setIsBusy(true)
      const { data: profile, error } = await client
        .from('profiles')
        .select('id,name,role,status')
        .eq('id', userId)
        .single()

      if (!cancelled && profile && !error && profile.status !== 'inactive') {
        const user = profileToUser(profile as { id: string; name: string; role: Role })
        setCurrentUser(user)
        localStorage.setItem(AUTH_KEY, JSON.stringify(user))
        await loadCloudWorkspace()
        flash(`已连接云端：${user.name}`)
      }
      if (!cancelled) setIsBusy(false)
    }

    restoreSession().catch(() => {
      if (!cancelled) {
        setUsingCloud(false)
        setIsBusy(false)
        flash('云端会话恢复失败，当前使用本地演示数据')
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handlePopState = () => setActiveModule(moduleFromPath(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const login = async (username: string, password: string) => {
    const trimmedUsername = username.trim()
    if (!trimmedUsername) return
    setIsBusy(true)

    if (isSupabaseConfigured && supabase) {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: loginEmail(trimmedUsername),
        password,
      })

      if (!error && authData.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id,name,role,status')
          .eq('id', authData.user.id)
          .single()

        if (profileError || !profile) {
          await supabase.auth.signOut()
          setIsBusy(false)
          flash('已登录认证账号，但还没有配置员工权限资料')
          return
        }

        if (profile.status === 'inactive') {
          await supabase.auth.signOut()
          setIsBusy(false)
          flash('该账号已停用，请联系管理员')
          return
        }

        const user = profileToUser(profile as { id: string; name: string; role: Role })
        setCurrentUser(user)
        localStorage.setItem(AUTH_KEY, JSON.stringify(user))
        setActiveModule(moduleFromPath(window.location.pathname))

        try {
          await loadCloudWorkspace()
          flash(`已登录云端：${user.name}`)
        } catch {
          setUsingCloud(false)
          flash('登录成功，但云端数据读取失败')
        }
        setIsBusy(false)
        return
      }
    }

    const account = accounts.find((item) => item.username === username.trim() && item.password === password)
    if (!account) {
      setIsBusy(false)
      flash('账号或密码不正确')
      return
    }
    const user = { username: account.username, name: account.name, role: account.role }
    setCurrentUser(user)
    localStorage.setItem(AUTH_KEY, JSON.stringify(user))
    setUsingCloud(false)
    setActiveModule('schedule')
    setIsBusy(false)
    flash(isSupabaseConfigured ? `已进入本地演示：${user.name}` : `已登录：${user.name}`)
  }

  const logout = async () => {
    if (supabase) await supabase.auth.signOut()
    setCurrentUser(null)
    setUsingCloud(false)
    localStorage.removeItem(AUTH_KEY)
    setActiveModule('schedule')
    flash('已退出登录')
  }

  const switchModule = (moduleId: ModuleConfig['id']) => {
    if (moduleId === 'finance' && !canViewFinance(currentUser)) {
      setActiveModule('schedule')
      flash('当前账号无权访问财务模块')
      return
    }
    setActiveModule(moduleId)
    window.history.pushState(null, '', pathForModule(moduleId))
    setQuery('')
  }

  const upsertRow = async (collection: Collection, payload: Record<string, string>) => {
    const fields = formConfigs(data)[collection]
    const normalized = Object.fromEntries(
      fields.map((field) => {
        const rawValue = payload[field.name] ?? field.default ?? ''
        return [field.name, field.type === 'number' ? Number(rawValue || 0) : rawValue]
      }),
    )
    const prefix = collection.slice(0, 1)
    const row = { id: editing?.row?.id || uid(prefix), ...normalized } as AnyRow

    if (usingCloud && supabase) {
      setIsBusy(true)
      const tableName = tableNameByCollection[collection]
      const remotePayload = toRemotePayload(collection, row)
      const result = editing?.row
        ? await supabase.from(tableName).update(remotePayload as Record<string, unknown>).eq('id', editing.row.id)
        : await supabase.from(tableName).insert(remotePayload as Record<string, unknown>)

      if (result.error) {
        setIsBusy(false)
        flash(`云端保存失败：${result.error.message}`)
        return
      }

      try {
        await loadCloudWorkspace()
        setEditing(null)
        flash(editing?.row ? '云端记录已更新' : '云端记录已新增')
      } catch {
        flash('保存成功，但重新读取云端数据失败')
      }
      setIsBusy(false)
      return
    }

    const nextRows = editing?.row
      ? (data[collection] as AnyRow[]).map((item) => (item.id === editing.row?.id ? row : item))
      : [...(data[collection] as AnyRow[]), row]
    persistData({ ...data, [collection]: nextRows })
    setEditing(null)
    flash(editing?.row ? '记录已更新' : '记录已新增')
  }

  const deleteRow = async (collection: Collection, row: AnyRow) => {
    const label = 'name' in row ? row.name : 'title' in row ? row.title : 'source' in row ? row.source : '这条记录'
    if (!window.confirm(`确认删除「${label}」？`)) return

    if (usingCloud && supabase) {
      setIsBusy(true)
      const { error } = await supabase.from(tableNameByCollection[collection]).delete().eq('id', row.id)
      if (error) {
        setIsBusy(false)
        flash(`云端删除失败：${error.message}`)
        return
      }
      try {
        await loadCloudWorkspace()
        flash('云端记录已删除')
      } catch {
        flash('删除成功，但重新读取云端数据失败')
      }
      setIsBusy(false)
      return
    }

    const nextRows = (data[collection] as AnyRow[]).filter((item) => item.id !== row.id)
    persistData({ ...data, [collection]: nextRows })
    flash('记录已删除')
  }

  const bulkDeleteSessions = async (sessionIds: string[]) => {
    if (!sessionIds.length) {
      flash('当前筛选条件下没有可删除排期')
      return
    }
    if (!window.confirm(`确认删除当前筛选出的 ${sessionIds.length} 条排期？`)) return

    if (usingCloud && supabase) {
      setIsBusy(true)
      const { error } = await supabase.from('live_sessions').delete().in('id', sessionIds)
      if (error) {
        setIsBusy(false)
        flash(`云端批量删除失败：${error.message}`)
        return
      }
      try {
        await loadCloudWorkspace()
        flash('云端排期已批量删除')
      } catch {
        flash('删除成功，但重新读取云端数据失败')
      }
      setIsBusy(false)
      return
    }

    persistData({ ...data, sessions: data.sessions.filter((session) => !sessionIds.includes(session.id)) })
    flash('排期已批量删除')
  }

  const exportSessions = (sessions: Session[]) => {
    if (!sessions.length) {
      flash('当前没有可导出的排期')
      return
    }
    const rows = [
      ['日期', '开始时间', '结束时间', '达人', '商家', '直播主题', '城市/直播间', '目标GMV', '状态'],
      ...sessions.map((session) => [
        session.date,
        session.start,
        session.end,
        data.talents.find((talent) => talent.id === session.talentId)?.name || '',
        data.merchants.find((merchant) => merchant.id === session.merchantId)?.name || '',
        session.title,
        session.room,
        session.targetGmv,
        session.status,
      ]),
    ]
    const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ShopFluence排期-${monthKey()}.csv`
    link.click()
    URL.revokeObjectURL(url)
    flash('排期已导出')
  }

  if (!currentUser) {
    return <LoginScreen onLogin={login} toast={toast} isBusy={isBusy} cloudReady={isSupabaseConfigured} />
  }

  const moduleCount = (moduleId: ModuleConfig['id']) => {
    if (moduleId === 'schedule' || moduleId === 'sessions') return data.sessions.length
    if (moduleId === 'travel') return 0
    if (moduleId === 'finance') return data.finance.length
    return data[moduleId].length
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>ShopFluence直播管理</strong>
            <span>达人直播管理系统</span>
          </div>
        </div>
        <nav className="nav">
          {visibleModules.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} className={activeModule === item.id ? 'active' : ''} onClick={() => switchModule(item.id)}>
                <Icon size={18} />
                <strong>{item.title}</strong>
                <span className="badge">{moduleCount(item.id)}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <h1>ShopFluence达人直播管理系统</h1>
          </div>
          <div className="topbar-user">
            <span>{currentUser.name}（{roleLabel[currentUser.role]}）</span>
            <button className="header-logout" onClick={logout}>
              <LogOut size={16} />
              退出
            </button>
          </div>
        </header>

        <div className="content-card">
          {activeModule === 'schedule' ? (
            <ScheduleBoard
              data={data}
              communicationOnly
              onAdd={() => setEditing({ collection: 'sessions' })}
              onEdit={(row) => setEditing({ collection: 'sessions', row })}
              onDelete={(row) => deleteRow('sessions', row)}
              onBulkAdd={() => setEditing({ collection: 'sessions' })}
              onBulkDelete={bulkDeleteSessions}
              onExport={exportSessions}
              onRefresh={() => {
                if (usingCloud) {
                  loadCloudWorkspace().then(() => flash('云端数据已刷新')).catch(() => flash('云端刷新失败'))
                } else {
                  flash('本地数据已刷新')
                }
              }}
            />
          ) : activeModule === 'sessions' ? (
            <LiveSessionsPage
              data={data}
              onAdd={() => setEditing({ collection: 'sessions' })}
              onEdit={(row) => setEditing({ collection: 'sessions', row })}
              onDelete={(row) => deleteRow('sessions', row)}
              onBulkAdd={() => setEditing({ collection: 'sessions' })}
              onBulkDelete={bulkDeleteSessions}
              onExport={exportSessions}
              onRefresh={() => flash('本地数据已刷新')}
            />
          ) : activeModule === 'travel' ? (
            <TravelPage data={data} />
          ) : activeModule === 'talents' ? (
            <OldDataPage title="达人管理" data={data} collection="talents" onAdd={() => setEditing({ collection: 'talents' })} onEdit={(row) => setEditing({ collection: 'talents', row })} onDelete={(row) => deleteRow('talents', row)} />
          ) : activeModule === 'merchants' ? (
            <OldDataPage title="商家管理" data={data} collection="merchants" onAdd={() => setEditing({ collection: 'merchants' })} onEdit={(row) => setEditing({ collection: 'merchants', row })} onDelete={(row) => deleteRow('merchants', row)} />
          ) : activeModule === 'employees' ? (
            <EmployeesPage data={data} onAdd={() => setEditing({ collection: 'employees' })} onEdit={(row) => setEditing({ collection: 'employees', row })} onDelete={(row) => deleteRow('employees', row)} />
          ) : activeModule === 'finance' ? (
            <FinancePage data={data} onAdd={() => setEditing({ collection: 'finance' })} />
          ) : (
            <>
              <label className="search module-search">
                <Search size={17} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索达人、商家、员工、场次" />
              </label>
              <TableModule
                collection={activeModule as Collection}
                data={data}
                query={query}
                onAdd={() => setEditing({ collection: activeModule as Collection })}
                onEdit={(row) => setEditing({ collection: activeModule as Collection, row })}
                onDelete={(row) => deleteRow(activeModule as Collection, row)}
              />
            </>
          )}
        </div>
      </main>

      {editing ? (
        <RecordDialog
          collection={editing.collection}
          data={data}
          row={editing.row}
          onClose={() => setEditing(null)}
          onSave={(payload) => upsertRow(editing.collection, payload)}
        />
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
      {isBusy ? <div className="busy-mask">处理中...</div> : null}
    </div>
  )
}

function LoginScreen({
  onLogin,
  toast,
  isBusy,
  cloudReady,
}: {
  onLogin: (username: string, password: string) => void | Promise<void>
  toast: string
  isBusy: boolean
  cloudReady: boolean
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  return (
    <main className="login-screen">
      <form
        className="login-card"
        onSubmit={(event) => {
          event.preventDefault()
          onLogin(username, password)
        }}
      >
        <div className="login-brand">
          <div className="brand-mark">M</div>
          <div>
            <strong>MCN LiveOS</strong>
            <span>{cloudReady ? '公司内部正式版 · Supabase 已配置' : '公司内部正式版 · 本地演示'}</span>
          </div>
        </div>
        <label className="field">
          <span>账号</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoFocus required />
        </label>
        <label className="field">
          <span>密码</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="默认密码 123456" required />
        </label>
        <button className="primary-button" type="submit" disabled={isBusy}>{isBusy ? '登录中...' : '登录'}</button>
      </form>
      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  )
}

function ScheduleBoard({
  data,
  communicationOnly = false,
  onAdd,
  onEdit,
  onDelete,
  onBulkAdd,
  onBulkDelete,
  onExport,
  onRefresh,
}: {
  data: AppData
  communicationOnly?: boolean
  onAdd: () => void
  onEdit: (row: Session) => void
  onDelete: (row: Session) => void
  onBulkAdd: () => void
  onBulkDelete: (sessionIds: string[]) => void
  onExport: (sessions: Session[]) => void
  onRefresh: () => void
}) {
  const [timelineMonth, setTimelineMonth] = useState(monthKey())
  const [anchorDay, setAnchorDay] = useState(() => initialTimelineAnchor(data.sessions))
  const [talentFilter, setTalentFilter] = useState('')
  const [merchantFilter, setMerchantFilter] = useState('')
  const [roomFilter, setRoomFilter] = useState('')
  const days = communicationOnly ? timelineRange(timelineMonth, new Date().getDate(), 8) : timelineDaysFrom(timelineMonth, anchorDay)
  const rangeStart = days[0]?.iso || `${timelineMonth}-01`
  const rangeEnd = days[days.length - 1]?.iso || `${timelineMonth}-31`
  const rangeSessions = data.sessions.filter((session) => session.date >= rangeStart && session.date <= rangeEnd)
  const currentMonthSessions = data.sessions.filter((session) => session.date.startsWith(timelineMonth))
  const filteredSessions = rangeSessions.filter((session) => {
    const merchant = data.merchants.find((item) => item.id === session.merchantId)
    return (
      (!talentFilter || session.talentId === talentFilter) &&
      (!merchantFilter || session.merchantId === merchantFilter) &&
      (!roomFilter || session.room.includes(roomFilter) || merchant?.category.includes(roomFilter))
    )
  })
  const talentIds = Array.from(new Set(filteredSessions.map((session) => session.talentId).filter(Boolean)))
  const visibleTalents = talentIds.length
    ? data.talents.filter((talent) => talentIds.includes(talent.id))
    : data.talents.filter((talent) => !talentFilter || talent.id === talentFilter)
  const rows = communicationOnly
    ? (talentIds.length ? visibleTalents : talentFilter ? visibleTalents : [])
    : (visibleTalents.length ? visibleTalents : data.talents)
  const sessionsByTalentDate = new Map<string, Session[]>()

  filteredSessions.forEach((session) => {
    const key = `${session.talentId}-${session.date}`
    sessionsByTalentDate.set(key, [...(sessionsByTalentDate.get(key) || []), session])
  })

  const totalByDate = (date: string) => filteredSessions.filter((session) => session.date === date).length

  return (
    <section className="schedule-page">
      <div className="schedule-toolbar">
        <button className="primary-button" onClick={onAdd}><Plus size={17} /> 新增直播场次</button>
        <button className="ghost-button" onClick={onBulkAdd}><Plus size={17} /> 批量新增排期</button>
        <button className="danger-outline-button" onClick={() => onBulkDelete(filteredSessions.map((session) => session.id))}><Trash2 size={16} /> 批量删除排期</button>
        {!communicationOnly ? <button className="ghost-button"><Download size={16} /> 下载导入模板</button> : null}
        {!communicationOnly ? <button className="ghost-button"><Download size={16} /> 导入排期</button> : null}
        <button className="ghost-button" onClick={onRefresh}><RefreshCw size={16} /> 刷新</button>
        {communicationOnly ? <button className="ghost-button" onClick={() => onExport(filteredSessions)}><Download size={16} /> 导出排期</button> : null}
        <input className="month-input push-right" type="month" value={timelineMonth} onChange={(event) => setTimelineMonth(event.target.value)} />
      </div>

      <div className="schedule-filters">
        <select value={talentFilter} onChange={(event) => setTalentFilter(event.target.value)}>
          <option value="">按达人筛选</option>
          {data.talents.map((talent) => <option key={talent.id} value={talent.id}>{talent.name}</option>)}
        </select>
        <select value={merchantFilter} onChange={(event) => setMerchantFilter(event.target.value)}>
          <option value="">按品牌筛选</option>
          {data.merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name}</option>)}
        </select>
        <select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}>
          <option value="">按直播城市筛选</option>
          {Array.from(new Set(data.sessions.map((session) => session.room).filter(Boolean))).map((room) => <option key={room} value={room}>{room}</option>)}
        </select>
        <button className="ghost-button" onClick={() => { setTalentFilter(''); setMerchantFilter(''); setRoomFilter('') }}>清除筛选</button>
      </div>

      <div className="schedule-stats">
        <Kpi label="本月达人" value={data.talents.length} hint="" />
        <Kpi label="本月场次" value={currentMonthSessions.length} hint="" />
        {!communicationOnly ? <Kpi label="待开始" value={currentMonthSessions.filter((item) => item.status !== '已结束').length} hint="" /> : null}
        {!communicationOnly ? <Kpi label="已完成" value={currentMonthSessions.filter((item) => item.status === '已结束').length} hint="" /> : null}
        <Kpi label="本月目标GMV" value="SGD 0.00" hint="" />
        {!communicationOnly ? <Kpi label="本月实际GMV" value="SGD 0.00" hint="" /> : null}
        {!communicationOnly ? <Kpi label="完成进度" value="0.00 %" hint="" /> : null}
      </div>

      {!communicationOnly ? (
        <div className="old-tabs">
          <button className="active">达人排期</button>
          <button>月历</button>
          <button>中控排期</button>
          <button>播后数据登记</button>
          <button>历史场次</button>
        </div>
      ) : null}

      <div className="month-nav">
        <input className="month-input" type="month" value={timelineMonth} onChange={(event) => setTimelineMonth(event.target.value)} />
        <button className="ghost-button" onClick={() => setTimelineMonth(addMonths(timelineMonth, -1))}>上月</button>
        <button className="ghost-button" onClick={() => { setTimelineMonth(monthKey()); setAnchorDay(new Date().getDate()) }}>本月</button>
        <button className="ghost-button" onClick={() => setTimelineMonth(addMonths(timelineMonth, 1))}>下月</button>
        <button className="ghost-button" onClick={() => { setTimelineMonth(monthKey()); setAnchorDay(new Date().getDate()) }}>回到今天</button>
      </div>

      <div className="influencer-schedule" style={{ gridTemplateColumns: `150px repeat(${days.length}, minmax(130px, 1fr))` }}>
        <div className="schedule-header schedule-name-cell">达人</div>
        {days.map((day) => (
          <div key={day.iso} className="schedule-header">
            <div>{day.label}</div>
            <span>{day.weekday}</span>
          </div>
        ))}

        <div className="schedule-name-cell schedule-total-name">总计达人场次</div>
        {days.map((day) => <div key={`total-${day.iso}`} className="schedule-total-cell">{totalByDate(day.iso)}</div>)}

        {rows.map((talent, talentIndex) => (
          <div className="schedule-row-fragment" key={talent.id}>
            <div className="schedule-name-cell schedule-row-name" key={`${talent.id}-name`}>
              <span className="schedule-dot" style={{ background: talentIndex % 2 ? '#13c2c2' : '#1677ff' }} />
              {talent.name}
            </div>
            {days.map((day) => {
              const color = talentIndex % 2 ? '#13c2c2' : '#1677ff'
              const sessions = sessionsByTalentDate.get(`${talent.id}-${day.iso}`) || []
              return (
                <div className="schedule-day-cell" key={`${talent.id}-${day.iso}`} onClick={() => onAdd()}>
                  {sessions.map((session) => {
                    const merchant = data.merchants.find((item) => item.id === session.merchantId)
                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        className="schedule-session-block"
                        style={{ borderColor: color, background: `${color}18`, color }}
                        key={session.id}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <span className="schedule-session-title">
                          <strong>{merchant?.name || session.title || '未添加品牌信息'}</strong>
                        </span>
                        <span className="schedule-session-mode">{merchant?.category || session.room || '未填写'}</span>
                        <div className="schedule-session-actions">
                          <span className="schedule-session-action" role="button" tabIndex={0} onClick={() => onEdit(session)}>修改</span>
                          <span className="schedule-session-action" role="button" tabIndex={0} onClick={() => onDelete(session)}>删除</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <h2 className="day-section-title">{formatChineseDate(days[0]?.iso || isoDate(new Date()))} 场次</h2>
      {communicationOnly ? <SelectedDateTable sessions={filteredSessions.filter((session) => session.date === days[0]?.iso)} data={data} /> : null}
    </section>
  )
}

function SelectedDateTable({ sessions, data }: { sessions: Session[]; data: AppData }) {
  return (
    <div className="old-table-wrap selected-date-table">
      <table>
        <thead>
          <tr>
            <th>开播时间</th>
            <th>直播城市</th>
            <th>达人</th>
            <th>品牌</th>
            <th>货盘表</th>
            <th>目标GMV</th>
          </tr>
        </thead>
        <tbody>
          {sessions.length ? sessions.map((session) => (
            <tr key={session.id}>
              <td>{session.start || '未填时间'}</td>
              <td>{session.room || '未填写'}</td>
              <td>{nameById(data.talents, session.talentId)}</td>
              <td>{nameById(data.merchants, session.merchantId)}</td>
              <td>未填写</td>
              <td>SGD 0</td>
            </tr>
          )) : (
            <tr>
              <td className="empty-state" colSpan={6}>暂无数据</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function LiveSessionsPage(props: {
  data: AppData
  onAdd: () => void
  onEdit: (row: Session) => void
  onDelete: (row: Session) => void
  onBulkAdd: () => void
  onBulkDelete: (sessionIds: string[]) => void
  onExport: (sessions: Session[]) => void
  onRefresh: () => void
}) {
  return <ScheduleBoard {...props} />
}

function TravelPage({ data }: { data: AppData }) {
  return (
    <section className="old-page">
      <h2>达人机酒管理</h2>
      <div className="old-filter-row">
        <input className="month-input" type="month" defaultValue={monthKey()} />
        <input className="old-input" placeholder="开始日期  →  结束日期" />
        <select><option>按达人筛选</option>{data.talents.map((item) => <option key={item.id}>{item.name}</option>)}</select>
        <select><option>按品牌筛选</option>{data.merchants.map((item) => <option key={item.id}>{item.name}</option>)}</select>
        <select><option>合作模式</option></select>
        <select><option>直播状态</option></select>
        <button className="ghost-button">清除筛选</button>
      </div>
      <section className="old-kpis four">
        <Kpi label="总成本" value="SGD 3,600.00" hint="" />
        <Kpi label="应收" value="SGD 1,300.00" hint="" />
        <Kpi label="已收" value="SGD 0.00" hint="" />
        <Kpi label="未收" value="SGD 1,300.00" hint="" />
      </section>
      <div className="old-tabs">
        <button className="active">达人机酒录入</button>
        <button>达人行程成本</button>
        <button>达人机酒均摊</button>
        <button>品牌应收机酒</button>
      </div>
      <div className="old-form-grid">
        <label><span>* 达人</span><select>{data.talents.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label><span>* 日期周期</span><input placeholder="开始日期  →  结束日期" /></label>
        <label><span>计算币种</span><div className="segmented"><button>新币</button><button className="active">人民币</button></div></label>
        <label><span>汇率</span><input defaultValue="1 SGD = 5.35 RMB" /></label>
        <label><span>机票类型</span><select><option>经济舱</option></select></label>
        <label><span>机票费用</span><input /></label>
        <label><span>酒店费用</span><input /></label>
        <label><span>商务车费用</span><input /></label>
      </div>
      <button className="primary-button form-submit">确定录入</button>
    </section>
  )
}

function OldDataPage({
  title,
  collection,
  data,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string
  collection: 'talents' | 'merchants'
  data: AppData
  onAdd: () => void
  onEdit: (row: AnyRow) => void
  onDelete: (row: AnyRow) => void
}) {
  const rows = data[collection] as AnyRow[]
  const isTalent = collection === 'talents'
  return (
    <section className="old-page">
      <h2>{title}</h2>
      <section className="old-card-kpis">
        <div><span>{isTalent ? '总达人数' : '总商家数'}</span><strong>{rows.length}</strong></div>
        <div><span>{isTalent ? '活跃达人' : '活跃商家'}</span><strong>{rows.length}</strong></div>
        <div><span>{isTalent ? '总GMV' : 'TikTok商家'}</span><strong>{isTalent ? '0.00 SGD' : rows.length}</strong></div>
        {!isTalent ? <div><span>Shopee商家</span><strong>0</strong></div> : null}
      </section>
      <div className="old-list-card">
        <div className="old-actions">
          <label className="old-search"><Search size={18} /><input placeholder={isTalent ? '搜索达人名称、账号或联系方式' : '搜索商家名称、联系人或邮箱'} /></label>
          <select><option>所有平台</option></select>
          <select><option>{isTalent ? '所有状态' : '所有分类'}</option></select>
          <button className="primary-button" onClick={onAdd}><Plus size={17} /> {isTalent ? '添加达人' : '添加商家'}</button>
          <button className="ghost-button"><RefreshCw size={16} /> 刷新</button>
        </div>
        <div className="old-table-wrap">
          <table>
            <thead>
              <tr>
                <th>{isTalent ? '平台' : 'ID'}</th>
                <th>{isTalent ? '达人名称' : '商家名称'}</th>
                <th>{isTalent ? '达人账号' : '商家分类'}</th>
                <th>{isTalent ? '达人佣金' : '平台'}</th>
                <th>{isTalent ? '总合作GMV' : '合作模式'}</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><Tag tone="red">{isTalent ? (row as Talent).platform || 'TikTok' : row.id}</Tag></td>
                  <td>{'name' in row ? row.name : ''}</td>
                  <td>{isTalent ? (row as Talent).contact || '-' : (row as Merchant).category || '-'}</td>
                  <td>{isTalent ? '10%' : 'TikTok'}</td>
                  <td>{isTalent ? 'SGD 0.00' : (row as Merchant).settlement || '-'}</td>
                  <td><button className="link-button" onClick={() => onEdit(row)}>编辑</button><button className="link-button danger" onClick={() => onDelete(row)}>删除</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function EmployeesPage({
  data,
  onAdd,
  onEdit,
  onDelete,
}: {
  data: AppData
  onAdd: () => void
  onEdit: (row: AnyRow) => void
  onDelete: (row: AnyRow) => void
}) {
  return (
    <section className="old-page">
      <div className="employee-header"><button className="primary-button" onClick={onAdd}><Plus size={17} /> 新增员工</button><input className="month-input push-right" type="month" defaultValue={monthKey()} /></div>
      <section className="old-kpis six">
        <Kpi label="在职员工" value={data.employees.length} hint="" />
        <Kpi label="本月员工场次" value={data.sessions.length + 1} hint="" />
        <Kpi label="本月休假" value="24" hint="" />
        <Kpi label="优秀记录" value="1" hint="" />
        <Kpi label="失误记录" value="1" hint="" />
        <Kpi label="本月实际GMV" value="SGD 0.00" hint="" />
      </section>
      <div className="old-tabs"><button className="active">员工档案</button><button>休假月历</button><button>场次数据</button><button>表现记录</button></div>
      <div className="old-table-wrap">
        <table>
          <thead><tr><th>姓名</th><th>岗位</th><th>入职时间</th><th>应出勤</th><th>应休假</th><th>实际出勤</th><th>实际休假</th><th>联系方式</th><th>提成比例</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>{data.employees.map((employee) => <tr key={employee.id}><td>{employee.name}</td><td><Tag>{employee.roleName}</Tag></td><td>-</td><td>24</td><td>7</td><td>0</td><td>9</td><td>9000 1201</td><td>{(employee.commissionRate * 100).toFixed(2)}%</td><td><Tag tone="green">{employee.status}</Tag></td><td><button className="link-button" onClick={() => onEdit(employee)}>编辑</button><button className="link-button danger" onClick={() => onDelete(employee)}>删除</button></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}

function FinancePage({ data, onAdd }: { data: AppData; onAdd: () => void }) {
  const income = data.finance.filter((item) => item.type === '收入').reduce((sum, item) => sum + item.amount, 0)
  const expense = data.finance.filter((item) => item.type === '支出').reduce((sum, item) => sum + item.amount, 0)
  return (
    <section className="old-page">
      <button className="primary-button" onClick={onAdd}><Plus size={17} /> 新增财务记录</button>
      <section className="old-kpis four">
        <Kpi label="收入" value={`SGD ${income.toLocaleString()}.00`} hint="" />
        <Kpi label="支出" value={`SGD ${expense.toLocaleString()}.00`} hint="" />
        <Kpi label="利润" value={`SGD ${(income - expense).toLocaleString()}.00`} hint="" />
        <Kpi label="待结算" value="SGD 4,292.00" hint="" />
      </section>
      <div className="old-tabs"><button className="active">财务记录</button></div>
      <div className="old-table-wrap">
        <table>
          <thead><tr><th>日期</th><th>类型</th><th>类别</th><th>对象</th><th>金额</th><th>状态</th></tr></thead>
          <tbody>{data.finance.map((item) => <tr key={item.id}><td>{item.date}</td><td><Tag tone={item.type === '收入' ? 'green' : 'red'}>{item.type}</Tag></td><td>{item.source}</td><td>{item.note || '-'}</td><td>SGD {item.amount.toLocaleString()}</td><td><Tag tone="green">{item.status}</Tag></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{hint}</em>
    </div>
  )
}

function TableModule({
  collection,
  data,
  query,
  onAdd,
  onEdit,
  onDelete,
}: {
  collection: Collection
  data: AppData
  query: string
  onAdd: () => void
  onEdit: (row: AnyRow) => void
  onDelete: (row: AnyRow) => void
}) {
  const config = tableConfigs(data)[collection]
  const rows = (data[collection] as AnyRow[]).filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()))

  return (
    <section className="module">
      <div className="module-header">
        <div>
          <p className="eyebrow">{config.caption}</p>
          <h2>{config.title}</h2>
        </div>
        <button className="primary-button" onClick={onAdd}>新增{config.short}</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {config.columns.map((column) => <th key={column.label}>{column.label}</th>)}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={row.id}>
                {config.columns.map((column) => <td key={column.label}>{column.render(row)}</td>)}
                <td>
                  <div className="row-actions">
                    <button className="small-button" onClick={() => onEdit(row)}>编辑</button>
                    <button className="small-button danger" onClick={() => onDelete(row)}>删除</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td className="empty" colSpan={config.columns.length + 1}>没有匹配记录</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function RecordDialog({
  collection,
  data,
  row,
  onClose,
  onSave,
}: {
  collection: Collection
  data: AppData
  row?: AnyRow
  onClose: () => void
  onSave: (payload: Record<string, string>) => void
}) {
  const fields = formConfigs(data)[collection]
  const config = tableConfigs(data)[collection]

  return (
    <div className="dialog-backdrop">
      <form
        className="dialog-panel"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          onSave(Object.fromEntries(form.entries()) as Record<string, string>)
        }}
      >
        <header>
          <div>
            <p className="eyebrow">{row ? '编辑记录' : '新增记录'}</p>
            <h2>{config.title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>×</button>
        </header>
        <div className="form-grid">
          {fields.map((field) => {
            const value = row && field.name in row ? String((row as unknown as Record<string, unknown>)[field.name] ?? '') : String(field.default ?? '')
            return (
              <label className={`field ${field.full ? 'full' : ''}`} key={field.name}>
                <span>{field.label}</span>
                {field.type === 'select' ? (
                  <select name={field.name} defaultValue={value} required={field.required}>
                    {field.options?.().map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea name={field.name} defaultValue={value} />
                ) : (
                  <input name={field.name} type={field.type || 'text'} defaultValue={value} required={field.required} />
                )}
              </label>
            )
          })}
        </div>
        <footer>
          <button className="ghost-button" type="button" onClick={onClose}>取消</button>
          <button className="primary-button" type="submit">保存</button>
        </footer>
      </form>
    </div>
  )
}

function Tag({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'green' | 'yellow' | 'red' }) {
  return <span className={`tag ${tone}`}>{children}</span>
}

function nameById<T extends { id: string; name: string }>(rows: T[], id: string) {
  return rows.find((item) => item.id === id)?.name || '未指定'
}

function tableConfigs(data: AppData): Record<Collection, { title: string; short: string; caption: string; columns: ColumnConfig<AnyRow>[] }> {
  return {
    talents: {
      title: '达人资源池',
      short: '达人',
      caption: '维护达人档案、平台、报价、领域与联系方式',
      columns: [
        { label: '达人', render: (row) => (row as Talent).name },
        { label: '平台', render: (row) => (row as Talent).platform },
        { label: '类目', render: (row) => (row as Talent).category },
        { label: '粉丝量', render: (row) => formatNumber((row as Talent).fans) },
        { label: '合作报价', render: (row) => formatMoney((row as Talent).fee) },
        { label: '状态', render: (row) => (row as Talent).status },
        { label: '联系方式', render: (row) => (row as Talent).contact },
      ],
    },
    merchants: {
      title: '商家合作库',
      short: '商家',
      caption: '管理品牌商家、结算方式、联系人与合作状态',
      columns: [
        { label: '商家', render: (row) => (row as Merchant).name },
        { label: '类目', render: (row) => (row as Merchant).category },
        { label: '联系人', render: (row) => (row as Merchant).owner },
        { label: '电话', render: (row) => (row as Merchant).phone },
        { label: '结算方式', render: (row) => (row as Merchant).settlement },
        { label: '状态', render: (row) => (row as Merchant).status },
      ],
    },
    sessions: {
      title: '直播场次',
      short: '场次',
      caption: '排期、场地、负责人和目标 GMV',
      columns: [
        { label: '日期', render: (row) => (row as Session).date },
        { label: '时间', render: (row) => `${(row as Session).start}-${(row as Session).end}` },
        { label: '主题', render: (row) => (row as Session).title },
        { label: '达人', render: (row) => nameById(data.talents, (row as Session).talentId) },
        { label: '商家', render: (row) => nameById(data.merchants, (row as Session).merchantId) },
        { label: '负责人', render: (row) => nameById(data.employees, (row as Session).employeeId) },
        { label: '目标 GMV', render: (row) => formatMoney((row as Session).targetGmv) },
        { label: '状态', render: (row) => (row as Session).status },
      ],
    },
    employees: {
      title: '员工与排班',
      short: '员工',
      caption: '管理员工、班次、岗位、团队与提成比例',
      columns: [
        { label: '员工', render: (row) => (row as Employee).name },
        { label: '岗位', render: (row) => (row as Employee).roleName },
        { label: '团队', render: (row) => (row as Employee).team },
        { label: '排班', render: (row) => (row as Employee).shift },
        { label: '提成比例', render: (row) => `${((row as Employee).commissionRate * 100).toFixed(1)}%` },
        { label: '状态', render: (row) => (row as Employee).status },
      ],
    },
    records: {
      title: '直播数据登记',
      short: '数据',
      caption: '登记每场直播观看、订单、GMV、退款、投流与复盘备注',
      columns: [
        { label: '场次', render: (row) => data.sessions.find((item) => item.id === (row as LiveRecord).sessionId)?.title || '未绑定场次' },
        { label: '观看人数', render: (row) => formatNumber((row as LiveRecord).viewers) },
        { label: '订单数', render: (row) => formatNumber((row as LiveRecord).orders) },
        { label: 'GMV', render: (row) => formatMoney((row as LiveRecord).gmv) },
        { label: '退款', render: (row) => formatMoney((row as LiveRecord).refund) },
        { label: '投流', render: (row) => formatMoney((row as LiveRecord).adCost) },
        { label: '备注', render: (row) => (row as LiveRecord).remark },
      ],
    },
    finance: {
      title: '财务流水',
      short: '流水',
      caption: '收入、支出、收付款状态与说明',
      columns: [
        { label: '日期', render: (row) => (row as FinanceRecord).date },
        { label: '类型', render: (row) => (row as FinanceRecord).type },
        { label: '来源/用途', render: (row) => (row as FinanceRecord).source },
        { label: '金额', render: (row) => formatMoney((row as FinanceRecord).amount) },
        { label: '状态', render: (row) => (row as FinanceRecord).status },
        { label: '备注', render: (row) => (row as FinanceRecord).note },
      ],
    },
  }
}

function formConfigs(data: AppData): Record<Collection, FieldConfig[]> {
  const option = (value: string) => ({ value, label: value })
  return {
    talents: [
      { name: 'name', label: '达人名称', required: true },
      { name: 'platform', label: '平台', type: 'select', options: () => ['抖音', '快手', '淘宝直播', '视频号', '小红书'].map(option) },
      { name: 'category', label: '擅长类目', required: true },
      { name: 'fans', label: '粉丝量', type: 'number', default: 0 },
      { name: 'fee', label: '合作报价', type: 'number', default: 0 },
      { name: 'status', label: '状态', type: 'select', options: () => ['重点合作', '稳定排期', '待复盘', '暂停合作'].map(option) },
      { name: 'contact', label: '联系方式', full: true },
    ],
    merchants: [
      { name: 'name', label: '商家名称', required: true },
      { name: 'category', label: '经营类目' },
      { name: 'owner', label: '联系人' },
      { name: 'phone', label: '联系电话' },
      { name: 'settlement', label: '结算方式', type: 'select', options: () => ['坑位费+佣金', '纯佣', '保底+佣金', '固定服务费'].map(option) },
      { name: 'status', label: '状态', type: 'select', options: () => ['执行中', '待签约', '已结算', '暂停'].map(option) },
    ],
    sessions: [
      { name: 'title', label: '直播主题', required: true, full: true },
      { name: 'date', label: '日期', type: 'date', required: true },
      { name: 'start', label: '开始时间', type: 'time' },
      { name: 'end', label: '结束时间', type: 'time' },
      { name: 'talentId', label: '达人', type: 'select', options: () => data.talents.map((item) => ({ value: item.id, label: item.name })) },
      { name: 'merchantId', label: '商家', type: 'select', options: () => data.merchants.map((item) => ({ value: item.id, label: item.name })) },
      { name: 'employeeId', label: '负责人', type: 'select', options: () => data.employees.map((item) => ({ value: item.id, label: item.name })) },
      { name: 'room', label: '直播间/场地' },
      { name: 'targetGmv', label: '目标 GMV', type: 'number', default: 0 },
      { name: 'status', label: '状态', type: 'select', options: () => ['待确认', '已排期', '直播中', '已结束', '取消'].map(option) },
    ],
    employees: [
      { name: 'name', label: '姓名', required: true },
      { name: 'roleName', label: '岗位', type: 'select', options: () => ['负责人', '店铺运营', '中控', '达人运营', '商务', '财务'].map(option) },
      { name: 'team', label: '团队' },
      { name: 'shift', label: '排班' },
      { name: 'commissionRate', label: '提成比例', type: 'number', default: 0 },
      { name: 'status', label: '状态', type: 'select', options: () => ['在岗', '休假', '离职'].map(option) },
    ],
    records: [
      { name: 'sessionId', label: '关联场次', type: 'select', full: true, options: () => data.sessions.map((item) => ({ value: item.id, label: `${item.date} ${item.title}` })) },
      { name: 'viewers', label: '观看人数', type: 'number', default: 0 },
      { name: 'orders', label: '订单数', type: 'number', default: 0 },
      { name: 'gmv', label: 'GMV', type: 'number', default: 0 },
      { name: 'refund', label: '退款金额', type: 'number', default: 0 },
      { name: 'adCost', label: '投流成本', type: 'number', default: 0 },
      { name: 'remark', label: '复盘备注', type: 'textarea', full: true },
    ],
    finance: [
      { name: 'date', label: '日期', type: 'date', required: true },
      { name: 'type', label: '类型', type: 'select', options: () => ['收入', '支出'].map(option) },
      { name: 'source', label: '来源/用途', required: true },
      { name: 'amount', label: '金额', type: 'number', default: 0 },
      { name: 'status', label: '状态', type: 'select', options: () => ['已收款', '待收款', '已付款', '待付款'].map(option) },
      { name: 'note', label: '备注', type: 'textarea', full: true },
    ],
  }
}

export default App
