<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <h1>法拍者联盟</h1>
        <p>管理后台</p>
      </div>
      <t-form :data="form" @submit="onLogin">
        <t-form-item label="账号">
          <t-input v-model="form.username" placeholder="管理员用户名 或 手机号" clearable />
        </t-form-item>
        <t-form-item label="密码">
          <t-input v-model="form.password" type="password" placeholder="请输入密码" clearable />
        </t-form-item>
        <t-form-item>
          <t-button type="submit" theme="primary" block :loading="loading">登 录</t-button>
        </t-form-item>
      </t-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { adminLogin } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { firstAccessiblePath } from '@/router'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const form = reactive({ username: 'admin', password: '' })

async function onLogin() {
  if (!form.username || !form.password) {
    MessagePlugin.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    const data = await adminLogin(form.username, form.password)
    const info = data.user_info || { nickname: form.username, role: 'admin', id: 0 }
    auth.setAuth(data.access_token, info)
    // 跳到该角色可达首页(内容管理员无看板权限,跳 dashboard 会被拦成403)
    router.push(firstAccessiblePath(info.role || ''))
  } catch { /* interceptor handles */ }
  finally { loading.value = false }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #1a2f52 0%, #2d4a7a 40%, #3a5a8c 100%);
}
.login-card {
  width: 400px;
  padding: 48px 40px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.2);
}
.login-header {
  text-align: center;
  margin-bottom: 32px;
}
.login-header h1 { font-size: 24px; color: #1a2f52; font-weight: 700; }
.login-header p { font-size: 14px; color: #8a8a8a; margin-top: 8px; }
</style>
