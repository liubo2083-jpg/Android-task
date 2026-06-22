/**
 * 全局配置常量
 *
 * 多人协作约定：
 *   - 所有硬编码的魔法数字/字符串集中在此管理
 *   - 页面中通过 require('../../constants/config') 引入
 *   - 修改配置时需通知全组成员
 */

module.exports = {
  // ===== 云环境 =====
  CLOUD_ENV: 'cloud1-d3gsbk3zy97882355',

  // ===== 业务常量 =====
  /** 配送费（分） */
  DELIVERY_FEE: 200,
  /** 订单超时时间（毫秒）—— 30分钟 */
  ORDER_TIMEOUT_MS: 30 * 60 * 1000,
  /** 取餐码长度 */
  PICKUP_CODE_LENGTH: 8,
  /** 每页菜品数量 */
  DISH_PAGE_SIZE: 10,

  // ===== 用户角色 =====
  ROLES: {
    STUDENT: 'student',
    TEACHER: 'teacher',
    ADMIN: 'admin',
    CANTEEN_STAFF: 'canteen_staff',
  },

  // ===== 订单类型 =====
  ORDER_TYPES: {
    INSTANT: 'instant',
    RESERVE: 'reserve',
  },

  // ===== 取餐方式 =====
  PICKUP_TYPES: {
    SELF: 'self',
    DELIVERY: 'delivery',
  },

  // ===== 订单状态 =====
  ORDER_STATUS: {
    PENDING_PAY: 'pending_pay',
    PAID: 'paid',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },

  // ===== 页面路径（用于跳转） =====
  PAGES: {
    LOGIN: '/pages/login/login',
    HOME: '/pages/home/home',
    DISH_DETAIL: '/pages/dish-detail/dish-detail',
    ORDER_LIST: '/pages/order-list/order-list',
    CART: '/pages/cart/cart',
    USER: '/pages/user/user',
  },
};
