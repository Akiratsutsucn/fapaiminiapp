import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { MessagePlugin } from 'tdesign-vue-next'

// 角色可见性常量(与后端 ROLE_PERMISSIONS、菜单 AdminLayout 严格一致):
//   admin=全部;leader=全模块只读;content_manager=仅文章/横幅;agent/salesperson/customer=不登录后台
const ADMIN_ONLY = ['admin']
const ADMIN_OR_LEADER = ['admin', 'leader']
const CONTENT_MANAGER = ['admin', 'leader', 'content_manager']  // 文章/横幅:含leader(只读)
const CONTENT_TOOLS = ['admin', 'leader']  // 爬虫等内容工具:leader可见,content_manager不可

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/Login.vue'),
    meta: { noAuth: true },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/Forbidden.vue'),
    meta: { noAuth: true, title: '无权限' },
  },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/dashboard/Dashboard.vue'), meta: { title: '数据看板', roles: ADMIN_OR_LEADER } },
      { path: 'ai-assistant', name: 'AiAssistant', component: () => import('@/views/ai/AiAssistantView.vue'), meta: { title: 'AI助手', roles: ADMIN_ONLY } },
      { path: 'users', name: 'Users', component: () => import('@/views/user/UserList.vue'), meta: { title: '用户管理', roles: ADMIN_OR_LEADER } },
      { path: 'properties', name: 'Properties', component: () => import('@/views/property/PropertyList.vue'), meta: { title: '房源管理', roles: ADMIN_OR_LEADER } },
      { path: 'properties/edit/:id?', name: 'PropertyEdit', component: () => import('@/views/property/PropertyEdit.vue'), meta: { title: '房源编辑', roles: ADMIN_ONLY } },
      { path: 'demands', name: 'Demands', component: () => import('@/views/demand/DemandList.vue'), meta: { title: '需求管理', roles: ADMIN_OR_LEADER } },
      { path: 'articles', name: 'Articles', component: () => import('@/views/article/ArticleList.vue'), meta: { title: '文章管理', roles: CONTENT_MANAGER } },
      { path: 'banners', name: 'Banners', component: () => import('@/views/banner/BannerList.vue'), meta: { title: '横幅管理', roles: CONTENT_MANAGER } },
      { path: 'crawler', name: 'Crawler', component: () => import('@/views/crawler/CrawlerView.vue'), meta: { title: '爬虫管理', roles: CONTENT_TOOLS } },
      { path: 'data-audit/executions', name: 'DataAuditExecutions', component: () => import('@/views/data-audit/ExecutionsView.vue'), meta: { title: '审核历史', roles: ADMIN_OR_LEADER } },
      { path: 'communities', name: 'Communities', component: () => import('@/views/community/CommunityList.vue'), meta: { title: '小区管理', roles: ADMIN_OR_LEADER } },
      { path: 'settings', name: 'Settings', component: () => import('@/views/settings/SettingsView.vue'), meta: { title: '系统设置', roles: ADMIN_ONLY } },
    ],
  },
]

// 按角色返回登录后应落地的首页(该角色第一个有权访问的菜单页)。
// 内容管理员无 dashboard 权限,固定跳 dashboard 会被守卫拦成 403——故按角色取首个可达页。
export function firstAccessiblePath(role: string): string {
  if (role === 'content_manager') return '/articles'
  // admin / leader 都能看 dashboard
  return '/dashboard'
}

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()
  const token = auth.token || localStorage.getItem('admin_token')
  const role = auth.role || ''

  // 已登录用户访问 /login 时跳到该角色可达首页
  if (to.meta.noAuth && token && to.path === '/login') {
    return next(firstAccessiblePath(role))
  }

  // 未登录但访问需鉴权页面
  if (!to.meta.noAuth && !token) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  // 访问根/看板时,内容管理员(无看板权限)重定向到其可达首页,避免落到无权页被拦
  if ((to.path === '/' || to.path === '/dashboard') && role) {
    if (role === 'content_manager') return next('/articles')
  }

  // 已登录的角色权限校验
  const roles = to.meta.roles as string[] | undefined
  if (roles && roles.length > 0 && !auth.hasRole(roles)) {
    MessagePlugin.error('您没有访问该页面的权限')
    return next('/403')
  }

  next()
})

export default router
