<template>
  <div class="page">
    <h2 class="page-title">文章管理（法拍秘籍）</h2>
    <t-card>
      <div class="search-bar">
        <t-input v-model="filters.keyword" placeholder="搜索标题" clearable style="width:200px" @change="onSearch" />
        <t-button theme="primary" @click="onSearch">查询</t-button>
        <t-button variant="outline" @click="onAdd">添加文章</t-button>
        <t-button theme="success" :loading="syncing" @click="onSyncFromMp">从公众号同步</t-button>
        <t-button theme="primary" variant="outline" @click="onImportDialog">粘贴链接导入</t-button>
      </div>
      <t-table :data="list" :columns="columns" :loading="loading" row-key="id" :pagination="pagination" @page-change="onPageChange">
        <template #cover_image="{ row }">
          <t-image v-if="row.cover_image" :src="row.cover_image" fit="cover" style="width:80px;height:50px;border-radius:4px" />
          <span v-else class="no-img">无图</span>
        </template>
        <template #is_home_show="{ row }">
          <t-tag :theme="row.is_home_show ? 'success' : 'default'">{{ row.is_home_show ? '是' : '否' }}</t-tag>
        </template>
        <template #source="{ row }">
          <t-tag :theme="row.source === 'wechat_mp' ? 'primary' : 'default'" variant="light">{{ row.source === 'wechat_mp' ? '公众号' : '手工' }}</t-tag>
        </template>
        <template #has_content="{ row }">
          <t-tag :theme="row.has_content ? 'success' : 'warning'" variant="light">{{ row.has_content ? '已抓' : '无正文' }}</t-tag>
        </template>
        <template #op="{ row }">
          <t-space>
            <t-button variant="text" size="small" @click="onEdit(row)">编辑</t-button>
            <t-button v-if="row.mp_url" variant="text" size="small" theme="primary" :loading="refetchingId === row.id" @click="onRefetch(row)">抓正文</t-button>
            <t-popconfirm content="确定删除？" @confirm="onDelete(row.id)"><t-button variant="text" size="small" theme="danger">删除</t-button></t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <t-dialog v-model:visible="formVisible" :header="isEdit ? '编辑文章' : '添加文章'" width="560px" @confirm="onSave">
      <t-form :data="formData" label-width="100px">
        <t-form-item label="标题"><t-input v-model="formData.title" /></t-form-item>
        <t-form-item label="简介"><t-textarea v-model="formData.summary" /></t-form-item>
        <t-form-item label="正文(HTML)">
          <t-textarea v-model="formData.content" :autosize="{ minRows: 4, maxRows: 12 }" placeholder="公众号原文正文HTML，可点列表「抓正文」自动填充，也可手工编辑" />
        </t-form-item>
        <t-form-item label="封面图"><t-input v-model="formData.cover_image" placeholder="图片URL" /></t-form-item>
        <t-form-item label="公众号链接"><t-input v-model="formData.mp_url" /></t-form-item>
        <t-form-item label="发布日期"><t-date-picker v-model="formData.published_at" /></t-form-item>
        <t-form-item label="首页展示"><t-switch v-model="formData.is_home_show" /></t-form-item>
        <t-form-item label="排序"><t-input-number v-model="formData.sort_order" :min="0" /></t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog
      v-model:visible="importVisible"
      header="粘贴公众号文章链接导入"
      width="600px"
      :confirm-btn="{ content: '开始导入', loading: importing }"
      @confirm="onImportConfirm"
    >
      <p class="import-tip">把公众号文章的永久链接（https://mp.weixin.qq.com/s/...）粘贴到下方，支持多条，每行一个。适用于群发推送、无法自动同步的历史文章。</p>
      <t-textarea
        v-model="importUrls"
        :autosize="{ minRows: 6, maxRows: 12 }"
        placeholder="https://mp.weixin.qq.com/s/xxxxxxxx&#10;https://mp.weixin.qq.com/s/yyyyyyyy"
      />
      <div v-if="importFailed.length" class="import-failed">
        <p>以下链接导入失败：</p>
        <ul>
          <li v-for="(f, i) in importFailed" :key="i">{{ f.url }} —— {{ f.reason }}</li>
        </ul>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { listArticles, createArticle, updateArticle, deleteArticle, syncArticlesFromMp, importArticleFromUrl, refetchArticleContent } from '@/api/articles'

