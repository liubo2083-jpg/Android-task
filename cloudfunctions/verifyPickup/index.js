/**
 * 取餐核销云函数
 * 食堂管理员输入/扫描取餐凭证码，校验并核销
 * 核销成功 → 更新订单状态为已完成
 * 
 * 输入: { pickupCode }
 * 输出: { success, data: { orderNo, userName, dishNames, pickupTime } }
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d3gsbk3zy97882355' });
const db = cloud.database();

exports.main = async (event) => {
  const { pickupCode } = event;
  if (!pickupCode) return { success: false, message: '请输入取餐码' };

  try {
    // 查订单
    const { data: orders } = await db.collection('orders')
      .where({ pickupCode })
      .get();

    if (orders.length === 0) {
      return { success: false, message: '取餐码无效，未找到对应订单' };
    }

    const order = orders[0];

    // 校验订单状态
    if (order.status === 'cancelled') {
      return { success: false, message: '该订单已取消，无法核销' };
    }
    if (order.status === 'completed') {
      return { success: false, message: '该订单已完成，请勿重复核销' };
    }
    // 实训阶段不接入真实支付，pending_pay 也允许核销
    // 真实上线时可取消注释下面代码恢复支付校验
    // if (order.status === 'pending_pay') {
    //   return { success: false, message: '该订单未支付，无法核销' };
    // }
    if (order.pickupStatus === 'picked') {
      return { success: false, message: '该取餐码已核销，请勿重复取餐' };
    }

    // 执行核销
    await db.collection('orders').doc(order._id).update({
      data: {
        pickupStatus: 'picked',
        status: 'completed',
        updateTime: db.serverDate()
      }
    });

    // 拼菜品名称列表
    const dishNames = (order.items || []).map(i => i.dishName).join('、');

    return {
      success: true,
      message: '核销成功',
      data: {
        orderNo: order.orderNo,
        userName: order.userName,
        dishes: dishNames,
        pickupTime: order.pickupTime,
        pickupType: order.pickupType
      }
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
