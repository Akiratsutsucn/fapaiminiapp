import http from '@/utils/request'

export interface UploadResp {
  url: string
  filename?: string
  [key: string]: any
}

export function uploadImage(formData: FormData) {
  return http
    .post<UploadResp>('/upload/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then(r => r.data)
}
