<template>
  <div class="page">
    <h2 class="page-title">{{ isEdit ? '编辑房源' : '添加房源' }}</h2>

    <t-card title="基本信息">
      <t-form :data="form" label-width="110px">
        <t-row :gutter="24">
          <t-col :span="8"><t-form-item label="标题"><t-input v-model="form.title" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="城市"><t-select v-model="form.city_id"><t-option :value="310000" label="上海" /><t-option :value="330200" label="宁波" /></t-select></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="区"><t-input v-model="form.district" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="板块"><t-input v-model="form.sub_district" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="环线"><t-input v-model="form.ring_road" /></t-form-item></t-col>
          <t-col :span="8"><t-form-item label="地址"><t-input v-model="form.address" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="小区名"><t-input v-model="form.community_name" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="省市"><t-input v-model="form.province_city" /></t-form-item></t-col>
        </t-row>
      </t-form>
    </t-card>

    <t-card title="建筑信息" style="margin-top:16px">
      <t-form :data="form" label-width="110px">
        <t-row :gutter="24">
          <t-col :span="3"><t-form-item label="物业类型"><t-select v-model="form.property_type"><t-option value="住宅" /><t-option value="商业" /><t-option value="工业" /><t-option value="办公" /><t-option value="土地" /></t-select></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="面积(m2)"><t-input-number v-model="form.area" :min="0" :decimal-places="2" /></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="户型"><t-input v-model="form.layout" /></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="楼层"><t-input v-model="form.floor_info" /></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="总楼层"><t-input-number v-model="form.total_floors" :min="0" /></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="电梯"><t-select v-model="form.has_elevator" :clearable="true"><t-option :value="true" label="有" /><t-option :value="false" label="无" /></t-select></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="朝向"><t-input v-model="form.orientation" /></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="装修"><t-input v-model="form.decoration" /></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="建筑年代"><t-input-number v-model="form.build_year" :min="1900" :max="2030" /></t-form-item></t-col>
        </t-row>
      </t-form>
    </t-card>

    <t-card title="拍卖价格" style="margin-top:16px">
      <t-form :data="form" label-width="110px">
        <t-row :gutter="24">
          <t-col :span="4"><t-form-item label="起拍价(元)"><t-input-number v-model="form.starting_price" :min="0" theme="normal" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="起拍单价"><t-input-number v-model="form.starting_unit_price" :min="0" :decimal-places="2" theme="normal" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="评估价(元)"><t-input-number v-model="form.appraisal_price" :min="0" theme="normal" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="法院折扣率"><t-input-number v-model="form.court_discount_rate" :min="0" :max="1" :step="0.01" :decimal-places="2" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="保证金(元)"><t-input-number v-model="form.deposit" :min="0" theme="normal" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="加价幅度(元)"><t-input-number v-model="form.increment_amount" :min="0" theme="normal" /></t-form-item></t-col>
        </t-row>
      </t-form>
    </t-card>

    <t-card title="市场价格" style="margin-top:16px">
      <t-form :data="form" label-width="130px">
        <t-row :gutter="24">
          <t-col :span="4"><t-form-item label="市场成交价(元)"><t-input-number v-model="form.market_deal_price" :min="0" theme="normal" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="市场成交单价"><t-input-number v-model="form.market_deal_unit_price" :min="0" :decimal-places="2" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="市场折扣率"><t-input-number v-model="form.market_discount_rate" :min="0" :max="1" :step="0.01" :decimal-places="2" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="挂牌最低价(元)"><t-input-number v-model="form.listing_min_price" :min="0" theme="normal" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="最新成交单价"><t-input-number v-model="form.latest_deal_unit_price" :min="0" :decimal-places="2" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="最新总价(元)"><t-input-number v-model="form.latest_total_price" :min="0" theme="normal" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="捡漏空间(元)"><t-input-number v-model="form.bargain_potential" :min="0" theme="normal" /></t-form-item></t-col>
        </t-row>
      </t-form>
    </t-card>

    <t-card title="贝壳参考" style="margin-top:16px">
      <t-form :data="form" label-width="130px">
        <t-row :gutter="24">
          <t-col :span="4"><t-form-item label="贝壳成交单价"><t-input-number v-model="form.beike_latest_deal_unit_price" :min="0" :decimal-places="2" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="贝壳成交总价(元)"><t-input-number v-model="form.beike_latest_deal_total_price" :min="0" theme="normal" /></t-form-item></t-col>
          <t-col :span="4"><t-form-item label="贝壳成交时间"><t-date-picker v-model="form.beike_latest_deal_time" enable-time-picker /></t-form-item></t-col>
        </t-row>
      </t-form>
    </t-card>

    <t-card title="拍卖信息" style="margin-top:16px">
      <t-form :data="form" label-width="110px">
        <t-row :gutter="24">
          <t-col :span="3"><t-form-item label="拍卖轮次"><t-select v-model="form.auction_round"><t-option value="一拍" /><t-option value="二拍" /><t-option value="变卖" /></t-select></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="拍卖状态"><t-select v-model="form.auction_status"><t-option value="即将开拍" /><t-option value="进行中" /><t-option value="已结束" /><t-option value="已成交" /><t-option value="中止" /><t-option value="撤回" /></t-select></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="开拍时间"><t-date-picker v-model="form.auction_start_time" enable-time-picker /></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="结束时间"><t-date-picker v-model="form.auction_end_time" enable-time-picker /></t-form-item></t-col>
          <t-col :span="6"><t-form-item label="拍卖法院"><t-input v-model="form.court_name" /></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="案号"><t-input v-model="form.case_number" /></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="围观人数"><t-input-number v-model="form.view_count" :min="0" /></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="参拍人数"><t-input-number v-model="form.participant_count" :min="0" /></t-form-item></t-col>
          <t-col :span="3"><t-form-item label="支持贷款"><t-select v-model="form.loan_support" :clearable="true"><t-option :value="true" label="是" /><t-option :value="false" label="否" /></t-select></t-form-item></t-col>
        </t-row>
      </t-form>
    </t-card>

    <t-card title="描述" style="margin-top:16px">
      <t-textarea v-model="form.description" :maxlength="2000" :autosize="{ minRows: 3, maxRows: 8 }" />
    </t-card>

    <!-- 小区详情（来自贝壳找房） -->
    <t-card v-if="isEdit" style="margin-top:16px">
      <template #title>
        <div class="ci-title-row">
          <span>小区详情</span>
          <span class="ci-source" v-if="community.info">数据来源：{{ community.info.source || '手工' }}</span>
        </div>
      </template>
      <template #actions>
        <t-button size="small" theme="primary" :loading="refreshingCommunity" @click="refreshCommunity">
          重新抓取（贝壳）
        </t-button>
      </template>

      <div v-if="!form.community_name" class="ci-empty">
        当前房源未识别小区名称，请先在「基本信息」中补充「小区名」后再抓取。
      </div>
      <div v-else-if="!community.info" class="ci-empty">
        小区 <b>{{ form.community_name }}</b> 暂无详情。点击右上角「重新抓取」从贝壳找房抓取。
      </div>
      <div v-else>
        <t-row :gutter="16" style="margin-bottom:12px">
          <t-col :span="3"><div class="ci-stat"><div class="ci-num accent">{{ formatPriceCN(community.info.avg_price) }}</div><div class="ci-label">参考均价 (元/㎡)</div></div></t-col>
          <t-col :span="3"><div class="ci-stat"><div class="ci-num">{{ community.info.build_year_start || '—' }}</div><div class="ci-label">建成年代</div></div></t-col>
          <t-col :span="3"><div class="ci-stat"><div class="ci-num">{{ community.info.total_units || '—' }}</div><div class="ci-label">总户数</div></div></t-col>
          <t-col :span="3"><div class="ci-stat"><div class="ci-num">{{ community.info.on_sale_count || '—' }}</div><div class="ci-label">在售房源</div></div></t-col>
        </t-row>

        <div class="ci-desc" v-if="community.info.description">
          {{ community.info.description }}
        </div>

        <t-row :gutter="24">
          <t-col :span="6"><div class="ci-row"><span class="ci-k">小区地址</span><span class="ci-v">{{ community.info.address_full || '—' }}</span></div></t-col>
          <t-col :span="6"><div class="ci-row"><span class="ci-k">物业类型</span><span class="ci-v">{{ community.info.property_type || '—' }}</span></div></t-col>
          <t-col :span="6"><div class="ci-row"><span class="ci-k">开发商</span><span class="ci-v">{{ community.info.developer || '—' }}</span></div></t-col>
          <t-col :span="6"><div class="ci-row"><span class="ci-k">物业公司</span><span class="ci-v">{{ community.info.property_company || '—' }}</span></div></t-col>
          <t-col :span="6"><div class="ci-row"><span class="ci-k">物业费</span><span class="ci-v">{{ community.info.property_fee || '—' }}</span></div></t-col>
          <t-col :span="6"><div class="ci-row"><span class="ci-k">容积率</span><span class="ci-v">{{ community.info.plot_ratio || '—' }}</span></div></t-col>
          <t-col :span="6"><div class="ci-row"><span class="ci-k">绿化率</span><span class="ci-v">{{ community.info.green_rate ? (community.info.green_rate * 100).toFixed(0) + '%' : '—' }}</span></div></t-col>
          <t-col :span="6"><div class="ci-row"><span class="ci-k">楼栋数</span><span class="ci-v">{{ community.info.total_buildings || '—' }}</span></div></t-col>
          <t-col :span="12"><div class="ci-row"><span class="ci-k">主力户型</span><span class="ci-v">{{ community.info.huxing_summary || '—' }}</span></div></t-col>
          <t-col :span="6"><div class="ci-row"><span class="ci-k">贝壳链接</span>
            <t-link v-if="community.info.beike_url" :href="community.info.beike_url" target="_blank" theme="primary">查看 ↗</t-link>
            <span v-else class="ci-v">—</span>
          </div></t-col>
          <t-col :span="6"><div class="ci-row"><span class="ci-k">最近抓取</span><span class="ci-v">{{ community.info.last_crawled_at || '—' }}</span></div></t-col>
        </t-row>
      </div>
    </t-card>

    <!-- 房源图片 -->
    <t-card v-if="isEdit" title="房源图片" style="margin-top:16px">
      <div class="file-gallery">
        <div class="file-item" v-for="(img, idx) in images" :key="idx">
          <img :src="img.image_url" class="gallery-img" />
          <t-button size="small" theme="danger" variant="text" @click="removeImage(idx)">删除</t-button>
        </div>
        <div class="upload-trigger" @click="triggerUpload('image')">
          <div class="upload-icon">+</div>
          <span>上传图片</span>
        </div>
      </div>
      <input ref="imageInput" type="file" accept="image/*" style="display:none" @change="onFileChange($event, 'image')" />
      <div class="upload-tip">支持 JPG/PNG/WebP/GIF，第一张为封面</div>
    </t-card>

    <!-- 附件文档 -->
    <t-card v-if="isEdit" title="附件文档" style="margin-top:16px">
      <div class="attachment-list">
        <div class="attachment-item" v-for="(att, idx) in attachments" :key="idx">
          <t-link :href="att.url" target="_blank">{{ att.filename }}</t-link>
          <span class="att-size">{{ formatSize(att.size) }}</span>
          <t-button size="small" theme="danger" variant="text" @click="removeAttachment(idx)">删除</t-button>
        </div>
        <div v-if="!attachments.length" class="empty-att">暂无附件</div>
      </div>
      <t-button variant="outline" style="margin-top:12px" @click="triggerUpload('doc')">上传附件</t-button>
      <input ref="docInput" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.txt" style="display:none" @change="onFileChange($event, 'doc')" />
      <div class="upload-tip">支持 PDF/Word/Excel/ZIP/TXT，单个不超过 20MB</div>
    </t-card>

    <div class="form-actions">
      <t-button theme="primary" size="large" :loading="submitting" @click="onSubmit">保存</t-button>
      <t-button variant="outline" size="large" @click="router.back()">取消</t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { getProperty, createProperty, updateProperty, getPropertyCommunity, refreshPropertyCommunity } from '@/api/properties'
