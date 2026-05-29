import axios from 'axios';
import { MessagePlugin } from 'tdesign-vue-next';
import router from '@/router';
const http = axios.create({
    baseURL: '/api/admin',
    timeout: 30000,
});
http.interceptors.request.use(config => {
    const token = localStorage.getItem('admin_token');
    if (token)
        config.headers.Authorization = `Bearer ${token}`;
    return config;
});
http.interceptors.response.use(res => res, err => {
    if (err.response?.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        router.push('/login');
    }
    const msg = err.response?.data?.detail || err.response?.data?.message || '请求失败';
    MessagePlugin.error(msg);
    return Promise.reject(err);
});
export default http;
