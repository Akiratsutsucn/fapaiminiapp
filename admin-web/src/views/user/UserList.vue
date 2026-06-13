<template>
  <div class="page">
    <h2 class="page-title">用户管理</h2>
    <t-card>
      <div class="search-bar">
        <t-input v-model="filters.keyword" placeholder="搜索昵称" clearable style="width:200px" @change="onSearch" />
        <t-select v-model="filters.role" placeholder="角色筛选" clearable style="width:150px" @change="onSearch">
          <t-option value="customer" label="客户" />
          <t-option value="salesperson" label="业务员" />
          <t-option value="agent" label="代理商" />
          <t-option value="content_manager" label="内容管理员" />
          <t-option value="leader" label="领导" />
          <t-option value="admin" label="最高管理员" />
        </t-select>
        <t-button theme="primary" @click="loadData">查询</t-button>
        <t-button theme="primary" variant="outline" @click="onCreate">新增用户</t-button>
      </div>
      <t-table :data="list" :columns="columns" :loading="loading" row-key="id" :pagination="pagination" @page-change="onPageChange">
        <template #role="{ row }">
          <t-tag :theme="roleTheme(row.role)">{{ roleLabel(row.role) }}</t-tag>
          <t-button
            v-if="row.role !== 'admin'"
            variant="text"
            size="small"
            style="margin-left: 8px"
            @click="onChangeRole(row)"
          >
            <template #icon><t-icon name="edit" /></template>
          </t-button>
        </template>
        <template #region="{ row }">
          <span v-if="row.role === 'agent' || row.role === 'salesperson'">{{ row.region || '--' }}</span>
          <span v-else style="color:#999">--</span>
        </template>
        <template #inviter_id="{ row }">
          <span v-if="row.role === 'customer' && row.inviter_id">{{ row.inviter_id }}</span>
          <span v-else style="color:#999">--</span>
        </template>
        <template #op="{ row }">
          <t-space>
            <t-button variant="text" size="small" @click="onEdit(row)">编辑</t-button>
            <t-button
              v-if="auth.isAdmin && ['admin','leader','content_manager'].includes(row.role)"
              variant="text" size="small" theme="warning" @click="onResetPassword(row)"
            >重置密码</t-button>
            <t-popconfirm content="确定删除该用户？" @confirm="onDelete(row)">
              <t-button variant="text" size="small" theme="danger">删除</t-button>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <t-dialog v-model:visible="editVisible" header="编辑用户" width="500px" @confirm="onSaveEdit">
      <t-form :data="editForm" label-width="90px">
        <t-form-item label="昵称"><t-input v-model="editForm.nickname" /></t-form-item>
        <t-form-item label="手机号"><t-input v-model="editForm.phone" /></t-form-item>
        <t-form-item label="角色">
          <t-select v-model="editForm.role">
            <t-option value="customer" label="客户" />
            <t-option value="salesperson" label="业务员" />
            <t-option value="agent" label="代理商" />
            <t-option value="content_manager" label="内容管理员" />
            <t-option value="leader" label="领导" />
            <t-option value="admin" label="最高管理员" />
          </t-select>
        </t-form-item>
        <t-form-item label="城市">
          <t-select v-model="editForm.city_id">
            <t-option value="310000" label="上海" />
            <t-option value="330200" label="宁波" />
            <t-option value="330100" label="杭州" />
          </t-select>
        </t-form-item>
        <t-form-item label="负责地区" v-if="editForm.role === 'agent' || editForm.role === 'salesperson'">
          <t-input v-model="editForm.region" placeholder="如：上海市长宁区" />
        </t-form-item>
        <t-form-item label="邀请人ID" v-if="editForm.role === 'customer'">
          <t-input-number v-model="editForm.inviter_id" placeholder="邀请该客户的代理商 ID" :min="0" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog v-model:visible="createVisible" header="新增用户" width="500px" @confirm="onSaveCreate">
      <t-form :data="createForm" label-width="90px">
        <t-form-item label="昵称"><t-input v-model="createForm.nickname" /></t-form-item>
        <t-form-item label="手机号"><t-input v-model="createForm.phone" /></t-form-item>
        <t-form-item label="角色">
          <t-select v-model="createForm.role">
            <t-option value="customer" label="客户" />
            <t-option value="salesperson" label="业务员" />
            <t-option value="agent" label="代理商" />
            <t-option value="content_manager" label="内容管理员" />
            <t-option value="leader" label="领导" />
            <t-option value="admin" label="最高管理员" />
          </t-select>
        </t-form-item>
        <t-form-item label="负责地区" v-if="createForm.role === 'agent' || createForm.role === 'salesperson'">
          <t-input v-model="createForm.region" placeholder="如：上海市长宁区" />
        </t-form-item>
        <t-form-item label="邀请人ID" v-if="createForm.role === 'customer'">
          <t-input-number v-model="createForm.inviter_id" placeholder="邀请该客户的代理商 ID" :min="0" />
        </t-form-item>
        <t-form-item label="初始密码"><t-input v-model="createForm.password" type="password" placeholder="留空则默认 123456" /></t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog v-model:visible="roleChangeVisible" header="修改角色" width="400px" @confirm="onSaveRoleChange">
      <t-form label-width="80px">
        <t-form-item label="当前用户">{{ roleChangeForm.nickname }}</t-form-item>
        <t-form-item label="当前角色">{{ roleLabel(roleChangeForm.currentRole) }}</t-form-item>
        <t-form-item label="新角色">
          <t-select v-model="roleChangeForm.newRole">
            <t-option value="customer" label="客户" />
            <t-option value="salesperson" label="业务员" />
            <t-option value="agent" label="代理商" />
            <t-option value="content_manager" label="内容管理员" />
            <t-option value="leader" label="领导" />
            <t-option value="admin" label="最高管理员" />
          </t-select>
        </t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog v-model:visible="resetPwVisible" header="重置登录密码" width="420px" @confirm="onSaveResetPassword">
      <t-form label-width="90px">
        <t-form-item label="账号">{{ resetPwForm.nickname }}（{{ roleLabel(resetPwForm.role) }}）</t-form-item>
        <t-form-item label="新密码">
          <t-input v-model="resetPwForm.password" type="password" placeholder="至少6位" clearable />
        </t-form-item>
      </t-form>
      <p style="color:#999;font-size:12px;margin:0 0 0 90px">该账号将用「手机号 + 新密码」登录后台（admin 用用户名）</p>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { listUsers, createUser, updateUser, deleteUser, updateUserRole, resetUserPassword } from '@/api/users'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const loading = ref(false)
