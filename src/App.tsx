import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import './App.css'
import { isSupabaseConfigured, supabase, supabaseBucket } from './lib/supabase'

type CategoryId = 'bath' | 'toilet' | 'washroom' | 'kitchen' | 'interior'
type Grade = 'standard' | 'premium' | 'luxury'
type Timing = 'asap' | 'within3Months' | 'within6Months' | 'undecided'
type DataSource = 'supabase' | 'api' | 'local'
type MainView = 'simulator' | 'admin'
type AdminSection = 'dashboard' | 'requests' | 'config'
type Status = 'pending' | 'contacted' | 'completed'

type SelectedProductSummary = {
  categoryId: CategoryId
  categoryLabel: string
  productId: string
  productLabel: string
  maker: string
  price: number
}

type PricingRow = {
  label: string
  standard: number
  premium: number
  artisan: number
}

type EstimateForm = {
  category: CategoryId
  plan: string
  grade: Grade
  area: number
  options: string[]
  prefecture: string
  city: string
  timing: Timing
  notes: string
  customerName: string
  email: string
  phone: string
  imageNames: string[]
  selectedProducts?: SelectedProductSummary[]
}

type SubmissionRecord = EstimateForm & {
  id: string
  estimatedLow: number
  estimatedHigh: number
  submittedAt: string
  uploadedImages?: string[]
  status?: Status
}

type CategoryConfig = {
  id: CategoryId
  label: string
  description: string
  heroLabel: string
  baseRange: [number, number]
  plans: {
    id: string
    label: string
    subtitle: string
    multiplier: number
  }[]
}

type EquipmentItem = {
  id: string
  maker: string
  name: string
  subtitle: string
  price: number
  imageUrl?: string
  badge?: string
}

type AdminCategoryCard = {
  id: string
  label: string
  description: string
  heroLabel: string
  meta: string
}

type AdminProduct = EquipmentItem & {
  categoryId: CategoryId
  isVisible?: boolean
}

const STORAGE_KEY = 'renovation-estimate-submissions'
const CONFIG_STORAGE_KEY = 'renovation-estimate-config'
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

type SubmissionPayload = Omit<SubmissionRecord, 'id' | 'submittedAt'>

type SupabaseSubmissionRow = {
  id: string
  category: CategoryId
  plan: string
  grade: Grade
  area: number
  options: string[] | null
  prefecture: string
  city: string
  timing: Timing
  notes: string
  customer_name: string
  email: string
  phone: string
  image_names: string[] | null
  uploaded_images: string[] | null
  selected_products: SelectedProductSummary[] | null
  estimated_low: number
  estimated_high: number
  submitted_at: string
  status: Status | null
}

type SimulatorConfigPayload = {
  pricingRows: PricingRow[]
  adminCategories: AdminCategoryCard[]
  adminProducts: AdminProduct[]
}

type SupabaseConfigRow = {
  config_key: string
  config_value: SimulatorConfigPayload
  updated_at: string
}

const categories: CategoryConfig[] = [
  {
    id: 'kitchen',
    label: 'キッチン',
    description: '対面化、収納設計、設備更新を含む主力カテゴリ',
    heroLabel: 'KITCHEN',
    baseRange: [800000, 2400000],
    plans: [
      { id: 'replace', label: 'システムキッチン交換', subtitle: '設備交換中心の基本構成', multiplier: 1 },
      { id: 'layout', label: '対面キッチン化', subtitle: '対面化と導線再設計を含む', multiplier: 1.28 },
      { id: 'full', label: 'プレミアム全面改装', subtitle: '空間全体の再編集プラン', multiplier: 1.52 },
    ],
  },
  {
    id: 'bath',
    label: '浴室',
    description: 'ホテルライクな浴室刷新や断熱性能の改善向け',
    heroLabel: 'BATH',
    baseRange: [900000, 1600000],
    plans: [
      { id: 'replace', label: 'ユニットバス交換', subtitle: '短工期での刷新プラン', multiplier: 1 },
      { id: 'insulation', label: 'あたたか快適仕様', subtitle: '断熱・乾燥機を含む快適仕様', multiplier: 1.18 },
      { id: 'hotel', label: 'ホテルライク改装', subtitle: '高級感を高める上位構成', multiplier: 1.38 },
    ],
  },
  {
    id: 'washroom',
    label: '洗面所',
    description: '洗面台交換と収納改善で朝の導線を最適化',
    heroLabel: 'WASH',
    baseRange: [220000, 680000],
    plans: [
      { id: 'replace', label: '洗面台交換', subtitle: '洗面台中心のリニューアル', multiplier: 1 },
      { id: 'storage', label: '収納拡張', subtitle: '収納強化と造作棚を追加', multiplier: 1.16 },
      { id: 'family', label: '2ボウル化', subtitle: '2ボウル化を想定した構成', multiplier: 1.36 },
    ],
  },
  {
    id: 'toilet',
    label: 'トイレ',
    description: '便器交換から壁床の刷新までを短工期で実施',
    heroLabel: 'TOILET',
    baseRange: [180000, 550000],
    plans: [
      { id: 'replace', label: '便器交換', subtitle: '便器交換中心の標準プラン', multiplier: 1 },
      { id: 'wallfloor', label: '壁床セット改装', subtitle: '内装セットでの再構成', multiplier: 1.2 },
      { id: 'barrierfree', label: 'バリアフリー対応', subtitle: '手すり・段差解消を含む', multiplier: 1.32 },
    ],
  },
  {
    id: 'interior',
    label: '内装',
    description: '床材やクロスの刷新で空間全体の印象を改善',
    heroLabel: 'INTERIOR',
    baseRange: [300000, 1200000],
    plans: [
      { id: 'wallpaper', label: 'クロス張替え', subtitle: 'クロス張替え中心の構成', multiplier: 1 },
      { id: 'flooring', label: '床材リニューアル', subtitle: '床材更新と巾木調整を含む', multiplier: 1.22 },
      { id: 'total', label: '全面スタイリング', subtitle: '建具・照明も含めた再編集', multiplier: 1.48 },
    ],
  },
]

const categoryOrder: CategoryId[] = ['kitchen', 'bath', 'washroom', 'toilet', 'interior']

const equipmentCatalog: Record<CategoryId, EquipmentItem[]> = {
  kitchen: [
    { id: 'kitchen-lixil-ale', maker: 'LIXIL', name: 'アレスタ', subtitle: '間口2550mm / 工事費込み', price: 770000, badge: '人気' },
    { id: 'kitchen-panasonic-vstyle', maker: 'Panasonic', name: 'Vスタイル', subtitle: '対面化向け / 食洗機対応', price: 500000 },
    { id: 'kitchen-cleanup-rakuera', maker: 'Cleanup', name: 'ラクエラ', subtitle: '収納重視 / 扉色多数', price: 240000 },
    { id: 'kitchen-toclas-berry', maker: 'TOCLAS', name: 'ベリー', subtitle: '人造大理石カウンター', price: 200000, badge: 'おすすめ' },
  ],
  bath: [
    { id: 'bath-lixil-arise', maker: 'LIXIL', name: 'アライズ', subtitle: '1616サイズ / 浴室暖房対応', price: 880000, badge: '人気' },
    { id: 'bath-panasonic-orefuro', maker: 'Panasonic', name: 'オフローラ', subtitle: '保温浴槽 / 掃除ラク仕様', price: 300000 },
    { id: 'bath-toto-sazana', maker: 'TOTO', name: 'サザナ', subtitle: 'ほっカラリ床', price: 200000 },
    { id: 'bath-toclas-every', maker: 'TOCLAS', name: 'エブリィ', subtitle: '収納棚強化モデル', price: 200000, badge: 'おすすめ' },
  ],
  washroom: [
    { id: 'wash-lixil-mv', maker: 'LIXIL', name: 'MV', subtitle: '間口750mm / 三面鏡', price: 165000, badge: '人気' },
    { id: 'wash-panasonic-c-line', maker: 'Panasonic', name: 'シーライン', subtitle: '収納量重視 / LED照明', price: 500000 },
    { id: 'wash-toto-octave', maker: 'TOTO', name: 'オクターブ', subtitle: 'タッチレス水栓対応', price: 200000 },
  ],
  toilet: [
    { id: 'toilet-lixil-ameju', maker: 'LIXIL', name: 'アメージュZA', subtitle: '節水型 / 手洗い付き', price: 198000, badge: '人気' },
    { id: 'toilet-lixil-refore', maker: 'LIXIL', name: 'リフォレ', subtitle: '収納一体型', price: 300000 },
    { id: 'toilet-toto-qr', maker: 'TOTO', name: 'ピュアレストQR', subtitle: '清掃性重視', price: 200000 },
    { id: 'toilet-panasonic-alauno', maker: 'Panasonic', name: 'アラウーノ', subtitle: '自動洗浄対応', price: 200000, badge: 'おすすめ' },
  ],
  interior: [
    { id: 'interior-wallpaper-standard', maker: 'SANGETSU', name: '量産クロス張替え', subtitle: '壁天井セット', price: 180000 },
    { id: 'interior-flooring-natural', maker: 'DAIKEN', name: '床材リニューアル', subtitle: 'LDK向け / 防音仕様', price: 260000, badge: '人気' },
    { id: 'interior-door-style', maker: 'LIXIL', name: '建具スタイル更新', subtitle: 'ドア・巾木・見切り材', price: 220000 },
  ],
}

const optionCatalog = [
  { id: 'demolition', label: '解体・撤去対応', note: '既存設備撤去と養生を含む', multiplier: 1.08 },
  { id: 'disposal', label: '廃材処分込み', note: '廃材処分費を概算へ反映', multiplier: 1.04 },
  { id: 'design', label: 'デザイン提案', note: '素材・色・造作の提案書を追加', multiplier: 1.1 },
  { id: 'smart', label: 'スマート設備', note: '設備連携や電装更新を含む', multiplier: 1.12 },
]

