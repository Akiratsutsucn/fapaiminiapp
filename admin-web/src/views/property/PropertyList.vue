<template>
  <div class="page">
    <h2 class="page-title">房源管理</h2>
    <t-card>
      <div class="search-bar">
        <t-select v-model="filters.city_id" placeholder="城市" style="width:120px" @change="onCityChange">
          <t-option :value="0" label="全部城市" />
          <t-option :value="310000" label="上海" />
          <t-option :value="330200" label="宁波" />
        </t-select>
        <t-select v-model="filters.district" placeholder="区市" clearable style="width:140px" @change="onSearch">
          <t-option v-for="d in districtOptions" :key="d" :value="d" :label="d" />
        </t-select>
        <t-input v-model="filters.keyword" placeholder="搜索标题" clearable style="width:200px" @change="onSearch" />
        <t-select v-model="filters.auction_status" placeholder="拍卖状态" clearable style="width:140px" @change="onSearch">
          <t-option value="即将开拍" label="即将开拍" />
          <t-option value="进行中" label="进行中" />
          <t-option value="已结束" label="已结束" />
          <t-option value="已成交" label="已成交" />
          <t-option value="中止" label="中止" />
          <t-option value="撤回" label="撤回" />
        </t-select>
        <t-select v-model="filters.property_type" placeholder="物业类型" clearable style="width:120px" @change="onSearch">
          <t-option value="住宅" label="住宅" />
          <t-option value="商业" label="商业" />
          <t-option value="工业" label="工业" />
        </t-select>
        <t-select v-model="filters.auction_round" placeholder="拍卖轮次" clearable style="width:120px" @change="onSearch">
          <t-option value="一拍" label="一拍" />
          <t-option value="二拍" label="二拍" />
          <t-option value="变卖" label="变卖" />
          <t-option value="再次拍卖" label="再次拍卖" />
        </t-select>
        <t-select v-model="filters.area_range" placeholder="面积" clearable style="width:130px" @change="onAreaRangeChange">
          <t-option value="0-50" label="50㎡以下" />
          <t-option value="50-90" label="50-90㎡" />
          <t-option value="90-120" label="90-120㎡" />
          <t-option value="120-200" label="120-200㎡" />
          <t-option value="200-99999" label="200㎡以上" />
        </t-select>
        <t-select v-model="filters.price_range" placeholder="起拍价" clearable style="width:140px" @change="onPriceRangeChange">
          <t-option value="0-1000000" label="100万以下" />
          <t-option value="1000000-3000000" label="100-300万" />
          <t-option value="3000000-5000000" label="300-500万" />
          <t-option value="5000000-10000000" label="500-1000万" />
          <t-option value="10000000-99999999999" label="1000万以上" />
        </t-select>
        <t-button theme="primary" @click="loadData">查询</t-button>
        <t-button variant="outline" @click="router.push('/properties/edit')">手动添加</t-button>
        <t-button variant="outline" @click="() => onExport('xlsx')">导出 Excel</t-button>
        <t-button variant="outline" @click="() => onExport('csv')">导出 CSV</t-button>
        <t-button variant="outline" @click="showColumnPicker = true">列设置</t-button>
      </div>
      <t-table :data="list" :columns="visibleColumns" :loading="loading" row-key="id" :pagination="pagination" @page-change="onPageChange" :max-height="680" bordered>
        <template #source_link="{ row }">
          <a v-if="row.source_url" :href="toPcUrl(row.source_url, row.auction_platform)" target="_blank" class="source-link" :class="'link-' + platformKey(row.auction_platform)">{{ platformShort(row.auction_platform) }}</a>
          <span v-else class="no-link">--</span>
        </template>
        <template #auction_status="{ row }">
          <t-tag :theme="statusTheme(row.auction_status)">{{ row.auction_status }}</t-tag>
        </template>
        <template #op="{ row }">
          <t-space>
            <t-button variant="text" size="small" @click="router.push('/properties/edit/' + row.id)">编辑</t-button>
            <t-popconfirm content="确定删除？" @confirm="onDelete(row.id)">
              <t-button variant="text" size="small" theme="danger">删除</t-button>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <!-- 列选择器 -->
    <t-dialog v-model:visible="showColumnPicker" header="列设置 — 勾选要显示的列" width="560px" :footer="false">
      <div class="col-picker">
        <t-checkbox v-for="col in ALL_COLUMNS" :key="col.colKey" :checked="selectedCols.includes(col.colKey)" @change="(v: any) => toggleCol(col.colKey, v)">
          {{ col.title }}
        </t-checkbox>
      </div>
      <div style="margin-top:16px; text-align:right">
        <t-button size="small" variant="text" @click="resetCols">恢复默认</t-button>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { listProperties, deleteProperty, exportProperties } from '@/api/properties'