const loading = ref(false)
const syncing = ref(false)
const refetchingId = ref(0)
const list = ref<any[]>([])
const filters = reactive({ keyword: '' })
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })

const columns = [
  { colKey: 'id', title: 'ID', width: 70 },
  { colKey: 'cover_image', title: '封面', width: 90 },
  { colKey: 'title', title: '标题', ellipsis: true, width: 220 },
  { colKey: 'source', title: '来源', width: 80 },
  { colKey: 'has_content', title: '正文', width: 80 },
  { colKey: 'sort_order', title: '排序', width: 70 },
  { colKey: 'is_home_show', title: '首页展示', width: 90 },
  { colKey: 'published_at', title: '发布日期', width: 120 },
  { colKey: 'op', title: '操作', width: 180 },
]

const formVisible = ref(false)
const isEdit = ref(false)
const formData = reactive({ id: 0, title: '', summary: '', content: '', cover_image: '', mp_url: '', published_at: '', is_home_show: false, sort_order: 0 })

const importVisible = ref(false)
const importing = ref(false)
const importUrls = ref('')
const importFailed = ref<any[]>([])

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: pagination.current, page_size: pagination.pageSize }
    if (filters.keyword) params.keyword = filters.keyword
    const data: any = await listArticles(params)
    list.value = data.items
    pagination.total = data.total
  } finally { loading.value = false }
}

function onSearch() { pagination.current = 1; loadData() }
function onPageChange(p: any) { pagination.current = p.current; loadData() }
function onAdd() { isEdit.value = false; Object.assign(formData, { id: 0, title: '', summary: '', content: '', cover_image: '', mp_url: '', published_at: '', is_home_show: false, sort_order: 0 }); formVisible.value = true }
function onEdit(row: any) { isEdit.value = true; Object.assign(formData, { content: '', ...row }); formVisible.value = true }

async function onRefetch(row: any) {
  refetchingId.value = row.id
  try {
    const res: any = await refetchArticleContent(row.id)
    if (res.has_content) MessagePlugin.success(`正文抓取成功（${res.content_length} 字）`)
    else MessagePlugin.warning(res.message || '未抓取到正文')
    loadData()
  } catch { /* skip */ } finally { refetchingId.value = 0 }
}

async function onSave() {
  const payload = { ...formData }
  delete (payload as any).id
  try {
    if (isEdit.value) await updateArticle(formData.id, payload)
    else await createArticle(payload)
    MessagePlugin.success('保存成功')
    formVisible.value = false
    loadData()
  } catch { /* skip */ }
}

async function onDelete(id: number) {
  await deleteArticle(id)
  MessagePlugin.success('已删除')
  loadData()
}

async function onSyncFromMp() {
  syncing.value = true
  try {
    const res: any = await syncArticlesFromMp(40)
    MessagePlugin.success(res.message || '同步完成')
    pagination.current = 1
    loadData()
  } catch (e: any) {
    MessagePlugin.error(e?.response?.data?.detail || '同步失败，请检查公众号配置与 IP 白名单')
  } finally {
    syncing.value = false
  }
}

function onImportDialog() {
  importUrls.value = ''
  importFailed.value = []
  importVisible.value = true
}

async function onImportConfirm() {
  const text = importUrls.value.trim()
  if (!text) { MessagePlugin.warning('请粘贴至少一条文章链接'); return }
  importing.value = true
  importFailed.value = []
  try {
    const res: any = await importArticleFromUrl(text)
    importFailed.value = res.failed || []
    if (importFailed.value.length) {
      MessagePlugin.warning(res.message || '部分导入失败')
    } else {
      MessagePlugin.success(res.message || '导入完成')
      importVisible.value = false
    }
    pagination.current = 1
    loadData()
  } catch (e: any) {
    MessagePlugin.error(e?.response?.data?.detail || '导入失败')
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
.search-bar { display: flex; gap: 12px; margin-bottom: 16px; }
.import-tip { color: #666; font-size: 13px; line-height: 1.6; margin: 0 0 12px; }
.import-failed { margin-top: 12px; color: #d54941; font-size: 13px; }
.import-failed ul { margin: 6px 0 0; padding-left: 18px; }
.import-failed li { word-break: break-all; line-height: 1.5; }
</style>