const gradeConfig: Record<Grade, { label: string; multiplier: number }> = {
  standard: { label: 'スタンダード', multiplier: 1 },
  premium: { label: 'プレミアム', multiplier: 1.22 },
  luxury: { label: 'アルチザン', multiplier: 1.48 },
}

const timingLabels: Record<Timing, string> = {
  asap: 'できるだけ早く',
  within3Months: '3か月以内',
  within6Months: '6か月以内',
  undecided: '未定',
}

const statusLabels: Record<Status, { label: string; tone: string }> = {
  pending: { label: '未対応', tone: 'status-amber' },
  contacted: { label: '連絡済み', tone: 'status-blue' },
  completed: { label: '完了', tone: 'status-green' },
}

const initialForm: EstimateForm = {
  category: 'kitchen',
  plan: 'layout',
  grade: 'premium',
  area: 3,
  options: ['design', 'smart'],
  prefecture: '東京都',
  city: '目黒区',
  timing: 'within3Months',
  notes: '対面キッチンへの変更、カップボード追加、家事動線の改善を希望。',
  customerName: 'デモ 太郎',
  email: 'demo@example.com',
  phone: '090-9999-9999',
  imageNames: ['kitchen_before.jpg'],
}

const demoSubmissions: SubmissionRecord[] = [
  {
    id: 'demo-1',
    category: 'kitchen',
    plan: 'layout',
    grade: 'premium',
    area: 3,
    options: ['design', 'smart'],
    prefecture: '東京都',
    city: '世田谷区',
    timing: 'asap',
    notes: '壁付けキッチンから対面へ変更したい。食洗機とカップボードも追加希望。',
    customerName: '佐藤 花子',
    email: 'satou.hanako@example.com',
    phone: '090-1111-1111',
    imageNames: ['kitchen_before_01.jpg', 'kitchen_before_02.jpg'],
    selectedProducts: [
      { categoryId: 'kitchen', categoryLabel: 'キッチン', productId: 'kitchen-lixil-ale', productLabel: 'アレスタ', maker: 'LIXIL', price: 770000 },
      { categoryId: 'bath', categoryLabel: '浴室', productId: 'bath-lixil-arise', productLabel: 'アライズ', maker: 'LIXIL', price: 880000 },
    ],
    estimatedLow: 1680000,
    estimatedHigh: 3280000,
    submittedAt: '2024/10/24',
    status: 'pending',
  },
  {
    id: 'demo-2',
    category: 'bath',
    plan: 'hotel',
    grade: 'luxury',
    area: 2,
    options: ['demolition', 'design'],
    prefecture: '神奈川県',
    city: '横浜市',
    timing: 'within3Months',
    notes: '高級感のある浴室にしたい。肩湯や調光照明も検討中。',
    customerName: '鈴木 一郎',
    email: 'suzuki.ichiro@example.com',
    phone: '080-2222-2222',
    imageNames: ['bathroom_before.jpg'],
    selectedProducts: [
      { categoryId: 'bath', categoryLabel: '浴室', productId: 'bath-toclas-every', productLabel: 'エブリィ', maker: 'TOCLAS', price: 200000 },
      { categoryId: 'washroom', categoryLabel: '洗面所', productId: 'wash-panasonic-c-line', productLabel: 'シーライン', maker: 'Panasonic', price: 500000 },
    ],
    estimatedLow: 1980000,
    estimatedHigh: 3760000,
    submittedAt: '2024/10/22',
    status: 'contacted',
  },
  {
    id: 'demo-3',
    category: 'interior',
    plan: 'total',
    grade: 'premium',
    area: 4,
    options: ['design'],
    prefecture: '千葉県',
    city: '船橋市',
    timing: 'within6Months',
    notes: 'リビングとワークスペースを一体で整えたい。',
    customerName: '高橋 美咲',
    email: 'takahashi.misaki@example.com',
    phone: '070-3333-3333',
    imageNames: ['living_current.png'],
    selectedProducts: [
      { categoryId: 'interior', categoryLabel: '内装', productId: 'interior-flooring-natural', productLabel: '床材リニューアル', maker: 'DAIKEN', price: 260000 },
    ],
    estimatedLow: 1280000,
    estimatedHigh: 2420000,
    submittedAt: '2024/10/19',
    status: 'completed',
  },
  {
    id: 'demo-4',
    category: 'toilet',
    plan: 'wallfloor',
    grade: 'standard',
    area: 1,
    options: [],
    prefecture: '埼玉県',
    city: '川口市',
    timing: 'asap',
    notes: '壁紙と床も含めて清潔感のある空間にしたい。',
    customerName: '田中 恒一',
    email: 'tanaka.kouichi@example.com',
    phone: '070-5555-5555',
    imageNames: ['toilet_current.png'],
    selectedProducts: [
      { categoryId: 'toilet', categoryLabel: 'トイレ', productId: 'toilet-lixil-ameju', productLabel: 'アメージュZA', maker: 'LIXIL', price: 198000 },
    ],
    estimatedLow: 310000,
    estimatedHigh: 690000,
    submittedAt: '2024/10/18',
    status: 'pending',
  },
]

const defaultPricingRows: PricingRow[] = [
  { label: 'カウンター天板（平方フィート）', standard: 45, premium: 85, artisan: 145 },
  { label: 'フローリング（平方フィート）', standard: 12.5, premium: 18, artisan: 32 },
  { label: '造作収納（1フィート）', standard: 220, premium: 380, artisan: 650 },
]

const defaultAdminCategories: AdminCategoryCard[] = categories.map((category) => ({
  id: category.id,
  label: category.label,
  description: category.description,
  heroLabel: category.heroLabel,
  meta: '8件の設定が有効',
}))

const defaultAdminProducts: AdminProduct[] = Object.entries(equipmentCatalog).flatMap(([categoryId, items]) =>
  items.map((item) => ({
    ...item,
    categoryId: categoryId as CategoryId,
  })),
)

function isFixedCategoryId(id: string): id is CategoryId {
  return categoryOrder.includes(id as CategoryId)
}

const numberFormatter = new Intl.NumberFormat('ja-JP')

function readStoredSubmissions() {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as SubmissionRecord[]
  } catch {
    return []
  }
}

function writeStoredSubmissions(records: SubmissionRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

function readStoredConfig(): SimulatorConfigPayload | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SimulatorConfigPayload
  } catch {
    return null
  }
}

function writeStoredConfig(config: SimulatorConfigPayload) {
  window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
}

function formatCurrency(value: number) {
  return `¥${numberFormatter.format(Math.round(value))}`
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function parsePriceInput(value: string) {
  const numeric = Number(value.replace(/[^\d.]/g, ''))
  return Number.isFinite(numeric) ? numeric : 0
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^\w.-]/g, '_')
}

function mapSupabaseRow(row: SupabaseSubmissionRow): SubmissionRecord {
  return {
    id: row.id,
    category: row.category,
    plan: row.plan,
    grade: row.grade,
    area: row.area,
    options: row.options ?? [],
    prefecture: row.prefecture,
    city: row.city,
    timing: row.timing,
    notes: row.notes,
    customerName: row.customer_name,
    email: row.email,
    phone: row.phone,
    imageNames: row.image_names ?? [],
    uploadedImages: row.uploaded_images ?? [],
    selectedProducts: row.selected_products ?? [],
    estimatedLow: row.estimated_low,
    estimatedHigh: row.estimated_high,
    submittedAt: new Date(row.submitted_at).toLocaleString('ja-JP'),
    status: row.status ?? 'pending',
  }
}

function mapPayloadToSupabase(payload: SubmissionPayload, uploadedImages: string[]) {
  return {
    category: payload.category,
    plan: payload.plan,
    grade: payload.grade,
    area: payload.area,
    options: payload.options,
    prefecture: payload.prefecture,
    city: payload.city,
    timing: payload.timing,
    notes: payload.notes,
    customer_name: payload.customerName,
    email: payload.email,
    phone: payload.phone,
    image_names: payload.imageNames,
    uploaded_images: uploadedImages,
    selected_products: payload.selectedProducts ?? [],
    estimated_low: payload.estimatedLow,
    estimated_high: payload.estimatedHigh,
    status: payload.status ?? 'pending',
  }
}

