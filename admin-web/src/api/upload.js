import http from '@/utils/request';
export function uploadImage(formData) {
    return http
        .post('/upload/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })
        .then(r => r.data);
}
