/**
 * 管理后台无操作超时自动登出。
 *
 * - 默认 30 分钟无操作 → 清 token + 跳 /login
 * - 监听用户操作：mousemove / mousedown / keydown / scroll / touchstart
 * - 操作发生 → 重置计时器
 * - 节流：5 秒内不重复重置（避免 mousemove 太密集）
 *
 * 用法（在 AdminLayout.vue 的 setup 里）：
 *   import { startIdleTimer, stopIdleTimer } from '@/utils/idleTimer'
 *   onMounted(() => startIdleTimer(() => { auth.logout(); router.push('/login') }))
 *   onUnmounted(() => stopIdleTimer())
 */
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const RESET_THROTTLE_MS = 5 * 1000; // 5 seconds
const ACTIVITY_EVENTS = [
    'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart',
];
let timeoutHandle = null;
let lastResetAt = 0;
let onTimeoutCb = null;
let timeoutMs = DEFAULT_TIMEOUT_MS;
function clear() {
    if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
        timeoutHandle = null;
    }
}
function scheduleTimeout() {
    clear();
    timeoutHandle = window.setTimeout(() => {
        timeoutHandle = null;
        if (onTimeoutCb)
            onTimeoutCb();
    }, timeoutMs);
}
function onActivity() {
    // 节流：5 秒内只重置一次
    const now = Date.now();
    if (now - lastResetAt < RESET_THROTTLE_MS)
        return;
    lastResetAt = now;
    scheduleTimeout();
}
export function startIdleTimer(callback, ms = DEFAULT_TIMEOUT_MS) {
    stopIdleTimer();
    onTimeoutCb = callback;
    timeoutMs = ms;
    lastResetAt = Date.now();
    scheduleTimeout();
    ACTIVITY_EVENTS.forEach(evt => {
        window.addEventListener(evt, onActivity, { passive: true });
    });
}
export function stopIdleTimer() {
    clear();
    ACTIVITY_EVENTS.forEach(evt => {
        window.removeEventListener(evt, onActivity);
    });
    onTimeoutCb = null;
    lastResetAt = 0;
}
