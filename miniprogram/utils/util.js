/**
 * 公共工具函数
 *
 * 多人协作约定：
 *   - 所有金额计算使用 formatPrice，统一以"分"存储、以"元"展示
 *   - 日期格式化统一使用 formatDate
 *   - 确保所有地方的价格展示一致
 */

/**
 * 格式化价格：分 → 元（字符串，保留两位小数）
 * @param {number} cents - 金额（单位：分）
 * @returns {string} 格式化后的价格，如 "12.50"
 */
function formatPrice(cents) {
  if (cents == null || isNaN(cents)) return '0.00';
  return (cents / 100).toFixed(2);
}

/**
 * 格式化价格：分 → 元（数字，整数时不含小数）
 * @param {number} cents - 金额（单位：分）
 * @returns {number|string} 如 1200 → 12, 850 → 8.5
 */
function formatPriceSimple(cents) {
  if (cents == null || isNaN(cents)) return 0;
  const yuan = cents / 100;
  return yuan === Math.floor(yuan) ? yuan : parseFloat(yuan.toFixed(1));
}

/**
 * 格式化日期
 * @param {Date|string|number} date - 日期
 * @param {string} format - 格式，默认 'YYYY-MM-DD HH:mm'
 */
function formatDate(date, format = 'YYYY-MM-DD HH:mm') {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);

  const map = {
    YYYY: d.getFullYear(),
    MM: String(d.getMonth() + 1).padStart(2, '0'),
    DD: String(d.getDate()).padStart(2, '0'),
    HH: String(d.getHours()).padStart(2, '0'),
    mm: String(d.getMinutes()).padStart(2, '0'),
    ss: String(d.getSeconds()).padStart(2, '0'),
  };

  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (key) => map[key]);
}

/**
 * 订单状态映射
 */
const ORDER_STATUS_MAP = {
  pending_pay: '待支付',
  paid: '已支付',
  completed: '已完成',
  cancelled: '已取消',
};

/**
 * 获取订单状态中文名
 * @param {string} status
 * @returns {string}
 */
function getOrderStatusText(status) {
  return ORDER_STATUS_MAP[status] || status;
}

/**
 * 防抖
 */
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * 节流
 */
function throttle(fn, interval = 300) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

module.exports = {
  formatPrice,
  formatPriceSimple,
  formatDate,
  getOrderStatusText,
  ORDER_STATUS_MAP,
  debounce,
  throttle,
};