async function fetchSubmissionsFromSupabase() {
  if (!supabase || !isSupabaseConfigured) throw new Error('supabase is not configured')
  const { data, error } = await supabase
    .from('estimate_submissions')
    .select('*')
    .order('submitted_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row: SupabaseSubmissionRow) => mapSupabaseRow(row))
}

async function uploadFilesToSupabase(files: File[]) {
  if (!supabase || !isSupabaseConfigured) throw new Error('supabase is not configured')

  const uploadedUrls: string[] = []

  for (const file of files) {
    const objectPath = `public/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
    const { error } = await supabase.storage.from(supabaseBucket).upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (error) throw error

    const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(objectPath)
    uploadedUrls.push(data.publicUrl)
  }

  return uploadedUrls
}

async function submitToSupabase(payload: SubmissionPayload, files: File[]) {
  if (!supabase || !isSupabaseConfigured) throw new Error('supabase is not configured')

  const uploadedImages = files.length > 0 ? await uploadFilesToSupabase(files) : payload.uploadedImages ?? []
  const row = mapPayloadToSupabase(payload, uploadedImages)
  const { data, error } = await supabase
    .from('estimate_submissions')
    .insert(row)
    .select('*')
    .single()

  if (error) throw error
  return mapSupabaseRow(data as SupabaseSubmissionRow)
}

function getDataSourceBadge(source: DataSource) {
  if (source === 'supabase') return { tone: 'online', label: 'Supabase 接続中' }
  if (source === 'api') return { tone: 'online', label: 'API 接続中' }
  return { tone: 'offline', label: 'ローカル表示中' }
}

function downloadTextFile(filename: string, content: string, type = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function fetchSubmissionsFromApi() {
  const response = await fetch(`${API_BASE}/api/submissions`)
  if (!response.ok) throw new Error('failed to fetch submissions')
  return (await response.json()) as SubmissionRecord[]
}

async function submitToApi(payload: SubmissionPayload, files: File[]) {
  const body = new FormData()
  body.append('payload', JSON.stringify(payload))
  files.forEach((file) => body.append('images', file))
  const response = await fetch(`${API_BASE}/api/submissions`, { method: 'POST', body })
  if (!response.ok) throw new Error('failed to submit')
  return (await response.json()) as SubmissionRecord
}

async function updateSubmissionInSupabase(record: SubmissionRecord) {
  if (!supabase || !isSupabaseConfigured) throw new Error('supabase is not configured')

  const { data, error } = await supabase
    .from('estimate_submissions')
    .update({
      status: record.status ?? 'pending',
      notes: record.notes,
    })
    .eq('id', record.id)
    .select('*')
    .single()

  if (error) throw error
  return mapSupabaseRow(data as SupabaseSubmissionRow)
}

async function uploadProductImageToSupabase(file: File) {
  if (!supabase || !isSupabaseConfigured) throw new Error('supabase is not configured')
  const objectPath = `products/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
  const { error } = await supabase.storage.from(supabaseBucket).upload(objectPath, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) throw error

  const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(objectPath)
  return data.publicUrl
}

async function fetchSimulatorConfigFromSupabase() {
  if (!supabase || !isSupabaseConfigured) throw new Error('supabase is not configured')

  const { data, error } = await supabase
    .from('simulator_configs')
    .select('*')
    .eq('config_key', 'default')
    .maybeSingle()

  if (error) throw error
  return data as SupabaseConfigRow | null
}

async function saveSimulatorConfigToSupabase(config: SimulatorConfigPayload) {
  if (!supabase || !isSupabaseConfigured) throw new Error('supabase is not configured')

  const { error } = await supabase
    .from('simulator_configs')
    .upsert(
      {
        config_key: 'default',
        config_value: config,
      },
      { onConflict: 'config_key' },
    )

  if (error) throw error
}

function App() {
  const isEmbedded =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === '1'
  const [mainView, setMainView] = useState<MainView>('simulator')
  const [adminSection, setAdminSection] = useState<AdminSection>('requests')
  const [form, setForm] = useState<EstimateForm>(initialForm)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isCtaOpen, setIsCtaOpen] = useState(false)
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [dataSource, setDataSource] = useState<DataSource>('local')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [areaFilter, setAreaFilter] = useState<'all' | CategoryId>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRecord | null>(null)
  const [chartRange, setChartRange] = useState<'daily' | 'weekly'>('daily')
  const [configSavedMessage, setConfigSavedMessage] = useState('')
  const [pricingRows, setPricingRows] = useState<PricingRow[]>(defaultPricingRows)
  const [selectedProducts, setSelectedProducts] = useState<Record<CategoryId, string>>({
    kitchen: 'kitchen-lixil-ale',
    bath: 'bath-lixil-arise',
    washroom: 'wash-lixil-mv',
    toilet: 'toilet-lixil-ameju',
    interior: '',
  })
  const [adminCategories, setAdminCategories] = useState<AdminCategoryCard[]>(defaultAdminCategories)
  const [adminProducts, setAdminProducts] = useState<AdminProduct[]>(defaultAdminProducts)
  const [requestPage, setRequestPage] = useState(1)
  const [detailDraft, setDetailDraft] = useState<{ status: Status; notes: string }>({
    status: 'pending',
    notes: '',
  })
  const [productDraft, setProductDraft] = useState<AdminProduct>({
    id: '',
    categoryId: 'kitchen',
    maker: '',
    name: '',
    subtitle: '',
    price: 0,
    imageUrl: '',
    isVisible: true,
    badge: '',
  })
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [categoryDraft, setCategoryDraft] = useState<AdminCategoryCard>({
    ...defaultAdminCategories[0],
  })
  const dataSourceBadge = getDataSourceBadge(dataSource)

  useEffect(() => {
    let isMounted = true
    async function loadSubmissions() {
      try {
        if (isSupabaseConfigured) {
          const records = await fetchSubmissionsFromSupabase()
          if (!isMounted) return
          setSubmissions(records.length > 0 ? records : demoSubmissions)
          setDataSource('supabase')
          return
        }

        const records = await fetchSubmissionsFromApi()
        if (!isMounted) return
        setSubmissions(records.length > 0 ? records : demoSubmissions)
        setDataSource('api')
      } catch {
        if (!isMounted) return
        const localRecords = readStoredSubmissions()
        setSubmissions(localRecords.length > 0 ? localRecords : demoSubmissions)
        setDataSource('local')
      }
    }
    void loadSubmissions()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadConfig() {
      try {
        if (isSupabaseConfigured) {
          const row = await fetchSimulatorConfigFromSupabase()
          if (!isMounted || !row?.config_value) return
          setPricingRows(row.config_value.pricingRows ?? defaultPricingRows)
          setAdminCategories(row.config_value.adminCategories ?? defaultAdminCategories)
          setAdminProducts(row.config_value.adminProducts ?? defaultAdminProducts)
          writeStoredConfig({
            pricingRows: row.config_value.pricingRows ?? defaultPricingRows,
            adminCategories: row.config_value.adminCategories ?? defaultAdminCategories,
            adminProducts: row.config_value.adminProducts ?? defaultAdminProducts,
          })
          return
        }
      } catch {
        // Fall back to local config when the Supabase config table is not ready.
      }

      if (!isMounted) return
      const storedConfig = readStoredConfig()
      if (storedConfig) {
        setPricingRows(storedConfig.pricingRows ?? defaultPricingRows)
        setAdminCategories(storedConfig.adminCategories ?? defaultAdminCategories)
        setAdminProducts(storedConfig.adminProducts ?? defaultAdminProducts)
      }
    }

    void loadConfig()
    return () => {
      isMounted = false
    }
  }, [])

  const adminMetrics = useMemo(() => {
    const total = submissions.length
    const average = total === 0 ? 0 : submissions.reduce((sum, item) => sum + item.estimatedHigh, 0) / total
    const pending = submissions.filter((item) => item.status === 'pending').length
    return { total, average, pending }
  }, [submissions])

  const resolvedCategories = useMemo(() => {
    return categories.map((category) => {
      const override = adminCategories.find((item) => item.id === category.id)
      if (!override) return category
      return {
        ...category,
        label: override.label,
        description: override.description,
        heroLabel: override.heroLabel,
      }
    })
  }, [adminCategories])

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((submission) => {
      const matchesQuery =
        searchQuery.trim() === '' ||
        submission.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (resolvedCategories.find((item) => item.id === submission.category)?.label ?? '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase())

      const matchesArea = areaFilter === 'all' || submission.category === areaFilter
      const matchesStatus = statusFilter === 'all' || (submission.status ?? 'pending') === statusFilter

      return matchesQuery && matchesArea && matchesStatus
    })
  }, [areaFilter, resolvedCategories, searchQuery, statusFilter, submissions])

  const catalogByCategory = useMemo(() => {
    return categoryOrder.reduce<Record<CategoryId, EquipmentItem[]>>((accumulator, categoryId) => {
      accumulator[categoryId] = adminProducts
        .filter((product) => product.categoryId === categoryId && product.isVisible !== false)
        .map(({ categoryId: _categoryId, ...product }) => product)
      return accumulator
    }, {} as Record<CategoryId, EquipmentItem[]>)
  }, [adminProducts])

  const estimate = useMemo(() => {
    const optionMultiplier = form.options.reduce((accumulator, optionId) => {
      const option = optionCatalog.find((item) => item.id === optionId)
      return option ? accumulator * option.multiplier : accumulator
    }, 1)
    const gradeMultiplier = gradeConfig[form.grade].multiplier
    const timingMultiplier = form.timing === 'asap' ? 1.08 : 1
    const sizeMultiplier = 1 + Math.max(form.area - 1, 0) * 0.1
    const selectedItems = categoryOrder
      .map((categoryId) => catalogByCategory[categoryId]?.find((item) => item.id === selectedProducts[categoryId]))
      .filter((item): item is EquipmentItem => Boolean(item))
    const baseTotal = selectedItems.reduce((sum, item) => sum + item.price, 0)
    const low = baseTotal * optionMultiplier * gradeMultiplier * timingMultiplier * sizeMultiplier
    return {
      low,
      high: low * 1.22,
      labor: low * 0.34,
      material: low * 0.66,
      duration: 5 + selectedItems.length * 2 + form.options.length,
      items: selectedItems,
    }
  }, [catalogByCategory, form.area, form.grade, form.options, form.timing, selectedProducts])

  const marketingInsights = useMemo(() => {
    const safeSubmissions = submissions
    const productCounts = new Map<string, { label: string; count: number }>()
    const categoryCounts = new Map<string, number>()
    const optionCounts = new Map<string, number>()
    let premiumCount = 0
    let urgentCount = 0
    let designCount = 0

    for (const submission of safeSubmissions) {
      categoryCounts.set(submission.category, (categoryCounts.get(submission.category) ?? 0) + 1)
      if (submission.grade !== 'standard') premiumCount += 1
      if (submission.timing === 'asap' || submission.timing === 'within3Months') urgentCount += 1
      if (submission.options.includes('design')) designCount += 1

      for (const optionId of submission.options) {
        optionCounts.set(optionId, (optionCounts.get(optionId) ?? 0) + 1)
      }

      const selected = submission.selectedProducts ?? []
      if (selected.length > 0) {
        for (const item of selected) {
          const current = productCounts.get(item.productId)
          productCounts.set(item.productId, {
            label: `${item.maker} ${item.productLabel}`,
            count: (current?.count ?? 0) + 1,
          })
        }
        continue
      }

      const fallbackProduct = adminProducts.find((item) => item.id === submission.plan)
      if (fallbackProduct) {
        const current = productCounts.get(fallbackProduct.id)
        productCounts.set(fallbackProduct.id, {
          label: `${fallbackProduct.maker} ${fallbackProduct.name}`,
          count: (current?.count ?? 0) + 1,
        })
      }
    }

    const total = safeSubmissions.length || 1
    const topCategories = [...categoryCounts.entries()]
      .map(([id, count]) => ({
        id,
        label: resolvedCategories.find((item) => item.id === id)?.label ?? id,
        count,
        rate: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    const topProducts = [...productCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5)

    const topOptions = [...optionCounts.entries()]
      .map(([id, count]) => ({
        id,
        label: optionCatalog.find((item) => item.id === id)?.label ?? id,
        count,
        rate: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)

    const premiumRate = Math.round((premiumCount / total) * 100)
    const urgentRate = Math.round((urgentCount / total) * 100)
    const designRate = Math.round((designCount / total) * 100)
    const strongestCategory = topCategories[0]
    const strongestOption = topOptions[0]
    const strongestProduct = topProducts[0]

    const recommendations = [
      strongestCategory
        ? `${strongestCategory.label} の訴求が最も強く、流入導線は ${strongestCategory.label} 特化LPや施工事例広告が有効です。`
        : 'カテゴリデータが増えると、優先投資すべき訴求軸を自動で判断できます。',
      strongestProduct
        ? `商品では ${strongestProduct.label} の関心が高いため、比較表・価格訴求・施工写真を前面に出すと反応を伸ばしやすいです。`
        : '商品選択データが増えると、メーカー別の人気分析ができます。',
      strongestOption
        ? `${strongestOption.label} の選択率が高く、セット提案やアップセルCTAに組み込む価値があります。`
        : 'オプション選択率を見て、アップセルの定番パターンを育てられます。',
      urgentRate >= 50
        ? '急ぎ案件が多いため、「最短着工」「即日概算」などスピード訴求の広告文が有効です。'
        : '急ぎ案件比率は高くないため、価格だけでなく事例や品質訴求も並行すると安定します。',
      premiumRate >= 50 || designRate >= 40
        ? 'プレミアム志向が強いので、安売りよりもデザイン事例・上位グレード比較の導線が向いています。'
        : '標準グレード中心なので、価格の分かりやすさと施工の安心感を前に出す訴求が向いています。',
    ]

    return {
      total,
      topCategories,
      topProducts,
      topOptions,
      premiumRate,
      urgentRate,
      designRate,
      recommendations,
    }
  }, [adminProducts, resolvedCategories, submissions])

  const pageSize = 5
  const totalRequestPages = Math.max(1, Math.ceil(filteredSubmissions.length / pageSize))
  const paginatedSubmissions = useMemo(() => {
    const start = (requestPage - 1) * pageSize
    return filteredSubmissions.slice(start, start + pageSize)
  }, [filteredSubmissions, requestPage])

  useEffect(() => {
    setRequestPage(1)
  }, [searchQuery, areaFilter, statusFilter])

  useEffect(() => {
    if (requestPage > totalRequestPages) {
      setRequestPage(totalRequestPages)
    }
  }, [requestPage, totalRequestPages])

  useEffect(() => {
    if (!selectedSubmission) return
    setDetailDraft({
      status: selectedSubmission.status ?? 'pending',
      notes: selectedSubmission.notes ?? '',
    })
  }, [selectedSubmission])

  useEffect(() => {
    if (adminCategories.some((category) => category.id === categoryDraft.id)) return
    if (adminCategories[0]) {
      setCategoryDraft(adminCategories[0])
    }
  }, [adminCategories, categoryDraft.id])

  function updateForm<K extends keyof EstimateForm>(key: K, value: EstimateForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleOption(optionId: string) {
    setForm((current) => {
      const exists = current.options.includes(optionId)
      return {
        ...current,
        options: exists ? current.options.filter((item) => item !== optionId) : [...current.options, optionId],
      }
    })
  }

  function selectProduct(categoryId: CategoryId, productId: string) {
    setForm((current) => ({
      ...current,
      category: categoryId,
      plan: productId,
    }))
    setSelectedProducts((current) => ({
      ...current,
      [categoryId]: current[categoryId] === productId ? '' : productId,
    }))
  }

  function loadDemoSimulator() {
    setForm(initialForm)
    setSelectedFiles([])
    setSelectedProducts({
      kitchen: 'kitchen-lixil-ale',
      bath: 'bath-lixil-arise',
      washroom: 'wash-lixil-mv',
      toilet: 'toilet-lixil-ameju',
      interior: '',
    })
    setMainView('simulator')
  }

  function loadDemoAdmin(section: AdminSection) {
    setSubmissions(demoSubmissions)
    writeStoredSubmissions(demoSubmissions)
    setDataSource('local')
    setMainView('admin')
    setAdminSection(section)
  }

  function showAdminMessage(message: string) {
    setConfigSavedMessage(message)
    window.setTimeout(() => setConfigSavedMessage(''), 3000)
  }

  function openConfigCreator() {
    setMainView('admin')
    setAdminSection('config')
    showAdminMessage('新規設定の追加画面を開きました。カテゴリ追加または単価設定から編集を始めてください。')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updatePricingRow(index: number, key: keyof Omit<PricingRow, 'label'>, rawValue: string) {
    setPricingRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: parsePriceInput(rawValue) } : row,
      ),
    )
  }

  function exportCsv() {
    const header = ['顧客名', '受付日', '依頼箇所', '見積上限', 'ステータス']
    const rows = filteredSubmissions.map((submission) => [
      submission.customerName,
      submission.submittedAt,
      resolvedCategories.find((item) => item.id === submission.category)?.label ?? '',
      `${submission.estimatedHigh}`,
      statusLabels[submission.status ?? 'pending'].label,
    ])
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'estimate-requests.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  function saveConfig() {
    persistSimulatorConfig({
      pricingRows,
      adminCategories,
      adminProducts,
    })
  }

  function resetConfig() {
    const payload = {
      pricingRows: defaultPricingRows,
      adminCategories: defaultAdminCategories,
      adminProducts: defaultAdminProducts,
    }
    setPricingRows(defaultPricingRows)
    setAdminCategories(defaultAdminCategories)
    setAdminProducts(defaultAdminProducts)
    setCategoryDraft({ ...defaultAdminCategories[0] })
    persistSimulatorConfig(payload, '初期値に戻して保存しました。')
  }

  function addCategoryCard() {
    const nextIndex = adminCategories.length + 1
    const nextDraft = {
      id: `draft-${Date.now()}`,
      label: `新規カテゴリ ${nextIndex}`,
      description: '新しいカテゴリ案の説明を入力してください。',
      heroLabel: `NEW-${nextIndex}`,
      meta: '下書き',
    }
    setAdminCategories((current) => [...current, nextDraft])
    setCategoryDraft(nextDraft)
    showAdminMessage('新規カテゴリの下書きを追加しました。内容を入力して保存できます。')
  }

  function editCategoryCard(categoryId: string) {
    const target = adminCategories.find((category) => category.id === categoryId)
    if (!target) return
    setCategoryDraft(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    showAdminMessage('カテゴリ編集モードに切り替えました。内容を直して保存してください。')
  }

  function saveCategoryCard() {
    if (!categoryDraft.label || !categoryDraft.description || !categoryDraft.heroLabel) {
      showAdminMessage('カテゴリ名、説明文、表示ラベルは入力してください。')
      return
    }

    setAdminCategories((current) =>
      current.map((category) => (category.id === categoryDraft.id ? categoryDraft : category)),
    )
    showAdminMessage('カテゴリ設定を更新しました。変更を反映で保存できます。')
  }

  function removeCategoryCard(categoryId: string) {
    if (isFixedCategoryId(categoryId)) {
      showAdminMessage('標準カテゴリは削除できません。名前や説明の編集で調整してください。')
      return
    }

    setAdminCategories((current) => current.filter((category) => category.id !== categoryId))
    if (categoryDraft.id === categoryId) {
      setCategoryDraft({ ...defaultAdminCategories[0] })
    }
    showAdminMessage('カテゴリ下書きを削除しました。')
  }

  function resetCategoryDraft() {
    setCategoryDraft({ ...defaultAdminCategories[0] })
    showAdminMessage('カテゴリ編集内容をリセットしました。')
  }

  async function addProductCard() {
    if (!productDraft.maker || !productDraft.name || !productDraft.subtitle || productDraft.price <= 0) {
      showAdminMessage('商品登録にはメーカー名、商品名、説明、価格の入力が必要です。')
      return
    }

    let imageUrl = productDraft.imageUrl || undefined

    if (productImageFile) {
      if (!isSupabaseConfigured) {
        showAdminMessage('画像ファイルのアップロードにはSupabase設定が必要です。画像URL入力をご利用ください。')
        return
      }

      try {
        imageUrl = await uploadProductImageToSupabase(productImageFile)
      } catch {
        showAdminMessage('商品画像のアップロードに失敗しました。')
        return
      }
    }

    const nextProduct: AdminProduct =
      productDraft.id !== ''
        ? {
            ...productDraft,
            badge: productDraft.badge || undefined,
            imageUrl,
          }
        : {
            ...productDraft,
            id: `${productDraft.categoryId}-${Date.now()}`,
            badge: productDraft.badge || undefined,
            imageUrl,
          }

    setAdminProducts((current) =>
      productDraft.id !== ''
        ? current.map((product) => (product.id === productDraft.id ? nextProduct : product))
        : [...current, nextProduct],
    )
    setProductDraft({
      id: '',
      categoryId: productDraft.categoryId,
      maker: '',
      name: '',
      subtitle: '',
      price: 0,
      imageUrl: '',
      isVisible: true,
      badge: '',
    })
    setProductImageFile(null)
    showAdminMessage(productDraft.id !== '' ? '商品を更新しました。変更を反映で保存できます。' : '商品を追加しました。変更を反映で保存できます。')
  }

  function removeProduct(productId: string) {
    setAdminProducts((current) => current.filter((product) => product.id !== productId))
    showAdminMessage('商品を削除しました。変更を反映で保存できます。')
  }

  function moveProduct(productId: string, direction: 'up' | 'down') {
    setAdminProducts((current) => {
      const index = current.findIndex((product) => product.id === productId)
      if (index === -1) return current
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(targetIndex, 0, item)
      return next
    })
    showAdminMessage(direction === 'up' ? '商品を上へ移動しました。' : '商品を下へ移動しました。')
  }

  function editProduct(productId: string) {
    const target = adminProducts.find((product) => product.id === productId)
    if (!target) return
    setProductDraft(target)
    setProductImageFile(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    showAdminMessage('商品編集モードに切り替えました。内容を直して「商品を更新」を押してください。')
  }

  function toggleProductVisibility(productId: string) {
    setAdminProducts((current) =>
      current.map((product) =>
        product.id === productId ? { ...product, isVisible: product.isVisible === false } : product,
      ),
    )
    showAdminMessage('商品の公開状態を切り替えました。変更を反映で保存できます。')
  }

  function persistSimulatorConfig(payload: SimulatorConfigPayload, successMessage = '設定内容を反映しました。') {
    writeStoredConfig(payload)

    void (async () => {
      try {
        if (isSupabaseConfigured) {
          await saveSimulatorConfigToSupabase(payload)
          showAdminMessage(successMessage.replace('反映しました。', 'Supabaseへ保存しました。'))
          return
        }
      } catch {
        showAdminMessage('Supabase保存に失敗したため、ブラウザに保存しました。追加SQLを実行すると共有保存できます。')
        return
      }

      showAdminMessage(successMessage.replace('反映しました。', 'ブラウザに保存しました。'))
    })()
  }

  function downloadEstimateSummary() {
    const lines = [
      '概算見積もりサマリー',
      `下限目安: ${formatCurrency(estimate.low)}`,
      `上限目安: ${formatCurrency(estimate.high)}`,
      `工事費: ${formatCurrency(estimate.labor)}`,
      `材料費: ${formatCurrency(estimate.material)}`,
      `想定工期: ${estimate.duration}日`,
      '',
      '選択設備',
      ...estimate.items.map((item) => `- ${item.maker} ${item.name} / ${formatCurrency(item.price)}`),
      '',
      `お客様名: ${form.customerName}`,
      `住所: ${form.prefecture}${form.city}`,
      `希望時期: ${timingLabels[form.timing]}`,
    ]
    downloadTextFile(`estimate-summary-${Date.now()}.txt`, lines.join('\n'))
  }

  function downloadDashboardReport() {
    const lines = [
      '運用ダッシュボードレポート',
      `総案件数: ${submissions.length}`,
      `平均案件単価: ${formatCurrency(adminMetrics.average)}`,
      `未対応件数: ${adminMetrics.pending}`,
      `データソース: ${dataSourceBadge.label}`,
    ]
    downloadTextFile(`dashboard-report-${Date.now()}.txt`, lines.join('\n'))
  }

  function downloadMarketingReport() {
    const lines = [
      'マーケティング分析レポート',
      `総送信件数: ${marketingInsights.total}`,
      `プレミアム志向率: ${marketingInsights.premiumRate}%`,
      `早期検討率: ${marketingInsights.urgentRate}%`,
      `デザイン提案選択率: ${marketingInsights.designRate}%`,
      '',
      '人気カテゴリ',
      ...marketingInsights.topCategories.map((item) => `- ${item.label}: ${item.count}件 (${item.rate}%)`),
      '',
      '人気商品',
      ...marketingInsights.topProducts.map((item) => `- ${item.label}: ${item.count}件`),
      '',
      '人気オプション',
      ...marketingInsights.topOptions.map((item) => `- ${item.label}: ${item.count}件 (${item.rate}%)`),
      '',
      '推奨施策',
      ...marketingInsights.recommendations.map((item, index) => `${index + 1}. ${item}`),
    ]
    downloadTextFile(`marketing-report-${Date.now()}.txt`, lines.join('\n'))
  }

  function openSupport() {
    window.open('mailto:webup.hatori@gmail.com?subject=ArtisanEstimator%20Support', '_blank', 'noopener,noreferrer')
  }

  function handleLogout() {
    setSelectedSubmission(null)
    setMainView('simulator')
    setIsCtaOpen(false)
  }

  async function saveSubmissionDetail() {
    if (!selectedSubmission) return

    const updatedRecord: SubmissionRecord = {
      ...selectedSubmission,
      status: detailDraft.status,
      notes: detailDraft.notes,
    }

    try {
      let savedRecord = updatedRecord

      if (dataSource === 'supabase' && isSupabaseConfigured) {
        savedRecord = await updateSubmissionInSupabase(updatedRecord)
      }

      const nextSubmissions = submissions.map((submission) =>
        submission.id === savedRecord.id ? savedRecord : submission,
      )
      setSubmissions(nextSubmissions)
      setSelectedSubmission(savedRecord)

      if (dataSource === 'local') {
        writeStoredSubmissions(nextSubmissions)
      }

      showAdminMessage('見積もり詳細を保存しました。')
    } catch {
      showAdminMessage('詳細保存に失敗しました。接続設定を確認してください。')
    }
  }

  function openConsultation(kind: 'reserve' | 'line' | 'support') {
    if (kind === 'reserve') {
      window.open('mailto:webup.hatori@gmail.com?subject=無料相談予約&body=相談予約を希望します。', '_blank', 'noopener,noreferrer')
      return
    }
    if (kind === 'line') {
      window.open('https://line.me/R/ti/p/@line', '_blank', 'noopener,noreferrer')
      return
    }
    openSupport()
  }

  function handleImagesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 5)
    setSelectedFiles(files)
    updateForm(
      'imageNames',
      files.map((file) => file.name),
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    const primaryCategory =
      categoryOrder.find((categoryId) => selectedProducts[categoryId]) ?? 'kitchen'
    const primaryProductId = selectedProducts[primaryCategory]
    const selectedProductSummaries = categoryOrder
      .map((categoryId) => {
        const productId = selectedProducts[categoryId]
        const product = catalogByCategory[categoryId]?.find((item) => item.id === productId)
        if (!product) return null
        return {
          categoryId,
          categoryLabel: resolvedCategories.find((item) => item.id === categoryId)?.label ?? categoryId,
          productId: product.id,
          productLabel: product.name,
          maker: product.maker,
          price: product.price,
        } satisfies SelectedProductSummary
      })
      .filter((item): item is SelectedProductSummary => Boolean(item))
    const payload = {
      ...form,
      category: primaryCategory,
      plan: primaryProductId || 'custom-package',
      selectedProducts: selectedProductSummaries,
      estimatedLow: Math.round(estimate.low),
      estimatedHigh: Math.round(estimate.high),
      notes:
        `${form.notes}\n選択設備: ` +
        estimate.items.map((item) => `${item.maker} ${item.name}`).join(' / '),
      status: 'pending' as Status,
    }

    try {
      let record: SubmissionRecord

      if (isSupabaseConfigured) {
        record = await submitToSupabase(payload, selectedFiles)
        setDataSource('supabase')
      } else {
        record = await submitToApi(payload, selectedFiles)
        setDataSource('api')
      }

      const next = [record, ...submissions]
      setSubmissions(next)
    } catch {
      try {
        const record = await submitToApi(payload, selectedFiles)
        const next = [record, ...submissions]
        setSubmissions(next)
        setDataSource('api')
      } catch {
        const record: SubmissionRecord = {
          ...payload,
          id: `${Date.now()}`,
          submittedAt: new Date().toLocaleDateString('ja-JP'),
        }
        const next = [record, ...submissions]
        setSubmissions(next)
        writeStoredSubmissions(next)
        setDataSource('local')
      }
    } finally {
      setMainView('admin')
      setAdminSection('requests')
      setIsSubmitting(false)
      setIsCtaOpen(false)
      setSelectedFiles([])
    }
  }

  return mainView === 'simulator' ? (
    <div className={`editorial-app ${isEmbedded ? 'embed-mode' : ''}`}>
      {!isEmbedded ? (
      <nav className="top-nav">
        <div className="brand">ArtisanEstimator</div>
        <div className="top-nav-links">
          <button className="top-link is-active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Simulator</button>
          <button className="top-link" onClick={() => document.getElementById('catalog-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Portfolio</button>
          <button className="top-link" onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Process</button>
        </div>
        <div className="top-nav-actions">
          <span className={`header-status ${dataSourceBadge.tone}`}>
            {dataSource === 'supabase' ? 'Supabase Live' : dataSource === 'api' ? 'API Live' : 'Demo Local'}
          </span>
          <button className="nav-button secondary" onClick={() => loadDemoAdmin('requests')}>
            Admin Portal
          </button>
        </div>
      </nav>
      ) : null}

      <main className={`sim-main ${isEmbedded ? 'sim-main-embed' : ''}`}>
        <header className="sim-hero">
          <span className="kicker">高品質な見積もり体験</span>
          <h1>
            理想の <span>リフォーム</span>
          </h1>
          <p>
            Translate your vision into a precise architectural estimate. フォーム体験とリアルタイム見積もり表示を、
            ご提示いただいたUIトーンに合わせて再調整しています。
          </p>
          <div className="hero-actions">
            <button className="nav-button primary" onClick={loadDemoSimulator}>
              デモを初期化
            </button>
            <button className="nav-button ghost" onClick={() => setIsCtaOpen(true)}>
              CTAを表示
            </button>
          </div>
        </header>

        <div className="sim-grid catalog-layout">
          <section className="sim-content">
            <div className="stepper">
              <div className="step-card active">
                <span>STEP 01</span>
                <strong>大きい設備から選ぶ</strong>
              </div>
              <div className="step-card">
                <span>STEP 02</span>
                <strong>細かな仕様を整える</strong>
              </div>
              <div className="step-card">
                <span>STEP 03</span>
                <strong>連絡先を送信</strong>
              </div>
            </div>

            <section className="sim-section" id="catalog-start">
              <div className="section-head">
                <div>
                  <h2>設備を上から順に選んでください</h2>
                  <p>キッチンや浴室など大きい設備から、下へ進みながらお好みの製品を選ぶ方式です。</p>
                </div>
              </div>

              <div className="selection-flow">
                <div className="flow-chip">1. キッチン</div>
                <div className="flow-chip">2. 浴室</div>
                <div className="flow-chip">3. 洗面化粧台</div>
                <div className="flow-chip">4. トイレ</div>
                <div className="flow-chip">5. 内装仕上げ</div>
              </div>
            </section>

            {categoryOrder.map((categoryId, index) => {
              const category = resolvedCategories.find((item) => item.id === categoryId) ?? resolvedCategories[0]
              const products = catalogByCategory[categoryId] ?? []
              const selectedProductId = selectedProducts[categoryId]

              return (
                <section key={categoryId} className="sim-section catalog-section">
                  <div className="section-head catalog-section-head">
                    <div>
                      <span className="catalog-step-label">STEP {String(index + 1).padStart(2, '0')}</span>
                      <h2>{category.label}設備を選ぶ</h2>
                      <p>{category.description}</p>
                    </div>
                    <span className="catalog-order-note">
                      {index === 0 ? '最初に選ぶ大型設備' : index === categoryOrder.length - 1 ? '最後に整える仕上げ項目' : '次の設備へ進めます'}
                    </span>
                  </div>

                  <div className="catalog-grid">
                    {products.length > 0 ? products.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className={`product-card ${selectedProductId === product.id ? 'selected' : ''}`}
                        onClick={() => selectProduct(categoryId, product.id)}
                      >
                        <div className="product-card-top">
                          <div>
                            <span className="product-maker">{product.maker}</span>
                            <strong>{product.name}</strong>
                          </div>
                          {product.badge ? <span className="product-badge">{product.badge}</span> : null}
                        </div>
                        {product.imageUrl ? (
                          <div className="product-image-wrap">
                            <img className="product-image" src={product.imageUrl} alt={product.name} />
                          </div>
                        ) : null}
                        <p>{product.subtitle}</p>
                        <div className="product-card-bottom">
                          <span className="product-price-label">参考価格</span>
                          <div className="product-price-row">
                            <span className="product-price">{formatCurrency(product.price)}</span>
                            <span className="product-tax">税込目安</span>
                          </div>
                        </div>
                        <span className="product-action">
                          {selectedProductId === product.id ? '選択中' : 'この設備を選ぶ'}
                        </span>
                      </button>
                    )) : (
                      <div className="catalog-empty">
                        <strong>{category.label}の商品がまだ登録されていません。</strong>
                        <p>管理画面の商品管理から、このカテゴリの商品を追加してください。</p>
                      </div>
                    )}
                  </div>
                </section>
              )
            })}

            <section className="sim-section" id="contact-form">
              <div className="section-head">
                <div>
                  <h2>工事条件とオプション</h2>
                  <p>選んだ設備に合わせて、工事条件と仕上げ方針を調整します。</p>
                </div>
              </div>

              <div className="option-grid">
                {optionCatalog.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`option-panel ${form.options.includes(option.id) ? 'selected' : ''}`}
                    onClick={() => toggleOption(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <p>{option.note}</p>
                  </button>
                ))}
              </div>

              <div className="controls-grid">
                <label className="field">
                    <span>工事規模</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={form.area}
                    onChange={(event) => updateForm('area', Number(event.target.value))}
                  />
                    <small>{form.area}段階</small>
                </label>
                <label className="field">
                    <span>仕上げグレード</span>
                  <select value={form.grade} onChange={(event) => updateForm('grade', event.target.value as Grade)}>
                    {Object.entries(gradeConfig).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                    <span>希望時期</span>
                  <select value={form.timing} onChange={(event) => updateForm('timing', event.target.value as Timing)}>
                    {Object.entries(timingLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="sim-section">
              <div className="section-head">
                <div>
                  <h2>最終確認</h2>
                  <p>お客様情報と現場写真を入力してください</p>
                </div>
              </div>

              <form className="contact-panel" onSubmit={handleSubmit}>
                <div className="controls-grid controls-grid-wide">
                  <label className="field">
                    <span>お名前</span>
                    <input value={form.customerName} onChange={(event) => updateForm('customerName', event.target.value)} />
                  </label>
                  <label className="field">
                    <span>電話番号</span>
                    <input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} />
                  </label>
                  <label className="field">
                    <span>都道府県</span>
                    <input value={form.prefecture} onChange={(event) => updateForm('prefecture', event.target.value)} />
                  </label>
                  <label className="field">
                    <span>市区町村</span>
                    <input value={form.city} onChange={(event) => updateForm('city', event.target.value)} />
                  </label>
                  <label className="field field-wide">
                    <span>メールアドレス</span>
                    <input type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} />
                  </label>
                  <label className="field field-wide">
                    <span>現場写真</span>
                    <input type="file" multiple accept="image/*" onChange={handleImagesSelected} />
                    <small>{form.imageNames.length > 0 ? form.imageNames.join(' / ') : 'ここにドロップ、またはクリックして追加'}</small>
                  </label>
                  <label className="field field-wide">
                    <span>ご要望</span>
                    <textarea rows={4} value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} />
                  </label>
                </div>
                <div className="submit-row">
                  <button type="button" className="nav-button ghost" onClick={() => setIsCtaOpen(true)}>
                    CTAを確認
                  </button>
                  <button type="submit" className="nav-button primary" disabled={isSubmitting}>
                    {isSubmitting ? '送信中...' : 'この内容で送信'}
                  </button>
                </div>
              </form>
            </section>
          </section>

          <aside className="sim-sidebar">
            <div className="estimate-card">
              <span className="small-kicker">概算見積もり</span>
              <div className="price-row">
                <strong>{formatCurrency(estimate.low)}</strong>
                <span>から</span>
              </div>
              <p className="estimate-range">上限目安 {formatCurrency(estimate.high)}</p>
              <div className="selection-summary">
                <p>選択中の設備</p>
                {estimate.items.length > 0 ? (
                  <ul>
                    {estimate.items.map((item) => (
                      <li key={item.id}>
                        <span>{item.maker}</span>
                        <strong>{item.name}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="selection-empty">まだ設備が選択されていません</span>
                )}
              </div>
              <div className="breakdown">
                <div className="breakdown-row">
                  <span>工事費</span>
                  <strong>{formatCurrency(estimate.labor)}</strong>
                </div>
                <div className="breakdown-row">
                  <span>材料費</span>
                  <strong>{formatCurrency(estimate.material)}</strong>
                </div>
                <div className="breakdown-row">
                  <span>想定工期</span>
                  <strong>{estimate.duration}日</strong>
                </div>
              </div>
              <div className="note-box">
                <p>
                  <strong>注記:</strong> 選択した設備の合計に、オプション、工事規模、時期を加味して概算を算出しています。
                </p>
              </div>
              <button className="download-button" onClick={downloadEstimateSummary}>概算PDFをダウンロード</button>
            </div>

            <div className="expert-card">
              <div>
                <h4>専門スタッフに相談しますか？</h4>
                <p>見積もり後に、プロジェクト担当へそのまま相談できる導線です。</p>
                <button className="link-button" onClick={() => openConsultation('reserve')}>無料相談へ進む</button>
              </div>
            </div>
          </aside>
        </div>
      </main>
      {isCtaOpen ? (
        <div className="cta-overlay" role="dialog" aria-modal="true">
          <div className="cta-modal">
            <button className="close-button" onClick={() => setIsCtaOpen(false)} aria-label="Close">
              ×
            </button>
            <span className="kicker">相談導線</span>
            <h3>内容を固めるご相談も可能です</h3>
            <p>概算表示後に、無料相談やLINE相談へ自然につなぐ想定のポップアップです。</p>
            <div className="cta-actions">
              <button className="nav-button primary" onClick={() => openConsultation('reserve')}>無料相談を予約</button>
              <button className="nav-button ghost" onClick={() => openConsultation('line')}>LINEで相談</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  ) : (
    <div className={`admin-app ${isEmbedded ? 'embed-mode' : ''}`}>
      {!isEmbedded ? (
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <h1>ArtisanEstimator</h1>
          <p>見積もり管理センター</p>
        </div>
        <div className="sidebar-profile">
          <div className="avatar solid">PO</div>
          <div>
            <strong>プロジェクト管理室</strong>
            <span>見積もり責任者</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <button className={adminSection === 'dashboard' ? 'active' : ''} onClick={() => setAdminSection('dashboard')}>
            ダッシュボード
          </button>
          <button className={adminSection === 'requests' ? 'active' : ''} onClick={() => setAdminSection('requests')}>
            見積もり依頼一覧
          </button>
          <button className={adminSection === 'config' ? 'active' : ''} onClick={() => setAdminSection('config')}>
            シミュレーター設定
          </button>
          <button onClick={() => setMainView('simulator')}>見積もり画面へ戻る</button>
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-cta" onClick={openConfigCreator}>新規設定を追加</button>
          <div className="sidebar-links">
            <button onClick={openSupport}>サポート</button>
            <button onClick={handleLogout}>ログアウト</button>
          </div>
        </div>
      </aside>
      ) : null}
      <main className={`admin-main ${isEmbedded ? 'admin-main-full' : ''}`}>
        {adminSection === 'requests' ? (
          <>
            <header className="admin-header">
              <div>
                <h2>見積もり依頼一覧</h2>
                <p>受信した見積もり依頼を一覧で管理します。</p>
              </div>
              <div className="admin-header-actions">
                <span className={`header-status ${dataSourceBadge.tone}`}>
                  {dataSourceBadge.label}
                </span>
                  <button className="light-button" onClick={exportCsv}>CSVを書き出す</button>
                <div className="admin-user-badge">
                  <div className="avatar solid">AU</div>
                  <div>
                    <strong>管理ユーザー</strong>
                    <span>見積もり責任者</span>
                  </div>
                </div>
              </div>
            </header>
            <section className="filter-panel">
                <input
                  className="search-input"
                  placeholder="顧客名や案件名で検索..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <div className="filter-actions">
                  <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value as 'all' | CategoryId)}>
                    <option value="all">すべての箇所</option>
                    {resolvedCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.label}</option>
                    ))}
                  </select>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | Status)}>
                    <option value="all">すべてのステータス</option>
                    <option value="pending">未対応</option>
                    <option value="contacted">連絡済み</option>
                    <option value="completed">完了</option>
                  </select>
                  <button
                    className="filter-button"
                    onClick={() => {
                      setSearchQuery('')
                      setAreaFilter('all')
                      setStatusFilter('all')
                    }}
                  >
                    リセット
                  </button>
                </div>
              </section>
            <section className="table-card">
              <table className="request-table">
                <thead>
                  <tr>
                    <th>顧客名</th>
                    <th>受付日</th>
                    <th>依頼箇所</th>
                    <th>見積金額</th>
                    <th>ステータス</th>
                    <th className="align-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                    {paginatedSubmissions.map((submission) => {
                    const status = statusLabels[submission.status ?? 'pending']
                    return (
                      <tr key={submission.id}>
                        <td>
                          <div className="person-cell">
                            <div className="avatar">{initials(submission.customerName)}</div>
                            <span>{submission.customerName}</span>
                          </div>
                        </td>
                        <td>{submission.submittedAt}</td>
                        <td>
                          <span className="tag">{resolvedCategories.find((item) => item.id === submission.category)?.label}</span>
                        </td>
                        <td className="mono">{formatCurrency(submission.estimatedHigh)}</td>
                        <td>
                          <span className={`status-pill-inline ${status.tone}`}>{status.label}</span>
                        </td>
                        <td className="align-right">
                            <button className="icon-button" onClick={() => setSelectedSubmission(submission)}>詳細</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="table-footer">
                  <span>{paginatedSubmissions.length}件を表示中 / 全{filteredSubmissions.length}件</span>
                <div className="pager">
                  <button className="light-button" disabled={requestPage === 1} onClick={() => setRequestPage((page) => Math.max(1, page - 1))}>
                    前へ
                  </button>
                  <button className="nav-button primary" disabled={requestPage === totalRequestPages} onClick={() => setRequestPage((page) => Math.min(totalRequestPages, page + 1))}>次のページ</button>
                </div>
              </div>
            </section>
            <section className="stats-grid">
              <div className="stat-card accent-tertiary">
                <p>成約率</p>
                <strong>64%</strong>
                <span>今月 +12%</span>
              </div>
              <div className="stat-card accent-primary">
                <p>平均案件単価</p>
                <strong>{formatCurrency(adminMetrics.average)}</strong>
                <span>前四半期比で安定</span>
              </div>
              <div className="stat-card accent-secondary">
                <p>未対応件数</p>
                <strong>{adminMetrics.pending}</strong>
                <span>対応が必要です</span>
              </div>
            </section>
          </>
        ) : null}
        {adminSection === 'dashboard' ? (
          <>
            <header className="admin-header">
              <div>
                <h2>運用ダッシュボード</h2>
                <p>問い合わせ状況と案件の動きをリアルタイムで確認できます。</p>
              </div>
              <div className="admin-header-actions">
                <div className="date-chip">2024年10月</div>
                <button className="light-button" onClick={downloadMarketingReport}>分析レポート</button>
                <button className="light-button" onClick={downloadDashboardReport}>ダウンロード</button>
              </div>
            </header>
            <section className="dashboard-grid">
              <div className="metric-panel">
                <p>今月の依頼件数</p>
                <strong>1,284</strong>
                <span>先月比 +12.4%</span>
              </div>
              <div className="metric-panel">
                <p>平均成約率</p>
                <strong>34.2%</strong>
                <span>安定推移</span>
              </div>
              <div className="metric-panel emphasis">
                <p>最も多い依頼</p>
                <strong>キッチン改装</strong>
                <span>842件</span>
              </div>
              <div className="chart-panel">
                <div className="panel-head">
                  <h3>問い合わせ推移</h3>
                  <div className="chart-tabs">
                    <button className={chartRange === 'daily' ? 'active' : ''} onClick={() => setChartRange('daily')}>日別</button>
                    <button className={chartRange === 'weekly' ? 'active' : ''} onClick={() => setChartRange('weekly')}>週別</button>
                  </div>
                </div>
                <div className="bar-chart">
                  {(chartRange === 'daily' ? [45, 65, 55, 85, 95, 40, 30] : [62, 74, 58, 88, 79, 67, 52]).map((height, index) => (
                    <div key={height} className="bar-wrap">
                      <div className={`bar ${index === 4 ? 'peak' : ''}`} style={{ height: `${height}%` }} />
                      <span>{chartRange === 'daily' ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][index] : ['1W', '2W', '3W', '4W', '5W', '6W', '7W'][index]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="activity-panel">
                <div className="panel-head">
                  <h3>進行中の案件</h3>
                  <button className="link-button dark" onClick={() => setAdminSection('requests')}>すべて見る</button>
                </div>
                <div className="activity-list">
                  {demoSubmissions.slice(0, 3).map((submission) => (
                    <div key={submission.id} className="activity-item">
                      <div className="avatar">{initials(submission.customerName)}</div>
                      <div>
                        <strong>{submission.customerName}</strong>
                        <p>{submission.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="health-panel">
                <div className="health-group">
                  <div className="health-dot green" />
                  <div>
                    <p>見積もり基盤</p>
                    <strong>正常稼働</strong>
                  </div>
                </div>
                <div className="health-group">
                  <div className="health-dot green" />
                  <div>
                    <p>DBレイテンシ</p>
                    <strong>24ms</strong>
                  </div>
                </div>
                <div className="health-group">
                  <div className="health-dot amber" />
                  <div>
                    <p>API負荷</p>
                    <strong>やや高負荷</strong>
                  </div>
                </div>
              </div>
              <div className="marketing-panel">
                <div className="panel-head">
                  <h3>選択傾向分析</h3>
                  <span className="date-chip">{marketingInsights.total}件を分析中</span>
                </div>
                <div className="marketing-metrics">
                  <div className="mini-metric">
                    <span>プレミアム志向</span>
                    <strong>{marketingInsights.premiumRate}%</strong>
                  </div>
                  <div className="mini-metric">
                    <span>早期検討率</span>
                    <strong>{marketingInsights.urgentRate}%</strong>
                  </div>
                  <div className="mini-metric">
                    <span>提案型ニーズ</span>
                    <strong>{marketingInsights.designRate}%</strong>
                  </div>
                </div>
                <div className="trend-columns">
                  <div>
                    <h4>人気カテゴリ</h4>
                    <ul className="insight-list">
                      {marketingInsights.topCategories.map((item) => (
                        <li key={item.id}>
                          <span>{item.label}</span>
                          <strong>{item.count}件 / {item.rate}%</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>人気商品</h4>
                    <ul className="insight-list">
                      {marketingInsights.topProducts.map((item) => (
                        <li key={item.label}>
                          <span>{item.label}</span>
                          <strong>{item.count}件</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>人気オプション</h4>
                    <ul className="insight-list">
                      {marketingInsights.topOptions.map((item) => (
                        <li key={item.id}>
                          <span>{item.label}</span>
                          <strong>{item.count}件 / {item.rate}%</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <div className="campaign-panel">
                <div className="panel-head">
                  <h3>推奨マーケ施策</h3>
                </div>
                <div className="campaign-list">
                  {marketingInsights.recommendations.map((item, index) => (
                    <div key={item} className="campaign-item">
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : null}
        {adminSection === 'config' ? (
          <>
            <header className="admin-header">
              <div>
                <h2>シミュレーター設定</h2>
                <p>見積もりロジック、単価、グレード設定を調整します。</p>
              </div>
              <div className="admin-header-actions">
                <button className="light-button" onClick={resetConfig}>変更を破棄</button>
                <button className="nav-button primary" onClick={saveConfig}>変更を反映</button>
              </div>
            </header>
            <section className="config-grid">
              <div className="config-main">
                <div className="config-card">
                  <div className="panel-head">
                    <div>
                      <h3>リフォームカテゴリ</h3>
                      <p>見積もり画面に表示するカテゴリ設定です。</p>
                    </div>
                    <button className="light-button" onClick={addCategoryCard}>カテゴリ追加</button>
                  </div>
                  <div className="category-admin-grid">
                    <div className="category-form-card">
                      <div className="panel-head">
                        <div>
                          <h3>カテゴリ編集</h3>
                          <p>見積もり画面に出るカテゴリ名や説明文を編集できます。</p>
                        </div>
                      </div>
                      <div className="controls-grid controls-grid-wide category-form-grid">
                        <label className="field">
                          <span>編集対象</span>
                          <select value={categoryDraft.id} onChange={(event) => editCategoryCard(event.target.value)}>
                            {adminCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>表示ラベル</span>
                          <input value={categoryDraft.heroLabel} onChange={(event) => setCategoryDraft((current) => ({ ...current, heroLabel: event.target.value }))} />
                        </label>
                        <label className="field">
                          <span>カテゴリ名</span>
                          <input value={categoryDraft.label} onChange={(event) => setCategoryDraft((current) => ({ ...current, label: event.target.value }))} />
                        </label>
                        <label className="field">
                          <span>補足メタ</span>
                          <input value={categoryDraft.meta} onChange={(event) => setCategoryDraft((current) => ({ ...current, meta: event.target.value }))} />
                        </label>
                        <label className="field field-wide">
                          <span>説明文</span>
                          <textarea rows={3} value={categoryDraft.description} onChange={(event) => setCategoryDraft((current) => ({ ...current, description: event.target.value }))} />
                        </label>
                      </div>
                      <div className="submit-row config-inline-actions">
                        <button className="nav-button primary" onClick={saveCategoryCard}>カテゴリを更新</button>
                        <button className="light-button" onClick={resetCategoryDraft}>入力をリセット</button>
                      </div>
                    </div>
                    {adminCategories.map((category) => (
                      <div key={category.id} className={`category-admin-card ${isFixedCategoryId(category.id) ? '' : 'is-draft'}`}>
                        <div className="category-admin-header">
                          <div className="category-admin-icon">{category.heroLabel}</div>
                          <div className="category-admin-actions">
                            <button className="light-button" onClick={() => editCategoryCard(category.id)}>編集</button>
                            <button className="light-button" onClick={() => removeCategoryCard(category.id)}>削除</button>
                          </div>
                        </div>
                        <h4>{category.label}</h4>
                        <p>{category.description}</p>
                        <div className="category-admin-meta">{category.meta}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="config-card">
                  <div className="panel-head">
                    <div>
                      <h3>価格マスタ</h3>
                      <p>グレードごとの基準単価を設定します。</p>
                    </div>
                  </div>
                  {configSavedMessage ? <div className="config-message">{configSavedMessage}</div> : null}
                  <div className="pricing-table">
                    {pricingRows.map((row, index) => (
                      <div key={row.label} className="pricing-row">
                        <div className="pricing-label">
                          <strong>{row.label}</strong>
                          <span>現在の基準単価</span>
                        </div>
                        <input value={`¥${row.standard.toLocaleString('ja-JP')}`} onChange={(event) => updatePricingRow(index, 'standard', event.target.value)} />
                        <input value={`¥${row.premium.toLocaleString('ja-JP')}`} onChange={(event) => updatePricingRow(index, 'premium', event.target.value)} />
                        <input value={`¥${row.artisan.toLocaleString('ja-JP')}`} onChange={(event) => updatePricingRow(index, 'artisan', event.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="config-card">
                  <div className="panel-head">
                    <div>
                      <h3>商品管理</h3>
                      <p>見積もり画面に表示する設備商品を登録します。</p>
                    </div>
                  </div>
                  <div className="controls-grid controls-grid-wide product-form-grid">
                    <label className="field">
                      <span>カテゴリ</span>
                      <select value={productDraft.categoryId} onChange={(event) => setProductDraft((current) => ({ ...current, categoryId: event.target.value as CategoryId }))}>
                        {resolvedCategories.map((category) => (
                          <option key={category.id} value={category.id}>{category.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>メーカー</span>
                      <input value={productDraft.maker} onChange={(event) => setProductDraft((current) => ({ ...current, maker: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>商品名</span>
                      <input value={productDraft.name} onChange={(event) => setProductDraft((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    <label className="field">
                      <span>価格</span>
                      <input value={productDraft.price ? `¥${productDraft.price.toLocaleString('ja-JP')}` : ''} onChange={(event) => setProductDraft((current) => ({ ...current, price: parsePriceInput(event.target.value) }))} />
                    </label>
                    <label className="field field-wide">
                      <span>説明文</span>
                      <input value={productDraft.subtitle} onChange={(event) => setProductDraft((current) => ({ ...current, subtitle: event.target.value }))} />
                    </label>
                    <label className="field field-wide">
                      <span>画像URL</span>
                      <input value={productDraft.imageUrl ?? ''} onChange={(event) => setProductDraft((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="https://..." />
                    </label>
                    <label className="field field-wide">
                      <span>画像ファイル</span>
                      <input type="file" accept="image/*" onChange={(event) => setProductImageFile(event.target.files?.[0] ?? null)} />
                      <small>{productImageFile ? productImageFile.name : 'Supabase設定時はファイルアップロードも使えます。'}</small>
                    </label>
                    <label className="field">
                      <span>公開状態</span>
                      <select value={productDraft.isVisible === false ? 'hidden' : 'visible'} onChange={(event) => setProductDraft((current) => ({ ...current, isVisible: event.target.value === 'visible' }))}>
                        <option value="visible">公開</option>
                        <option value="hidden">非公開</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>バッジ</span>
                      <input value={productDraft.badge ?? ''} onChange={(event) => setProductDraft((current) => ({ ...current, badge: event.target.value }))} placeholder="人気 / おすすめ" />
                    </label>
                  </div>
                  <div className="submit-row config-inline-actions">
                    <button className="nav-button primary" onClick={() => void addProductCard()}>{productDraft.id ? '商品を更新' : '商品を追加'}</button>
                    {productDraft.id ? <button className="light-button" onClick={() => { setProductDraft({ id: '', categoryId: 'kitchen', maker: '', name: '', subtitle: '', price: 0, imageUrl: '', isVisible: true, badge: '' }); setProductImageFile(null) }}>編集をキャンセル</button> : null}
                  </div>
                  <div className="product-admin-list">
                    {adminProducts.map((product) => (
                      <div key={product.id} className="product-admin-row">
                        <div className="product-admin-main">
                          {product.imageUrl ? <img className="product-admin-thumb" src={product.imageUrl} alt={product.name} /> : <div className="product-admin-thumb placeholder">NO IMAGE</div>}
                          <strong>{resolvedCategories.find((category) => category.id === product.categoryId)?.label} / {product.maker} {product.name}</strong>
                          <p>{product.subtitle}</p>
                        </div>
                        <div className="product-admin-meta">
                          <span className={`status-pill-inline ${product.isVisible === false ? 'status-amber' : 'status-green'}`}>{product.isVisible === false ? '非公開' : '公開中'}</span>
                          <span>{formatCurrency(product.price)}</span>
                          <button className="light-button" onClick={() => moveProduct(product.id, 'up')}>↑</button>
                          <button className="light-button" onClick={() => moveProduct(product.id, 'down')}>↓</button>
                          <button className="light-button" onClick={() => toggleProductVisibility(product.id)}>{product.isVisible === false ? '公開' : '非公開'}</button>
                          <button className="light-button" onClick={() => editProduct(product.id)}>編集</button>
                          <button className="light-button" onClick={() => removeProduct(product.id)}>削除</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <aside className="config-side">
                <div className="preview-card">
                  <span className="kicker invert">ライブプレビュー</span>
                  <h3>見積もりプレビュー</h3>
                  <p>未保存の変更内容を反映した状態です。</p>
                  <div className="preview-estimate">
                    <div>
                      <span>キッチン案件</span>
                      <strong>{formatCurrency(estimate.high)}</strong>
                    </div>
                    <div className="preview-bar">
                      <div className="preview-fill" />
                    </div>
                  </div>
                  <div className="preview-lines">
                    <div><span>造作収納</span><strong>{formatCurrency(156000)}</strong></div>
                    <div><span>標準仕上げ面材</span><strong>{formatCurrency(28500)}</strong></div>
                    <div className="preview-total"><span>合計見積</span><strong>{formatCurrency(estimate.high)}</strong></div>
                  </div>
                </div>
                <div className="version-card">
                  <h4>バージョン管理</h4>
                  <p>v2.4.1 本番環境</p>
                  <span>2カテゴリに対して14件の未保存変更があります。</span>
                </div>
              </aside>
            </section>
          </>
        ) : null}
        {selectedSubmission ? (
          <div className="cta-overlay" role="dialog" aria-modal="true">
            <div className="cta-modal detail-modal">
              <button className="close-button" onClick={() => setSelectedSubmission(null)} aria-label="閉じる">
                ×
              </button>
              <span className="kicker">見積もり詳細</span>
              <h3>{selectedSubmission.customerName}</h3>
              <div className="detail-grid">
                <div><span>受付日</span><strong>{selectedSubmission.submittedAt}</strong></div>
                <div><span>依頼箇所</span><strong>{resolvedCategories.find((item) => item.id === selectedSubmission.category)?.label}</strong></div>
                <div><span>見積もり下限</span><strong>{formatCurrency(selectedSubmission.estimatedLow)}</strong></div>
                <div><span>見積もり上限</span><strong>{formatCurrency(selectedSubmission.estimatedHigh)}</strong></div>
                <div>
                  <span>ステータス</span>
                  <select value={detailDraft.status} onChange={(event) => setDetailDraft((current) => ({ ...current, status: event.target.value as Status }))}>
                    <option value="pending">未対応</option>
                    <option value="contacted">連絡済み</option>
                    <option value="completed">完了</option>
                  </select>
                </div>
                <div><span>希望時期</span><strong>{timingLabels[selectedSubmission.timing]}</strong></div>
                <div><span>住所</span><strong>{selectedSubmission.prefecture}{selectedSubmission.city}</strong></div>
                <div><span>連絡先</span><strong>{selectedSubmission.phone}</strong></div>
                <div className="detail-wide"><span>メール</span><strong>{selectedSubmission.email}</strong></div>
                <div className="detail-wide">
                  <span>選択設備</span>
                  {selectedSubmission.selectedProducts && selectedSubmission.selectedProducts.length > 0 ? (
                    <div className="detail-chip-list">
                      {selectedSubmission.selectedProducts.map((item) => (
                        <span key={`${selectedSubmission.id}-${item.productId}`} className="tag">
                          {item.categoryLabel} / {item.maker} {item.productLabel}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <strong>記録なし</strong>
                  )}
                </div>
                <div className="detail-wide">
                  <span>画像</span>
                  {selectedSubmission.uploadedImages && selectedSubmission.uploadedImages.length > 0 ? (
                    <div className="detail-image-grid">
                      {selectedSubmission.uploadedImages.map((imageUrl, index) => (
                        <a key={imageUrl} href={imageUrl} target="_blank" rel="noreferrer" className="detail-image-card">
                          <img src={imageUrl} alt={`${selectedSubmission.customerName} の添付画像 ${index + 1}`} />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <strong>{selectedSubmission.imageNames.length > 0 ? selectedSubmission.imageNames.join(' / ') : 'なし'}</strong>
                  )}
                </div>
                <div className="detail-wide">
                  <span>メモ</span>
                  <textarea
                    rows={4}
                    value={detailDraft.notes}
                    onChange={(event) => setDetailDraft((current) => ({ ...current, notes: event.target.value }))}
                  />
                </div>
              </div>
              <div className="detail-actions">
                <button className="light-button" onClick={() => setSelectedSubmission(null)}>閉じる</button>
                <button className="nav-button primary" onClick={saveSubmissionDetail}>保存する</button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default App
