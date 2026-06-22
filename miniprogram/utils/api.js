/**
 * 云函数调用统一封装
 *
 * 使用方式（各页面统一引入）：
 *   const api = require('../../utils/api');
 *   const res = await api.call('login', { nickName: 'xxx' });
 *
 * 多人协作约定：
 *   - 所有云函数调用必须通过此模块，不得直接写 wx.cloud.callFunction()
 *   - 统一错误处理和 loading 状态由各页面自行控制
 *   - 新增云函数需在此文件的 FUNCTIONS 常量中注册
 */

/**
 * 调用云函数
 * @param {string} name - 云函数名称
 * @param {object} data - 请求参数
 * @returns {Promise<object>} 云函数返回的 result 对象
 */
async function call(name, data = {}) {
  try {
    const res = await wx.cloud.callFunction({ name, data });
    return res.result;
  } catch (err) {
    console.error(`云函数 [${name}] 调用失败:`, err);
    return { success: false, message: err.errMsg || '网络请求失败' };
  }
}

/**
 * 直接查询云数据库（前端直连，适用于简单只读查询）
 * @param {string} collection - 集合名称
 * @param {object} options - 查询选项 { where, orderBy, skip, limit }
 */
async function query(collection, options = {}) {
  try {
    const db = wx.cloud.database();
    let cmd = db.collection(collection);
    if (options.where) cmd = cmd.where(options.where);
    if (options.orderBy) cmd = cmd.orderBy(options.orderBy[0], options.orderBy[1]);
    if (options.skip) cmd = cmd.skip(options.skip);
    if (options.limit) cmd = cmd.limit(options.limit);
    const res = await cmd.get();
    return { success: true, data: res.data };
  } catch (err) {
    console.error(`数据库查询 [${collection}] 失败:`, err);
    return { success: false, message: err.errMsg, data: [] };
  }
}

/**
 * 云函数名称常量 —— 新增云函数时需在此注册
 */
const FUNCTIONS = {
  LOGIN: 'login',
  DISHES: 'dishes',
  CART: 'cart',
  PLACE_ORDER: 'placeOrder',
  PAY_ORDER: 'payOrder',
  CANCEL_ORDER: 'cancelOrder',
  VERIFY_PICKUP: 'verifyPickup',
  GET_CATEGORIES: 'getCategories',
  INIT_DB: 'initDB',
};

module.exports = {
  call,
  query,
  FUNCTIONS,
};
