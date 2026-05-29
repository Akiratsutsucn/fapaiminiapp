<template>
  <div class="page">
    <h2 class="page-title">横幅管理</h2>
    <t-card>
      <div class="search-bar">
        <t-button theme="primary" @click="onAdd">添加横幅</t-button>
      </div>
      <t-table :data="list" :columns="columns" :loading="loading" row-key="id">
        <template #image_url="{ row }">
          <t-image v-if="row.image_url" :src="row.image_url" fit="cover" style="width:120px;height:60px;border-radius:4px" />
        </template>
        <template #is_active="{ row }">
          <t-tag :theme="row.is_active ? 'success' : 'default'">{{ row.is_active ? '启用' : '停用' }}</t-tag>
        </template>
        <template #op="{ row }">
          <t-space>
            <t-button variant="text" size="small" @click="onEdit(row)">编辑</t-button>
            <t-popconfirm content="确定删除？" @confirm="onDelete(row.id)"><t-button variant="text" size="small" theme="danger">删除</t-button></t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <t-dialog v-model:visible="formVisible" :header="isEdit ? '编辑横幅' : '添加横幅'" width="500px" @confirm="onSave">
      <t-form :data="formData" label-width="80px">
        <t-form-item label="标题"><t-input v-model="formData.title" /></t-form-item>
        <t-form-item label="图片URL"><t-input v-model="formData.image_url" /></t-form-item>
        <t-form-item label="分类"><t-input v-model="formData.category" /></t-form-item>
        <t-form-item label="链接"><t-input v-model="formData.link_url" /></t-form-item>
        <t-form-item label="城市">
          <t-select v-model="formData.city_id"><t-option :value="310000" label="上海" /><t-option :value="330200" label="宁波" /></t-select>
        </t-form-item>
        <t-form-item label="排序"><t-input-number v-model="formData.sort_order" :min="0" /></t-form-item>
        <t-form-item label="启用"><t-switch v-model="formData.is_active" /></t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { listBanners, createBanner, updateBanner, deleteBanner } from '@/api/banners'

const loading = ref(false)
const list = ref<any[]>([])
const columns = [
  { colKey: 'id', title: 'ID', width: 70 },
  { colKey: 'image_url', title: '图片', width: 140 },
  { colKey: 'title', title: '标题', width: 150 },
  { colKey: 'category', title: '分类', width: 100 },
  { colKey: 'sort_order', title: '排序', width: 70 },
  { colKey: 'is_active', title: '状态', width: 80 },
  { colKey: 'op', title: '操作', width: 130 },
]

const formVisible = ref(false)
const isEdit = ref(false)
const formData = reactive({ id: 0, title: '', image_url: '', category: '', link_url: '', city_id: 310000, sort_order: 0, is_active: true })

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const data: any = await listBanners()
    list.value = data
  } finally { loading.value = false }
}

function onAdd() { isEdit.value = false; Object.assign(formData, { id: 0, title: '', image_url: '', category: '', link_url: '', city_id: 310000, sort_order: 0, is_active: true }); formVisible.value = true }
function onEdit(row: any) { isEdit.value = true; Object.assign(formData, row); formVisible.value = true }

async function onSave() {
  const payload: any = { ...formData }
  delete payload.id
  try {
    if (isEdit.value) await updateBanner(formData.id, payload)
    else await createBanner(payload)
    MessagePlugin.success('保存成功')
    formVisible.value = false
    loadData()
  } catch { /* skip */ }
}

async function onDelete(id: number) {
  await deleteBanner(id)
  MessagePlugin.success('已删除')
  loadData()
}
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
.search-bar { margin-bottom: 16px; }
</style>
