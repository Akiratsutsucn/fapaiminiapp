import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
export const useAuthStore = defineStore('auth', () => {
    const token = ref(localStorage.getItem('admin_token') || '');
    const user = ref(JSON.parse(localStorage.getItem('admin_user') || 'null'));
    const role = computed(() => user.value?.role || '');
    const isAdmin = computed(() => role.value === 'admin');
    const isAgent = computed(() => role.value === 'agent');
    function setAuth(t, u) {
        token.value = t;
        user.value = u;
        localStorage.setItem('admin_token', t);
        localStorage.setItem('admin_user', JSON.stringify(u));
    }
    function hasRole(allowed) {
        if (!allowed || allowed.length === 0)
            return true;
        if (!user.value)
            return false;
        return allowed.includes(user.value.role);
    }
    function logout() {
        token.value = '';
        user.value = null;
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
    }
    return { token, user, role, isAdmin, isAgent, setAuth, hasRole, logout };
});
