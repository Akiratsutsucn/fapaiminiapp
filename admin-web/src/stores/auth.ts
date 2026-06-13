import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface AuthUser {
  id: number
  nickname: string
  role: string // 'admin' | 'agent' | 'customer'
  avatar_url?: string | null
  phone?: string | null
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('admin_token') || '')
  const user = ref<AuthUser | null>(JSON.parse(localStorage.getItem('admin_user') || 'null'))

  const role = computed(() => user.value?.role || '')
  const isAdmin = computed(() => role.value === 'admin')
  const isAgent = computed(() => role.value === 'agent')
  // 只读角色:领导(leader)可看全局但不能做任何修改/新增/删除操作
  const isReadonly = computed(() => role.value === 'leader')

  function setAuth(t: string, u: AuthUser) {
    token.value = t
    user.value = u
    localStorage.setItem('admin_token', t)
    localStorage.setItem('admin_user', JSON.stringify(u))
  }

  function hasRole(allowed: string[] | undefined): boolean {
    if (!allowed || allowed.length === 0) return true
    if (!user.value) return false
    return allowed.includes(user.value.role)
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
  }

  return { token, user, role, isAdmin, isAgent, isReadonly, setAuth, hasRole, logout }
})