const list = ref<any[]>([])
const filters = reactive({ keyword: '', role: '' })
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })

function roleLabel(r: string) {
  const labels: Record<string, string> = {
    admin: '最高管理员',
    leader: '领导',
    content_manager: '内容管理员',
    agent: '代理商',
    salesperson: '业务员',
    customer: '客户'
  }
  return labels[r] || '客户'
}

function roleTheme(r: string) {
  if (r === 'admin') return 'primary'
  if (r === 'leader') return 'warning'
  if (r === 'content_manager') return 'success'
  if (r === 'agent') return 'warning'
  if (r === 'salesperson') return 'success'
  return 'default'
}

const columns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'nickname', title: '昵称', width: 120 },
  { colKey: 'phone', title: '手机号', width: 130 },
  { colKey: 'role', title: '角色', width: 180 },
  { colKey: 'region', title: '负责地区', width: 160 },
  { colKey: 'inviter_id', title: '邀请人ID', width: 100 },
  { colKey: 'created_at', title: '注册时间', width: 180 },
  { colKey: 'op', title: '操作', width: 140 },
]

const editVisible = ref(false)
const editForm = reactive({ id: 0, nickname: '', phone: '', role: 'customer', city_id: '310000', region: '', inviter_id: 0 as number | null })

const createVisible = ref(false)
const createForm = reactive({ nickname: '', phone: '', role: 'customer', password: '', region: '', inviter_id: 0 as number | null })

const roleChangeVisible = ref(false)
const roleChangeForm = reactive({ userId: 0, nickname: '', currentRole: '', newRole: '' })

