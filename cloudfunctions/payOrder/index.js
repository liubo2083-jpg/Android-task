/**
 * 支付云函数（实训模拟支付）
 * 将订单状态从 pending_pay 更新为 paid
 *
 * 输入: { orderId }
 * 输出: { success, data: { orderNo, pickupCode } }
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { orderId } = event;
  if (!orderId) return { success: false, message: '缺少orderId' };

  const openid = cloud.getWXContext().OPENID;

  try {
    const { data: order } = await db.collection('orders').doc(orderId).get();
    if (!order) return { success: false, message: '订单不存在' };
    if (order.userId !== openid) return { success: false, message: '无权操作此订单' };
    if (order.status !== 'pending_pay') {
      return { success: false, message: `订单状态为"${order.status}"，无法支付` };
    }

    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'paid',
        updateTime: db.serverDate()
      }
    });

    return {
      success: true,
      message: '支付成功',
      data: {
        orderNo: order.orderNo,
        pickupCode: order.pickupCode || '',
        finalPrice: order.finalPrice
      }
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
