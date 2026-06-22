// 联系方式门禁:使用 AI 找房 / 跳转法拍平台前,要求用户先填手机号+姓氏(关联用户表)。
// 共享逻辑,供 ai-search 页面与 house-card 组件复用。
import { getUserProfile, updateUserProfile } from '../services/user';

// 检查当前用户是否已填手机号+昵称(姓氏)。
// 返回 'ok'(已填,放行) | 'need'(已登录但缺,需弹窗) | 'nologin'(未登录)
export async function checkContactStatus(): Promise<'ok' | 'need' | 'nologin'> {
  const app = getApp<IAppOption>();
  if (!app.isLoggedIn()) return 'nologin';
  try {
    const profile = await getUserProfile();
    return profile && profile.phone && profile.nickname ? 'ok' : 'need';
  } catch (e) {
    return 'need';
  }
}

// 校验并保存姓氏+手机号到用户表(姓氏→nickname, 手机号→phone)。
// 成功返回 true;校验失败/保存失败返回 false 并 toast 提示。
export async function saveContact(surname: string, phone: string): Promise<boolean> {
  const s = (surname || '').trim();
  const p = (phone || '').trim();
  if (!s) {
    wx.showToast({ title: '请填写姓氏', icon: 'none' });
    return false;
  }
  if (!/^1\d{10}$/.test(p)) {
    wx.showToast({ title: '请填写正确的手机号', icon: 'none' });
    return false;
  }
  try {
    await updateUserProfile({ nickname: s, phone: p } as any);
    return true;
  } catch (e) {
    wx.showToast({ title: '保存失败,请重试', icon: 'none' });
    return false;
  }
}