const router = useRouter()
const loading = ref(false)
const list = ref<any[]>([])
const filters = reactive({
  keyword: '', auction_status: '', property_type: '', city_id: 0,
  district: '', auction_round: '',
  area_range: '', area_min: undefined as number | undefined, area_max: undefined as number | undefined,
  price_range: '', price_min: undefined as number | undefined, price_max: undefined as number | undefined,
})

// 区市下拉：根据当前城市动态切换
const SH_DISTRICTS = ['黄浦区','徐汇区','长宁区','静安区','普陀区','虹口区','杨浦区','闵行区','宝山区','嘉定区','浦东新区','金山区','松江区','青浦区','奉贤区','崇明区']
const NB_DISTRICTS = ['海曙区','江北区','北仑区','镇海区','鄞州区','奉化区','余姚市','慈溪市','宁海县','象山县']
const districtOptions = computed(() => {
  if (filters.city_id === 310000) return SH_DISTRICTS
  if (filters.city_id === 330200) return NB_DISTRICTS
  return [...SH_DISTRICTS, ...NB_DISTRICTS]
})
const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  pageSizeOptions: [20, 50, 100],
  showPageSize: true,
})

// 全部 45 列定义（colKey 对应 Property 模型字段）
const ALL_COLUMNS = [
  { colKey: 'id', title: 'ID', width: 70 },
  { colKey: 'title', title: '标题', ellipsis: true, width: 240 },
  { colKey: 'source_link', title: '网站链接', width: 80 },
  { colKey: 'auction_platform', title: '拍卖平台', width: 100 },
  { colKey: 'city_id', title: '城市ID', width: 80 },
  { colKey: 'province_city', title: '省市', width: 80 },
  { colKey: 'district', title: '区', width: 80 },
  { colKey: 'sub_district', title: '板块', width: 90 },
  { colKey: 'ring_road', title: '环线', width: 80 },
  { colKey: 'address', title: '地址', ellipsis: true, width: 200 },
  { colKey: 'community_name', title: '小区名', ellipsis: true, width: 140 },
  { colKey: 'property_type', title: '物业类型', width: 90 },
  { colKey: 'area', title: '面积(m2)', width: 90 },
  { colKey: 'layout', title: '户型', width: 80 },
  { colKey: 'floor_info', title: '楼层', width: 70 },
  { colKey: 'total_floors', title: '总楼层', width: 70 },
  { colKey: 'has_elevator', title: '电梯', width: 60 },
  { colKey: 'orientation', title: '朝向', width: 70 },
  { colKey: 'decoration', title: '装修', width: 70 },
  { colKey: 'build_year', title: '建筑年代', width: 80 },
  { colKey: 'starting_price_wan', title: '起拍价(万)', width: 100 },
  { colKey: 'starting_unit_price', title: '起拍单价', width: 90 },
  { colKey: 'appraisal_price_wan', title: '评估价(万)', width: 100 },
  { colKey: 'court_discount_rate', title: '法院折扣率', width: 90 },
  { colKey: 'deposit_wan', title: '保证金(万)', width: 90 },
  { colKey: 'increment_amount', title: '加价幅度', width: 90 },
  { colKey: 'market_deal_price_wan', title: '市场成交价(万)', width: 110 },
  { colKey: 'market_deal_unit_price', title: '市场成交单价', width: 100 },
  { colKey: 'market_discount_rate', title: '市场折扣率', width: 90 },
  { colKey: 'listing_min_price_wan', title: '挂牌最低价(万)', width: 110 },
  { colKey: 'latest_deal_unit_price', title: '最新成交单价', width: 100 },
  { colKey: 'latest_total_price_wan', title: '最新总价(万)', width: 100 },
  { colKey: 'bargain_potential_wan', title: '捡漏空间(万)', width: 100 },
  { colKey: 'beike_latest_deal_unit_price', title: '贝壳成交单价', width: 100 },
  { colKey: 'beike_latest_deal_total_price_wan', title: '贝壳成交总价(万)', width: 120 },
  { colKey: 'beike_latest_deal_time', title: '贝壳成交时间', width: 130 },
  { colKey: 'auction_round', title: '拍卖轮次', width: 80 },
  { colKey: 'auction_status', title: '拍卖状态', width: 90 },
  { colKey: 'auction_start_time', title: '开拍时间', width: 160 },
  { colKey: 'auction_end_time', title: '结束时间', width: 160 },
  { colKey: 'court_name', title: '拍卖法院', ellipsis: true, width: 140 },
  { colKey: 'case_number', title: '案号', width: 120 },
  { colKey: 'view_count', title: '围观人数', width: 80 },
  { colKey: 'participant_count', title: '参拍人数', width: 80 },
  { colKey: 'loan_support', title: '支持贷款', width: 80 },
  { colKey: 'publish_date', title: '发布时间', width: 130 },
  { colKey: 'created_at', title: '入库时间', width: 160 },
  { colKey: 'op', title: '操作', width: 130, fixed: 'right' },
]

