// 本地存储封装

export function getStorage<T>(key: string): T | null {
  try {
    const value = wx.getStorageSync(key);
    return value as T;
  } catch {
    return null;
  }
}

export function setStorage(key: string, value: any): void {
  try {
    wx.setStorageSync(key, value);
  } catch (e) {
    console.error('Storage set error:', e);
  }
}

export function removeStorage(key: string): void {
  try {
    wx.removeStorageSync(key);
  } catch (e) {
    console.error('Storage remove error:', e);
  }
}

/** 浏览记录 */
const HISTORY_KEY = 'browse_history';
const MAX_HISTORY = 100;

export function addBrowseHistory(type: string, targetId: number): void {
  const list = getStorage<Array<{ type: string; targetId: number; time: number }>>(HISTORY_KEY) || [];
  // 去重
  const idx = list.findIndex(item => item.type === type && item.targetId === targetId);
  if (idx >= 0) list.splice(idx, 1);
  list.unshift({ type, targetId, time: Date.now() });
  if (list.length > MAX_HISTORY) list.length = MAX_HISTORY;
  setStorage(HISTORY_KEY, list);
}

export function getBrowseHistory(): Array<{ type: string; targetId: number; time: number }> {
  return getStorage(HISTORY_KEY) || [];
}
