<template>
  <t-layout class="admin-layout">
    <t-aside :width="collapsed ? '64px' : '220px'" class="admin-aside">
      <div class="logo" @click="router.push('/dashboard')">
        <span v-if="!collapsed" class="logo-text">法拍者联盟</span>
        <span v-if="!collapsed" class="logo-version">V1.0</span>
        <span v-else class="logo-text-short">法拍</span>
      </div>
      <t-menu
        :value="activeMenu"
        :collapsed="collapsed"
        theme="dark"
        @change="onMenuChange"
      >
        <template v-for="item in visibleMenus" :key="item.path">
          <t-menu-item :value="item.path">
            <template #icon><t-icon :name="item.icon" /></template>
            {{ item.label }}
          </t-menu-item>
        </template>
      </t-menu>
      <div class="aside-footer">
        <t-button variant="text" theme="default" @click="onLogout" class="logout-btn">
          <t-icon name="poweroff" />
          <span v-if="!collapsed">退出登录</span>
        </t-button>
      </div>
    </t-aside>
    <t-layout>
      <t-header class="admin-header">
        <div class="header-left">
          <t-button variant="text" @click="collapsed = !collapsed">
            <t-icon :name="collapsed ? 'menu-fold' : 'menu-unfold'" />
          </t-button>
          <t-breadcrumb>
            <t-breadcrumb-item>{{ currentTitle }}</t-breadcrumb-item>
          </t-breadcrumb>
        </div>
        <div class="header-right">
          <t-tag v-if="roleLabel" :theme="auth.isAdmin ? 'primary' : 'warning'" variant="light" style="margin-right: 12px">{{ roleLabel }}</t-tag>
          <span class="user-name">{{ auth.user?.nickname || '管理员' }}</span>
        </div>
      </t-header>
      <t-content class="admin-content">
        <router-view />
      </t-content>
    </t-layout>
  </t-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next'
import { startIdleTimer, stopIdleTimer } from '@/utils/idleTimer'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const collapsed = ref(false)

interface MenuItem {
  path: string
  label: string
  icon: string
  roles: string[]
}

const ALL_MENUS: MenuItem[] = [
  { path: '/dashboard', label: '数据看板', icon: 'chart-bar', roles: ['admin', 'agent'] },
  { path: '/users', label: '用户管理', icon: 'user', roles: ['admin', 'agent'] },
  { path: '/properties', label: '房源管理', icon: 'home', roles: ['admin'] },
  { path: '/demands', label: '需求管理', icon: 'task', roles: ['admin', 'agent'] },
  { path: '/articles', label: '文章管理', icon: 'file-paste', roles: ['admin'] },
  { path: '/banners', label: '横幅管理', icon: 'image', roles: ['admin'] },
  { path: '/crawler', label: '爬虫管理', icon: 'cloud-download', roles: ['admin'] },
  { path: '/communities', label: '小区管理', icon: 'shop', roles: ['admin'] },
  { path: '/settings', label: '系统设置', icon: 'setting', roles: ['admin'] },
]

const visibleMenus = computed(() => ALL_MENUS.filter(m => auth.hasRole(m.roles)))
const activeMenu = computed(() => '/' + (route.path.split('/').filter(Boolean)[0] || 'dashboard'))
const currentTitle = computed(() => (route.meta.title as string) || '')
const roleLabel = computed(() => {
  const r = auth.role
  if (r === 'admin') return '管理员'
  if (r === 'agent') return '代理商'
  return ''
})

function onMenuChange(val: string) { router.push(val) }
function onLogout() {
  DialogPlugin.confirm({ header: '退出登录', body: '确定要退出管理后台吗？', onConfirm: () => { stopIdleTimer(); auth.logout(); router.push('/login') } })
}

// 30 分钟无操作 → 自动登出
const IDLE_TIMEOUT_MS = 30 * 60 * 1000

onMounted(() => {
  startIdleTimer(() => {
    auth.logout()
    MessagePlugin.warning('30 分钟无操作，请重新登录')
    router.push('/login')
  }, IDLE_TIMEOUT_MS)
})

onUnmounted(() => {
  stopIdleTimer()
})
</script>

<style scoped>
.admin-layout { height: 100vh; }
.admin-aside { background: #1a2f52; display: flex; flex-direction: column; }
.logo { height: 64px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1); }
.logo-text { font-size: 18px; font-weight: 700; letter-spacing: 2px; }
.logo-version { font-size: 11px; opacity: 0.45; margin-left: 6px; font-weight: 400; letter-spacing: 0; }
.logo-text-short { font-size: 16px; font-weight: 700; }
.aside-footer { padding: 12px; border-top: 1px solid rgba(255,255,255,0.1); margin-top: auto; }
.logout-btn { width: 100%; color: rgba(255,255,255,0.7) !important; justify-content: flex-start; }
.admin-header { height: 64px; background: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.header-left { display: flex; align-items: center; gap: 12px; }
.header-right { display: flex; align-items: center; }
.user-name { font-size: 14px; color: #5a5a5a; }
.admin-content { padding: 24px; overflow-y: auto; background: #f5f6f8; }
</style>
