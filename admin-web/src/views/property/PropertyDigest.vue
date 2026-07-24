<template>
  <div class="digest-page">
    <!-- 筛选栏 -->
    <t-card class="filter-card" :bordered="false">
      <div class="search-bar">
        <t-select v-model="filters.city_id" placeholder="城市" style="width:130px" @change="onCityChange">
          <t-option :value="0" label="全部城市" />
          <t-option :value="310000" label="上海" />
          <t-option :value="330200" label="宁波" />
          <t-option :value="330100" label="杭州" />
          <t-option :value="371300" label="临沂" />
        </t-select>
        <t-select v-model="filters.district" placeholder="区县" clearable style="width:150px" @change="onSearch">
          <t-option :value="''" label="全部区县" />
          <t-option v-for="d in districtOptions" :key="d" :value="d" :label="d" />
        </t-select>
        <div class="status-filter">
          <t-checkbox v-model="filters.statusLive" @change="onSearch">拍卖中</t-checkbox>
          <t-checkbox v-model="filters.statusUpcoming" @change="onSearch">即将开拍</t-checkbox>
        </div>
        <t-button theme="primary" @click="onSearch">查询</t-button>
        <t-button variant="outline" @click="onReset">重置</t-button>
        <div class="spacer"></div>
        <t-button theme="primary" :loading="exporting" @click="onExportPdf">导出 PDF</t-button>
      </div>
    </t-card>

    <!-- 可导出的清单区域(含品牌页眉 + 表格) -->
    <div ref="digestRef" class="digest-sheet">
      <!-- 品牌页眉 -->
      <div class="sheet-header">
        <div class="sheet-title-wrap">
          <div class="sheet-title">最新法拍房源捡漏清单</div>
          <div class="sheet-subtitle">
            <span v-if="cityLabel">{{ cityLabel }}</span>
            <span v-if="filters.district"> · {{ filters.district }}</span>
            <span v-if="rangeLabel"> · {{ rangeLabel }}</span>
            <span class="sheet-count">共 {{ pagination.total }} 套</span>
          </div>
        </div>
        <div class="brand-box">
          <img class="brand-logo" :src="logoUrl" alt="法拍者联盟" crossorigin="anonymous" />
          <span class="brand-name">法拍者联盟</span>
        </div>
      </div>

      <!-- 清单表格 -->
      <table class="digest-table">
        <thead>
          <tr>
            <th style="width:56px">城市</th>
            <th style="width:76px">区县</th>
            <th style="width:22%">法拍房源名称</th>
            <th style="width:120px">小区名</th>
            <th style="width:68px">面积(㎡)</th>
            <th style="width:92px">起拍价(万)</th>
            <th style="width:92px">评估价(万)</th>
            <th style="width:150px">开拍时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in list" :key="row.id" :class="{ 'row-alt': i % 2 === 1 }">
            <td>{{ cityName(row.city_id) }}</td>
            <td>{{ row.district || '-' }}</td>
            <td class="td-title">{{ row.title || '-' }}</td>
            <td>{{ row.community_name || '-' }}</td>
            <td>{{ fmtArea(row.area) }}</td>
            <td class="td-price">{{ fmtWan(row.starting_price) }}</td>
            <td>{{ fmtWan(row.appraisal_price) }}</td>
            <td class="td-time">
              <div>{{ fmtDate(row.auction_start_time) }}</div>
              <div class="td-time-end">至 {{ fmtDate(row.auction_end_time) }}</div>
            </td>
          </tr>
          <tr v-if="!loading && list.length === 0">
            <td colspan="8" class="empty-row">暂无符合条件的房源</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 隐藏的导出区域:渲染筛选出的全部房源,按页分块(每块带品牌页眉+表头),逐块生成PDF页 -->
    <div class="export-holder" ref="exportHolderRef" aria-hidden="true">
      <!-- 测量表:一次性渲染全部行,用于按实测行高动态分页 -->
      <table class="digest-table measuring-table" ref="measuringRef">
        <tbody>
          <tr v-for="row in exportRows" :key="'m'+row.id" data-mrow>
            <td style="width:56px">{{ cityName(row.city_id) }}</td>
            <td style="width:76px">{{ row.district || '-' }}</td>
            <td class="td-title" style="width:22%">{{ row.title || '-' }}</td>
            <td style="width:120px">{{ row.community_name || '-' }}</td>
            <td style="width:68px">{{ fmtArea(row.area) }}</td>
            <td class="td-price" style="width:92px">{{ fmtWan(row.starting_price) }}</td>
            <td style="width:92px">{{ fmtWan(row.appraisal_price) }}</td>
            <td class="td-time" style="width:150px">
              <div>{{ fmtDate(row.auction_start_time) }}</div>
              <div class="td-time-end">至 {{ fmtDate(row.auction_end_time) }}</div>
            </td>
          </tr>
        </tbody>
      </table>
      <div ref="exportRef">
        <div v-for="(chunk, ci) in exportChunks" :key="ci" class="export-page digest-sheet">
          <div class="sheet-header">
            <div class="sheet-title-wrap">
              <div class="sheet-title">最新法拍房源捡漏清单</div>
              <div class="sheet-subtitle">
                <span v-if="cityLabel">{{ cityLabel }}</span>
                <span v-if="filters.district"> · {{ filters.district }}</span>
                <span v-if="rangeLabel"> · {{ rangeLabel }}</span>
                <span class="sheet-count">共 {{ exportRows.length }} 套</span>
                <span class="sheet-page">第 {{ ci + 1 }}/{{ exportChunks.length }} 页</span>
              </div>
            </div>
            <div class="brand-box">
              <img class="brand-logo" :src="logoUrl" alt="法拍者联盟" crossorigin="anonymous" />
              <span class="brand-name">法拍者联盟</span>
            </div>
          </div>
          <table class="digest-table">
            <thead>
              <tr>
                <th style="width:56px">城市</th>
                <th style="width:76px">区县</th>
                <th style="width:22%">法拍房源名称</th>
                <th style="width:120px">小区名</th>
                <th style="width:68px">面积(㎡)</th>
                <th style="width:92px">起拍价(万)</th>
                <th style="width:92px">评估价(万)</th>
                <th style="width:150px">开拍时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in chunk" :key="row.id" :class="{ 'row-alt': i % 2 === 1 }">
                <td>{{ cityName(row.city_id) }}</td>
                <td>{{ row.district || '-' }}</td>
                <td class="td-title">{{ row.title || '-' }}</td>
                <td>{{ row.community_name || '-' }}</td>
                <td>{{ fmtArea(row.area) }}</td>
                <td class="td-price">{{ fmtWan(row.starting_price) }}</td>
                <td>{{ fmtWan(row.appraisal_price) }}</td>
                <td class="td-time">
                  <div>{{ fmtDate(row.auction_start_time) }}</div>
                  <div class="td-time-end">至 {{ fmtDate(row.auction_end_time) }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="pager">
      <t-pagination
        v-model="pagination.current"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        :page-size-options="[20, 50, 100]"
        @change="onPageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { listProperties } from '@/api/properties'
import logoUrl from '@/assets/logo.png'

const SH_DISTRICTS = ['黄浦区','徐汇区','长宁区','静安区','普陀区','虹口区','杨浦区','闵行区','宝山区','嘉定区','浦东新区','金山区','松江区','青浦区','奉贤区','崇明区']
const NB_DISTRICTS = ['海曙区','江北区','江东区','北仑区','镇海区','鄞州区','奉化区','余姚市','慈溪市','宁海县','象山县']
const HZ_DISTRICTS = ['上城区','下城区','江干区','拱墅区','西湖区','滨江区','萧山区','余杭区','临平区','钱塘区','富阳区','临安区','桐庐县','淳安县','建德市']
const LY_DISTRICTS = ['兰山区','罗庄区','河东区','沂南县','郯城县','沂水县','兰陵县','费县','平邑县','莒南县','蒙阴县','临沭县']
const CITY_NAMES: Record<number, string> = { 310000: '上海', 330200: '宁波', 330100: '杭州', 371300: '临沂' }

const filters = reactive({
  city_id: 0,
  district: '',
  statusLive: true,      // 拍卖中(进行中)
  statusUpcoming: true,  // 即将开拍
})
const list = ref<any[]>([])
const loading = ref(false)
const exporting = ref(false)
const digestRef = ref<HTMLElement | null>(null)
const exportRef = ref<HTMLElement | null>(null)
const exportHolderRef = ref<HTMLElement | null>(null)
const exportRows = ref<any[]>([])           // 导出用:筛选出的全部房源(单表测量高度)
const exportChunks = ref<any[][]>([])       // 按实测行高动态分页的结果
const measuringRef = ref<HTMLElement | null>(null)
// 每页表格行累计高度上限(px @820宽)。A4比例总高1160,减去页眉+表头+内边距开销后,
// 实测满页开销约345px(页眉/表头/padding),故行区上限取 780 确保满页总高≤1160不裁切。
const PAGE_CONTENT_PX = 780
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })

const districtOptions = computed(() => {
  if (filters.city_id === 310000) return SH_DISTRICTS
  if (filters.city_id === 330200) return NB_DISTRICTS
  if (filters.city_id === 330100) return HZ_DISTRICTS
  if (filters.city_id === 371300) return LY_DISTRICTS
  return [...SH_DISTRICTS, ...NB_DISTRICTS, ...HZ_DISTRICTS, ...LY_DISTRICTS]
})
const cityLabel = computed(() => filters.city_id ? CITY_NAMES[filters.city_id] || '' : '全部城市')
const rangeLabel = computed(() => {
  const parts: string[] = []
  if (filters.statusLive) parts.push('拍卖中')
  if (filters.statusUpcoming) parts.push('即将开拍')
  return parts.join('/')
})

function cityName(id: number) { return CITY_NAMES[id] || '-' }
function cityNameForFile() { return filters.city_id ? (CITY_NAMES[filters.city_id] || '') : '全部城市' }
function fmtArea(a: number | null) { return a ? String(Math.round(a)) : '-' }
function fmtWan(price: number | null) {
  if (!price || price <= 0) return '-'
  const wan = price / 10000
  return wan >= 10000 ? (wan / 10000).toFixed(2) + '亿' : wan.toFixed(1)
}
function fmtDate(s: string | null) {
  if (!s) return '-'
  const d = new Date(s.replace(' ', 'T'))
  if (isNaN(d.getTime())) return '-'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function buildBaseParams() {
  const params: any = { sort_by: 'digest' }
  if (filters.city_id) params.city_id = filters.city_id
  if (filters.district) params.district = filters.district
  // 状态复选 → auction_status(逗号分隔多值)。都不选时默认两者都要(仍限可参拍)
  const statuses: string[] = []
  if (filters.statusLive) statuses.push('进行中')
  if (filters.statusUpcoming) statuses.push('即将开拍')
  params.auction_status = (statuses.length ? statuses : ['进行中', '即将开拍']).join(',')
  return params
}

async function loadData() {
  loading.value = true
  try {
    const params: any = { ...buildBaseParams(), page: pagination.current, page_size: pagination.pageSize }
    const data: any = await listProperties(params)
    list.value = data.items || []
    pagination.total = data.total || 0
  } catch (e) {
    MessagePlugin.error('加载失败,请重试')
  } finally {
    loading.value = false
  }
}

function onSearch() { pagination.current = 1; loadData() }
function onReset() { filters.city_id = 0; filters.district = ''; filters.statusLive = true; filters.statusUpcoming = true; pagination.current = 1; loadData() }
function onCityChange() { filters.district = ''; onSearch() }
function onPageChange(pageInfo: any) {
  pagination.current = pageInfo.current
  if (pageInfo.pageSize && pageInfo.pageSize !== pagination.pageSize) {
    pagination.pageSize = pageInfo.pageSize
    pagination.current = 1
  }
  loadData()
}

// 拉取筛选条件下的全部房源(翻遍所有页)
async function fetchAllRows(): Promise<any[]> {
  const base = buildBaseParams()
  const pageSize = 100
  const all: any[] = []
  let page = 1
  let total = Infinity
  // 上限保护:最多 100 页(1万条),避免异常无限循环
  while (all.length < total && page <= 100) {
    const data: any = await listProperties({ ...base, page, page_size: pageSize })
    const items = data.items || []
    all.push(...items)
    total = data.total || 0
    if (items.length === 0) break
    page += 1
  }
  return all
}

async function onExportPdf() {
  if (pagination.total === 0) {
    MessagePlugin.warning('当前无数据可导出')
    return
  }
  exporting.value = true
  const loadingMsg = MessagePlugin.loading('正在生成 PDF,请稍候...', 0)
  try {
    // 1. 拉取筛选出的全部房源
    exportRows.value = await fetchAllRows()
    if (exportRows.value.length === 0) {
      MessagePlugin.warning('当前无数据可导出')
      return
    }
    // 2. 先渲染测量表,按实测行高动态分页(保证每页内容不超过A4高度,长标题也不溢出)
    exportChunks.value = []
    await nextTick()
    await new Promise(r => setTimeout(r, 30))
    const mrows = Array.from(measuringRef.value?.querySelectorAll('tr[data-mrow]') || []) as HTMLElement[]
    const rows = exportRows.value
    const chunks: any[][] = []
    let cur: any[] = []
    let curH = 0
    for (let i = 0; i < rows.length; i++) {
      const h = mrows[i]?.offsetHeight || 40
      if (cur.length > 0 && curH + h > PAGE_CONTENT_PX) {
        chunks.push(cur); cur = []; curH = 0
      }
      cur.push(rows[i]); curH += h
    }
    if (cur.length) chunks.push(cur)
    exportChunks.value = chunks

    // 3. 等待分页后的导出页渲染完成(导出区始终 opacity:0 隐藏,页面不闪现)
    await nextTick()
    // 等待logo图片加载完成,否则截图缺图
    const imgs = Array.from(exportRef.value?.querySelectorAll('img') || [])
    await Promise.all(imgs.map(img => (img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = () => res(null) }))))
    await new Promise(r => setTimeout(r, 60))
    const pages = exportRef.value?.querySelectorAll('.export-page')
    if (!pages || pages.length === 0) throw new Error('no export pages')

    // 逐块(每块=1个PDF页)截图,行不会被从中间切断。
    // 用 onclone 只在 html2canvas 克隆的离屏文档里把导出区改为可见 → 真实页面全程无闪现。
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()   // 210mm
    const pageH = pdf.internal.pageSize.getHeight()  // 297mm
    const marginX = 10
    const marginY = 10
    const maxW = pageW - marginX * 2
    for (let i = 0; i < pages.length; i++) {
      const el = pages[i] as HTMLElement
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: el.offsetWidth,
        height: el.offsetHeight,
        windowWidth: el.offsetWidth,
        onclone: (doc: Document) => {
          // 仅在克隆文档中让导出区可见,不影响用户当前页面
          const holder = doc.querySelector('.export-holder') as HTMLElement | null
          if (holder) { holder.style.opacity = '1'; holder.style.zIndex = '0' }
        },
      })
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      // 每页导出块均为固定 A4 比例(820x1160),始终按满宽放置 → 各页宽度完全一致
      const imgW = maxW
      const imgH = (canvas.height * imgW) / canvas.width
      if (i > 0) pdf.addPage()
      pdf.addImage(imgData, 'JPEG', marginX, marginY, imgW, imgH)
    }
    const today = new Date().toISOString().slice(0, 10)
    pdf.save(`最新法拍房源捡漏清单_${cityNameForFile()}_${today}.pdf`)
    MessagePlugin.success(`PDF 已导出(共 ${exportRows.value.length} 套 / ${pages.length} 页)`)
  } catch (e) {
    MessagePlugin.error('导出失败,请重试')
  } finally {
    loadingMsg.then((m: any) => m.close?.()).catch(() => {})
    exportRows.value = []
    exportChunks.value = []
    exporting.value = false
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.digest-page { padding: 16px; }
.filter-card { margin-bottom: 16px; }
.search-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.search-bar .spacer { flex: 1; }
.status-filter { display: flex; align-items: center; gap: 16px; padding: 0 4px; }

/* 导出区域:默认覆盖在视口左上但完全透明+不可交互(html2canvas能正确截取,用户看不到)。
   不能用 display:none 或 left:-99999px,否则html2canvas渲染错乱。 */
.export-holder {
  position: fixed;
  left: 0;
  top: 0;
  width: 820px;
  z-index: -1;
  opacity: 0;
  pointer-events: none;
  background: #ffffff;
}
/* 测量表:仅用于测行高。宽度=导出页内容区宽(820-48padding=772),绝对定位不占布局、不进截图 */
.measuring-table { position: absolute; top: 0; left: 0; width: 772px; visibility: hidden; }
/* 固定宽度820px(高度随内容自适应)。宽度一致 → 各页canvas宽高比一致 → PDF各页宽度统一。
   导出代码始终按满宽放置,不再因超高缩窄宽度,故各页宽度完全相同。 */
.export-page {
  width: 820px;
  margin-bottom: 20px;
  box-sizing: border-box;
  background: #ffffff;
  box-shadow: none !important;
  border-radius: 0 !important;
}
.sheet-page { margin-left: 12px; color: #8a97ad; font-weight: 500; }

/* 可导出清单区域:白底 */
.digest-sheet {
  background: #ffffff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(26, 47, 82, 0.08);
}

/* 品牌页眉 */
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 18px;
  margin-bottom: 18px;
  border-bottom: 3px solid #1a2f52;
}
.sheet-title { font-size: 26px; font-weight: 800; color: #1a2f52; letter-spacing: 2px; }
.sheet-subtitle { margin-top: 8px; font-size: 14px; color: #5a6b85; }
.sheet-count { margin-left: 12px; color: #1a56db; font-weight: 600; }
/* 右上角:白底 LOGO + 文字(无圆角/无边框) */
.brand-box {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #ffffff;
  padding: 4px 8px;
}
.brand-logo { width: 64px; height: 64px; object-fit: contain; }
.brand-name { font-size: 30px; font-weight: 800; color: #1a2f52; letter-spacing: 2px; }

/* 清单表格:蓝色风格 + 斑马纹 */
.digest-table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
.digest-table th {
  background: #1a2f52;
  color: #ffffff;
  font-weight: 600;
  padding: 12px 10px;
  text-align: left;
  border: 1px solid #24365c;
  white-space: nowrap;
}
.digest-table td {
  padding: 10px;
  color: #2a3550;
  border: 1px solid #e3e9f2;
  vertical-align: top;
}
.digest-table .row-alt td { background: #f2f6fc; }
.digest-table .td-title { color: #1a2f52; font-weight: 500; line-height: 1.5; word-break: break-all; }
.digest-table .td-price { color: #d4573e; font-weight: 700; }
.digest-table .td-time { font-size: 12px; color: #4a5a78; white-space: nowrap; }
.digest-table .td-time-end { color: #8a97ad; margin-top: 2px; }
.empty-row { text-align: center; color: #9aa5b8; padding: 40px 0 !important; }

.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