const resetPwVisible = ref(false)
const resetPwForm = reactive({ userId: 0, nickname: '', role: '', password: '' })

onMounted(() => loadData())

async function loadData() {
  loading.value = true
  try {
    const params: any = { page: pagination.current, page_size: pagination.pageSize }
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.role) params.role = filters.role
    const data = await listUsers(params)
    list.value = data.items
    pagination.total = data.total
  } finally { loading.value = false }
}

function onSearch() { pagination.current = 1; loadData() }
function onPageChange(p: any) {
  pagination.current = p.current
  // 切换「x条/页」时 pageSize 变化也要生效(此前只读 current 导致每页条数切换失效)
  if (p.pageSize && p.pageSize !== pagination.pageSize) {
    pagination.pageSize = p.pageSize
    pagination.current = 1
  }
  loadData()
}

function onCreate() {
  createForm.nickname = ''; createForm.phone = ''; createForm.role = 'customer'; createForm.password = ''
  createForm.region = ''; createForm.inviter_id = null
  createVisible.value = true
}

async function onSaveCreate() {
  try {
    const body: any = { ...createForm }
    if (!body.region) delete body.region
    if (!body.inviter_id) delete body.inviter_id
    if (!body.password) delete body.password
    await createUser(body)
    MessagePlugin.success('创建成功')
    createVisible.value = false
    loadData()
  } catch { /* skip */ }
}

function onEdit(row: any) {
  Object.assign(editForm, {
    id: row.id, nickname: row.nickname || '', phone: row.phone || '', role: row.role,
    city_id: String(row.city_id || 310000),
    region: row.region || '',
    inviter_id: row.inviter_id || null,
  })
  editVisible.value = true
}

async function onSaveEdit() {
  try {
    const body: any = {
      nickname: editForm.nickname,
      phone: editForm.phone,
      role: editForm.role,
      city_id: parseInt(editForm.city_id) || 310000,
    }
    if (editForm.role === 'agent' || editForm.role === 'salesperson') body.region = editForm.region || ''
    if (editForm.role === 'customer') body.inviter_id = editForm.inviter_id || null
    await updateUser(editForm.id, body)
    MessagePlugin.success('更新成功')
    editVisible.value = false
    loadData()
  } catch { /* skip */ }
}

function onChangeRole(row: any) {
  roleChangeForm.userId = row.id
  roleChangeForm.nickname = row.nickname
  roleChangeForm.currentRole = row.role
  roleChangeForm.newRole = row.role
  roleChangeVisible.value = true
}

async function onSaveRoleChange() {
  if (roleChangeForm.newRole === roleChangeForm.currentRole) {
    MessagePlugin.warning('新角色与当前角色相同')
    return
  }
  try {
    await updateUserRole(roleChangeForm.userId, roleChangeForm.newRole)
    MessagePlugin.success('角色修改成功')
    roleChangeVisible.value = false
    loadData()
  } catch { /* skip */ }
}

function onResetPassword(row: any) {
  resetPwForm.userId = row.id
  resetPwForm.nickname = row.nickname
  resetPwForm.role = row.role
  resetPwForm.password = ''
  resetPwVisible.value = true
}

async function onSaveResetPassword() {
  if (!resetPwForm.password || resetPwForm.password.length < 6) {
    MessagePlugin.warning('新密码至少6位')
    return
  }
  try {
    await resetUserPassword(resetPwForm.userId, resetPwForm.password)
    MessagePlugin.success('密码重置成功')
    resetPwVisible.value = false
  } catch (err: any) {
    MessagePlugin.error(err?.response?.data?.detail || '重置失败')
  }
}

async function onDelete(row: any) {
  try {
    await deleteUser(row.id)
    MessagePlugin.success('删除成功')
    loadData()
  } catch (err: any) {
    MessagePlugin.error(err?.response?.data?.detail || err?.message || '删除失败')
  }
}
</script>

<style scoped>
.page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
.search-bar { display: flex; gap: 12px; margin-bottom: 16px; }
</style>
