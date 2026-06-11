// 格式化工具函数

/** 价格转万 */
export function formatPriceWan(price: number): string {
  if (!price || price === 0) return '--';
  const wan = price / 10000;
  if (wan >= 10000) return `${(wan / 10000).toFixed(2)}亿`;
  return `${wan.toFixed(0)}万`;
}

/** 价格格式化（元，带逗号） */
export function formatPriceYuan(price: number): string {
  if (!price) return '--';
  return price.toLocaleString('zh-CN') + '元';
}

/** 面积 */
export function formatArea(area: number): string {
  if (!area || area === 0) return '--';
  return `${area.toFixed(2)}m²`;
}

/** 单价 */
export function formatUnitPrice(price: number): string {
  if (!price || price === 0) return '--';
  return `${price.toLocaleString('zh-CN')}元/m²`;
}

/** 折扣率 → 折扣显示 */
export function formatDiscount(rate: number): string {
  if (!rate || rate === 0) return '--';
  return `${(rate * 10).toFixed(1)}折`;
}

/** 日期格式化 */
export function formatDate(dateStr: string | null, fmt: string = 'YYYY-MM-DD'): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  const year = d.getFullYear().toString();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hour = d.getHours().toString().padStart(2, '0');
  const minute = d.getMinutes().toString().padStart(2, '0');

  return fmt
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute);
}

/** 开拍倒计时文字 */
export function formatCountdown(dateStr: string | null): string {
  if (!dateStr) return '--';
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) return '已开拍';

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (days > 0) return `${days}天${hours}小时${minutes}分钟`;
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  return `${minutes}分钟`;
}

/** 拍卖状态标签文字 */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    '即将开拍': '即将开拍',
    '进行中': '正在拍卖',
    '已结束': '已结束',
    '已成交': '已成交',
    '流拍': '流拍',
    '已撤回': '已撤回',
    '中止': '中止',
    '撤回': '撤回',
  };
  return map[status] || status;
}

/** 拍卖状态标签样式类 */
export function statusTagClass(status: string): string {
  const map: Record<string, string> = {
    '即将开拍': 'tag-blue',
    '进行中': 'tag-red',
    '已结束': 'tag-red',
    '已成交': 'tag-green',
    '流拍': 'tag-orange',
    '已撤回': 'tag-orange',
    '中止': 'tag-orange',
    '撤回': 'tag-orange',
  };
  return map[status] || 'tag-blue';
}
