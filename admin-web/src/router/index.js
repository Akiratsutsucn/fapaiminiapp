import { createRouter, createWebHashHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { MessagePlugin } from 'tdesign-vue-next';
const ADMIN_ONLY = ['admin'];
const ADMIN_OR_AGENT = ['admin', 'agent'];
const CONTENT_MANAGER = ['admin', 'content_manager'];
const LEADER_AND_ABOVE = ['admin', 'leader'];
const routes = [
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
            { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/dashboard/Dashboard.vue'), meta: { title: '数据看板', roles: ADMIN_OR_AGENT } },
            { path: 'ai-assistant', name: 'AiAssistant', component: () => import('@/views/ai/AiAssistantView.vue'), meta: { title: 'AI助手', roles: ADMIN_ONLY } },
            { path: 'users', name: 'Users', component: () => import('@/views/user/UserList.vue'), meta: { title: '用户管理', roles: ADMIN_OR_AGENT } },
            { path: 'properties', name: 'Properties', component: () => import('@/views/property/PropertyList.vue'), meta: { title: '房源管理', roles: ADMIN_ONLY } },
            { path: 'properties/edit/:id?', name: 'PropertyEdit', component: () => import('@/views/property/PropertyEdit.vue'), meta: { title: '房源编辑', roles: ADMIN_ONLY } },
            { path: 'demands', name: 'Demands', component: () => import('@/views/demand/DemandList.vue'), meta: { title: '需求管理', roles: ADMIN_OR_AGENT } },
            { path: 'articles', name: 'Articles', component: () => import('@/views/article/ArticleList.vue'), meta: { title: '文章管理', roles: CONTENT_MANAGER } },
            { path: 'banners', name: 'Banners', component: () => import('@/views/banner/BannerList.vue'), meta: { title: '横幅管理', roles: CONTENT_MANAGER } },
            { path: 'crawler', name: 'Crawler', component: () => import('@/views/crawler/CrawlerView.vue'), meta: { title: '爬虫管理', roles: CONTENT_MANAGER } },
            { path: 'data-audit/executions', name: 'DataAuditExecutions', component: () => import('@/views/data-audit/ExecutionsView.vue'), meta: { title: '审核历史', roles: ADMIN_ONLY } },
            { path: 'communities', name: 'Communities', component: () => import('@/views/community/CommunityList.vue'), meta: { title: '小区管理', roles: ADMIN_ONLY } },
            { path: 'settings', name: 'Settings', component: () => import('@/views/settings/SettingsView.vue'), meta: { title: '系统设置', roles: ADMIN_ONLY } },
        ],
    },
];
const router = createRouter({
    history: createWebHashHistory(),
    routes,
});
router.beforeEach((to, _from, next) => {
    const auth = useAuthStore();
    const token = auth.token || localStorage.getItem('admin_token');
    // 已登录用户访问 /login 时直接跳看板
    if (to.meta.noAuth && token && to.path === '/login') {
        return next('/dashboard');
    }
    // 未登录但访问需鉴权页面
    if (!to.meta.noAuth && !token) {
        return next({ path: '/login', query: { redirect: to.fullPath } });
    }
    // 已登录的角色权限校验
    const roles = to.meta.roles;
    if (roles && roles.length > 0 && !auth.hasRole(roles)) {
        MessagePlugin.error('您没有访问该页面的权限');
        return next('/403');
    }
    next();
});
export default router;