import { uploadImage } from '@/api/upload'

const router = useRouter()
const route = useRoute()
const isEdit = ref(false)
const submitting = ref(false)
const images = ref<any[]>([])
const attachments = ref<any[]>([])
const imageInput = ref<HTMLInputElement>()
const docInput = ref<HTMLInputElement>()
const community = reactive<{ info: any | null }>({ info: null })
const refreshingCommunity = ref(false)

function formatPriceCN(n: number | null | undefined) {
  if (!n) return '—'
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

async function loadCommunity() {
  if (!isEdit.value) return
  try {
    const data: any = await getPropertyCommunity(route.params.id as string)
    community.info = data.info
  } catch (e) {
    community.info = null
  }
}

async function refreshCommunity() {
  if (!form.community_name) {
    MessagePlugin.warning('请先在基本信息中填入小区名')
    return
  }
  refreshingCommunity.value = true
  MessagePlugin.loading({ content: '正在从贝壳抓取，预计 5-15 秒…', duration: 0 })
  try {
    const r: any = await refreshPropertyCommunity(route.params.id as string)
    MessagePlugin.closeAll()
    if (r.matched) {
      MessagePlugin.success('小区详情已更新')
      await loadCommunity()
    } else {
      MessagePlugin.warning('未在贝壳找到匹配的小区，请检查小区名是否准确')
    }
  } catch (err: any) {
    MessagePlugin.closeAll()
    MessagePlugin.error(err.response?.data?.detail || '抓取失败')
  } finally {
    refreshingCommunity.value = false
  }
}

const form = reactive({
  title: '', province_city: '', city_id: 310000,
  district: '', sub_district: '', ring_road: '', address: '', community_name: '',
  property_type: '住宅', area: 0, layout: '', floor_info: '', total_floors: null as number | null,
  has_elevator: null as boolean | null, orientation: '', decoration: '', build_year: null as number | null,
  starting_price: 0, starting_unit_price: 0, appraisal_price: 0, court_discount_rate: 0,
  deposit: 0, increment_amount: 0,
  market_deal_price: 0, market_deal_unit_price: 0, market_discount_rate: 0,
  listing_min_price: 0, latest_deal_unit_price: 0, latest_total_price: 0, bargain_potential: 0,
  beike_latest_deal_unit_price: 0, beike_latest_deal_total_price: 0, beike_latest_deal_time: '',
  auction_round: '一拍', auction_status: '即将开拍',
  auction_start_time: '', auction_end_time: '',
  court_name: '', case_number: '',
  view_count: 0, participant_count: 0, loan_support: null as boolean | null,
  description: '',
})

onMounted(async () => {
  const id = route.params.id
  if (id) {
    isEdit.value = true
    try {
      const data: any = await getProperty(id as string)
      Object.assign(form, data)
      images.value = data.images || []
      attachments.value = JSON.parse(localStorage.getItem(`prop_att_${id}`) || '[]')
      await loadCommunity()
    } catch { router.push('/properties') }
  }
})

function triggerUpload(type: 'image' | 'doc') {
  if (type === 'image') imageInput.value?.click()
  else docInput.value?.click()
}

async function onFileChange(e: Event, type: 'image' | 'doc') {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const fd = new FormData()
  fd.append('file', file)
  try {
    MessagePlugin.loading('上传中…')
    const data = await uploadImage(fd)
    if (type === 'image') {
      images.value.push({
        image_url: data.url, thumb_url: data.url,
        is_cover: images.value.length === 0, sort_order: images.value.length,
      })
      await updateProperty(route.params.id as string, { images: images.value.map((img, i) => ({ ...img, sort_order: i })) })
      MessagePlugin.success('图片上传成功')
    } else {
      attachments.value.push({ url: data.url, filename: (data as any).filename || file.name, size: file.size })
      localStorage.setItem(`prop_att_${route.params.id}`, JSON.stringify(attachments.value))
      await updateProperty(route.params.id as string, { has_attachments: true })
      MessagePlugin.success('附件上传成功')
    }
  } catch (err: any) {
    MessagePlugin.error(err.response?.data?.detail || '上传失败')
  }
  (e.target as HTMLInputElement).value = ''
}

function removeImage(idx: number) {
  images.value.splice(idx, 1)
  updateProperty(route.params.id as string, { images: images.value.map((img, i) => ({ ...img, sort_order: i, is_cover: i === 0 })) })
  MessagePlugin.success('图片已删除')
}

function removeAttachment(idx: number) {
  attachments.value.splice(idx, 1)
  localStorage.setItem(`prop_att_${route.params.id}`, JSON.stringify(attachments.value))
  if (attachments.value.length === 0) {
    updateProperty(route.params.id as string, { has_attachments: false })
  }
  MessagePlugin.success('附件已删除')
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}

async function onSubmit() {
  submitting.value = true
  try {
    if (isEdit.value) {
      await updateProperty(route.params.id as string, form)
    } else {
      await createProperty(form)
    }
    MessagePlugin.success('保存成功')
    router.push('/properties')
  } finally { submitting.value = false }
}
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
.form-actions { margin-top: 24px; display: flex; gap: 16px; justify-content: center; padding-bottom: 40px; }
.file-gallery { display: flex; flex-wrap: wrap; gap: 12px; }
.file-item { width: 160px; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0; }
.gallery-img { width: 160px; height: 120px; object-fit: cover; display: block; }
.upload-trigger { width: 160px; height: 120px; border: 2px dashed #d0d0d0; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; color: #999; transition: border-color .3s; }
.upload-trigger:hover { border-color: var(--td-brand-color); color: var(--td-brand-color); }
.upload-icon { font-size: 32px; line-height: 1; }
.upload-tip { font-size: 12px; color: #999; margin-top: 8px; }
.attachment-list { display: flex; flex-direction: column; gap: 8px; }
.attachment-item { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: #f9f9f9; border-radius: 6px; }
.att-size { font-size: 12px; color: #999; }
.empty-att { color: #bbb; font-size: 13px; }
.ci-title-row { display: flex; align-items: center; gap: 12px; }
.ci-source { font-size: 12px; color: #999; font-weight: normal; }
.ci-empty { color: #999; padding: 12px 0; font-size: 13px; }
.ci-stat { background: linear-gradient(135deg, #f0f5fb, #fff); border-radius: 8px; padding: 14px; text-align: center; }
.ci-num { font-size: 22px; font-weight: 700; color: #1a2f52; line-height: 1.1; font-variant-numeric: tabular-nums; }
.ci-num.accent { color: #FF6B35; }
.ci-label { font-size: 12px; color: #999; margin-top: 6px; }
.ci-desc { padding: 12px 14px; background: #f5f7fa; border-left: 4px solid #FF6B35; border-radius: 4px; line-height: 1.7; font-size: 13px; color: #333; margin-bottom: 16px; }
.ci-row { display: flex; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
.ci-k { width: 90px; color: #999; flex-shrink: 0; }
.ci-v { flex: 1; color: #333; word-break: break-all; }
</style>