const DEFAULT_COLS = ['id', 'title', 'source_link', 'district', 'area', 'starting_price_wan', 'appraisal_price_wan', 'auction_round', 'auction_status', 'auction_start_time', 'op']

const STORAGE_KEY = 'fapai_prop_cols'
const showColumnPicker = ref(false)
const selectedCols = ref<string[]>(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || [...DEFAULT_COLS])

const visibleColumns = computed(() => ALL_COLUMNS.filter(c => selectedCols.value.includes(c.colKey)))

function toggleCol(key: string, checked: any) {
  const val = typeof checked === 'boolean' ? checked : checked?.valueOf?.() ?? false
  if (val) {
    if (!selectedCols.value.includes(key)) selectedCols.value.push(key)
  } else {
    selectedCols.value = selectedCols.value.filter(k => k !== key)
  }
}

function resetCols() {
  selectedCols.value = [...DEFAULT_COLS]
}

watch(selectedCols, (v) => { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)) }, { deep: true })

function statusTheme(s: string) {
  const m: Record<string, string> = { '即将开拍': 'primary', '进行中': 'danger', '已结束': 'default', '已成交': 'success', '中止': 'warning', '撤回': 'warning' }
  return m[s] || 'default'
}

function platformShort(p: string) {
  if (p?.includes('阿里') || p?.includes('淘宝')) return '阿里'
  if (p?.includes('京东')) return '京东'
  if (p?.includes('公拍')) return '公拍'
  return p || '--'
}

function platformKey(p: string) {
  if (p?.includes('阿里') || p?.includes('淘宝')) return 'ali'
  if (p?.includes('京东')) return 'jd'
  if (p?.includes('公拍')) return 'gpai'
  return 'default'
}

