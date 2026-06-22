/**
 * 购物车云函数
 * action: list | add | update | remove | clear
 * 设计要点：同一用户+同一菜品只有一条记录，通过数量字段管理
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d3gsbk3zy97882355' });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { action } = event;
  switch (action) {
    case 'list': return listCart();
    case 'add': return addToCart(event);
    case 'update': return updateCart(event);
    case 'remove': return removeFromCart(event);
    case 'clear': return clearCart();
    default: return { success: false, message: '未知action: ' + action };
  }
};

// ---------- 获取购物车列表 ----------
async function listCart() {
  const openid = cloud.getWXContext().OPENID;
  try {
    const { data } = await db.collection('carts')
      .where({ userId: openid })
      .orderBy('createTime', 'desc')
      .get();

    // 计算总价
    const totalPrice = data.reduce((sum, item) => {
      return item.selected ? sum + item.price * item.quantity : sum;
    }, 0);

    const totalCount = data.reduce((sum, item) => {
      return item.selected ? sum + item.quantity : sum;
    }, 0);

    return { success: true, data: { list: data, totalPrice, totalCount } };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---------- 加入购物车 ----------
async function addToCart(event) {
  const openid = cloud.getWXContext().OPENID;
  const { dishId, dishName, dishImage, price, quantity = 1 } = event;
  if (!dishId) return { success: false, message: '缺少dishId' };

  try {
    // 先查是否已在购物车中（利用唯一索引 userId+dishId）
    const { data: existList } = await db.collection('carts')
      .where({ userId: openid, dishId }).get();

    if (existList.length > 0) {
      // 已存在 → 增量更新数量
      await db.collection('carts').doc(existList[0]._id).update({
        data: {
          quantity: _.inc(quantity),
          updateTime: db.serverDate()
        }
      });
    } else {
      // 新增
      await db.collection('carts').add({
        data: {
          userId: openid, dishId, dishName, dishImage, price,
          quantity, selected: true,
          createTime: db.serverDate(), updateTime: db.serverDate()
        }
      });
    }
    // 返回最新列表
    return listCart();
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---------- 更新购物车项（数量/勾选状态）----------
async function updateCart(event) {
  const openid = cloud.getWXContext().OPENID;
  const { cartId, quantity, selected } = event;
  if (!cartId) return { success: false, message: '缺少cartId' };

  const updates = { updateTime: db.serverDate() };
  if (quantity !== undefined) updates.quantity = quantity;
  if (selected !== undefined) updates.selected = selected;

  try {
    await db.collection('carts').where({ _id: cartId, userId: openid })
      .update({ data: updates });
    return listCart();
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---------- 移除购物车项 ----------
async function removeFromCart(event) {
  const openid = cloud.getWXContext().OPENID;
  const { cartId } = event;
  if (!cartId) return { success: false, message: '缺少cartId' };

  try {
    await db.collection('carts').where({ _id: cartId, userId: openid }).remove();
    return listCart();
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---------- 清空购物车（下单后调用）----------
async function clearCart() {
  const openid = cloud.getWXContext().OPENID;
  try {
    await db.collection('carts').where({ userId: openid }).remove();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}
