// 选房需求服务
import { request } from '../utils/request';

export async function submitDemand(data: DemandForm) {
  return request({ url: '/demands', method: 'POST', data });
}
