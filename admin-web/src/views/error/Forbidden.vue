<template>
  <div class="forbidden">
    <div class="card">
      <div class="code">403</div>
      <div class="title">无访问权限</div>
      <div class="desc">您当前账号 ({{ roleLabel }}) 无权访问该页面，请联系管理员调整角色或返回。</div>
      <t-space>
        <t-button theme="primary" @click="onBackHome">返回看板</t-button>
        <t-button variant="outline" @click="onLogout">切换账号</t-button>
      </t-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const roleLabel = computed(() => {
  const r = auth.role
  if (r === 'admin') return '管理员'
  if (r === 'agent') return '代理商'
  if (r === 'customer') return '客户'
  return '未登录'
})

function onBackHome() { router.push('/dashboard') }
function onLogout() { auth.logout(); router.push('/login') }
</script>

<style scoped>
.forbidden { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f6f8; }
.card { padding: 56px 64px; background: #fff; border-radius: 12px; box-shadow: 0 2px 16px rgba(0,0,0,0.06); text-align: center; max-width: 480px; }
.code { font-size: 96px; font-weight: 800; color: #1a2f52; line-height: 1; letter-spacing: 4px; }
.title { font-size: 20px; color: #2d4a7a; margin-top: 12px; font-weight: 600; }
.desc { font-size: 14px; color: #8a8a8a; margin: 16px 0 32px; line-height: 1.6; }
</style>
