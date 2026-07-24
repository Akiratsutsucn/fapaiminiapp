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
          <t-option v-for="d in districtOptions" :key="d" :value="d" :label="d" />
        </t-select>
        <t-date-range-picker
          v-model="filters.startRange"
          placeholder="开拍时间范围"
          clearable
          style="width:280px"
          @change="onSearch"
        />
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
            <th style="width:70px">城市</th>
            <th style="width:90px">区县</th>
            <th>法拍房源名称</th>
            <th style="width:130px">小区名</th>
            <th style="width:80px">面积(㎡)</th>
            <th style="width:110px">起拍价(万)</th>
            <th style="width:110px">评估价(万)</th>
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
import { ref, reactive, computed, onMounted } from 'vue'
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
  startRange: [] as string[],
})
const list = ref<any[]>([])
const loading = ref(false)
const exporting = ref(false)
const digestRef = ref<HTMLElement | null>(null)
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
  const [a, b] = filters.startRange || []
  if (a && b) return `${a} ~ ${b} 开拍`
  return ''
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

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: pagination.current, page_size: pagination.pageSize, sort_by: 'auction_start_time', sort_order: 'asc' }
    if (filters.city_id) params.city_id = filters.city_id
    if (filters.district) params.district = filters.district
    const [a, b] = filters.startRange || []
    if (a) params.start_from = a
    if (b) params.start_to = b
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
function onReset() { filters.city_id = 0; filters.district = ''; filters.startRange = []; pagination.current = 1; loadData() }
function onCityChange() { filters.district = ''; onSearch() }
function onPageChange(pageInfo: any) {
  pagination.current = pageInfo.current
  if (pageInfo.pageSize && pageInfo.pageSize !== pagination.pageSize) {
    pagination.pageSize = pageInfo.pageSize
    pagination.current = 1
  }
  loadData()
}

async function onExportPdf() {
  if (!digestRef.value || list.value.length === 0) {
    MessagePlugin.warning('当前无数据可导出')
    return
  }
  exporting.value = true
  try {
    const canvas = await html2canvas(digestRef.value, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgW = pageW
    const imgH = (canvas.height * imgW) / canvas.width
    let heightLeft = imgH
    let position = 0
    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH)
    heightLeft -= pageH
    while (heightLeft > 0) {
      position -= pageH
      pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH)
      heightLeft -= pageH
    }
    const today = new Date().toISOString().slice(0, 10)
    pdf.save(`最新法拍房源捡漏清单_${cityNameForFile()}_${today}.pdf`)
    MessagePlugin.success('PDF 已导出')
  } catch (e) {
    MessagePlugin.error('导出失败,请重试')
  } finally {
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
/* 右上角:白底 LOGO + 文字 */
.brand-box {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #ffffff;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #e3e9f2;
}
.brand-logo { width: 44px; height: 44px; object-fit: contain; }
.brand-name { font-size: 20px; font-weight: 700; color: #1a2f52; letter-spacing: 1px; }

/* 清单表格:蓝色风格 + 斑马纹 */
.digest-table { width: 100%; border-collapse: collapse; font-size: 13px; }
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
.digest-table .td-title { color: #1a2f52; font-weight: 500; line-height: 1.5; }
.digest-table .td-price { color: #d4573e; font-weight: 700; }
.digest-table .td-time { font-size: 12px; color: #4a5a78; white-space: nowrap; }
.digest-table .td-time-end { color: #8a97ad; margin-top: 2px; }
.empty-row { text-align: center; color: #9aa5b8; padding: 40px 0 !important; }

.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