function toPcUrl(sourceUrl: string, platform: string): string {
  if (!sourceUrl) return ''
  // 阿里拍卖：移动端 → PC端
  if (platform?.includes('阿里') || platform?.includes('淘宝')) {
    const m = sourceUrl.match(/itemId=(\d+)/)
    if (m) return `https://sf-item.taobao.com/sf_item/${m[1]}.htm`
  }
  // 京东/公拍网本身就是 PC 链接，直接用
  return sourceUrl
}

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: pagination.current, page_size: pagination.pageSize }
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.auction_status) params.auction_status = filters.auction_status
    if (filters.property_type) params.property_type = filters.property_type
    if (filters.city_id) params.city_id = filters.city_id
    if (filters.district) params.district = filters.district
    if (filters.auction_round) params.auction_round = filters.auction_round
    if (filters.area_min !== undefined) params.area_min = filters.area_min
    if (filters.area_max !== undefined) params.area_max = filters.area_max
    if (filters.price_min !== undefined) params.price_min = filters.price_min
    if (filters.price_max !== undefined) params.price_max = filters.price_max
    const data = await listProperties(params)
    list.value = data.items.map((p: any) => ({
      ...p,
      starting_price_wan: p.starting_price ? (p.starting_price / 10000).toFixed(1) : '--',
      appraisal_price_wan: p.appraisal_price ? (p.appraisal_price / 10000).toFixed(1) : '--',
      deposit_wan: p.deposit ? (p.deposit / 10000).toFixed(1) : '--',
      market_deal_price_wan: p.market_deal_price ? (p.market_deal_price / 10000).toFixed(1) : '--',
      listing_min_price_wan: p.listing_min_price ? (p.listing_min_price / 10000).toFixed(1) : '--',
      latest_total_price_wan: p.latest_total_price ? (p.latest_total_price / 10000).toFixed(1) : '--',
      bargain_potential_wan: p.bargain_potential ? (p.bargain_potential / 10000).toFixed(1) : '--',
      beike_latest_deal_total_price_wan: p.beike_latest_deal_total_price ? (p.beike_latest_deal_total_price / 10000).toFixed(1) : '--',
      has_elevator: p.has_elevator === true ? '有' : p.has_elevator === false ? '无' : '--',
      loan_support: p.loan_support === true ? '是' : p.loan_support === false ? '否' : '--',
    }))
    pagination.total = data.total
  } finally { loading.value = false }
}

function onSearch() { pagination.current = 1; loadData() }

// 切换城市时清掉「区市」选择，避免出现宁波下选了上海的区
function onCityChange() {
  filters.district = ''
  onSearch()
}

// 解析「面积区间」select 值（"50-90"）为 area_min/area_max
function onAreaRangeChange() {
  if (!filters.area_range) {
    filters.area_min = undefined
    filters.area_max = undefined
  } else {
    const [a, b] = filters.area_range.split('-').map(Number)
    filters.area_min = a
    filters.area_max = b
  }
  onSearch()
}

// 解析「起拍价区间」（元为单位）
function onPriceRangeChange() {
  if (!filters.price_range) {
    filters.price_min = undefined
    filters.price_max = undefined
  } else {
    const [a, b] = filters.price_range.split('-').map(Number)
    filters.price_min = a
    filters.price_max = b
  }
  onSearch()
}
function onPageChange(p: any) {
  pagination.current = p.current
  if (p.pageSize && p.pageSize !== pagination.pageSize) {
    pagination.pageSize = p.pageSize
    pagination.current = 1
  }
  loadData()
}
async function onDelete(id: number) {
  await deleteProperty(id)
  MessagePlugin.success('已删除')
  loadData()
}
function onExport(format: 'xlsx' | 'csv' = 'xlsx') {
  const params: any = { format }
  if (filters.city_id) params.city_id = filters.city_id
  if (filters.auction_status) params.auction_status = filters.auction_status
  if (filters.keyword) params.keyword = filters.keyword
  if (filters.property_type) params.property_type = filters.property_type
  if (filters.district) params.district = filters.district
  if (filters.auction_round) params.auction_round = filters.auction_round
  if (filters.area_min !== undefined) params.area_min = filters.area_min
  if (filters.area_max !== undefined) params.area_max = filters.area_max
  if (filters.price_min !== undefined) params.price_min = filters.price_min
  if (filters.price_max !== undefined) params.price_max = filters.price_max
  exportProperties(params).then(res => {
    const url = URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url; a.download = `properties.${format}`; a.click()
  }).catch(() => {})
}
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
.search-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
.col-picker { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 16px; }
.source-link { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; text-decoration: none; color: #fff; }
.link-ali { background: #ff6a00; }
.link-jd { background: #e4393c; }
.link-gpai { background: #2d8cf0; }
.link-default { background: #999; }
.source-link:hover { opacity: 0.8; }
.no-link { color: #ccc; }
</style>
