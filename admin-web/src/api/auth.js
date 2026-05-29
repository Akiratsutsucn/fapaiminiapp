import http from '@/utils/request';
export function adminLogin(username, password) {
    return http.post('/auth/login', { username, password }).then(r => r.data);
}
