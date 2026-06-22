/**
 * 获取菜品分类云函数
 * 返回所有启用的分类列表，按sort升序
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  try {
    const { data } = await db.collection('categories')
      .where({ isActive: true })
      .orderBy('sort', 'asc')
      .get();

    return {
      success: true,
      data
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
