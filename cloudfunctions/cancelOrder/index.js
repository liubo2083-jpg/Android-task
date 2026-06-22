/**
 * 取消订单云函数
 * 
 * 模式1 - 手动取消（用户主动取消）
 *   输入: { mode: 'manual', orderId, reason }
 *   规则: 仅 'pending_pay' 状态可取消
 * 
 * 模式2 - 自动取消（定时触发器调用）
 *   输入: { mode: 'auto' } 或 无参数（默认模式）
 *   规则: 扫描所有 pending_pay 且超过30分钟未支付的订单，批量取消+恢复库存
 *   定时触发器配置: 见 config.json，建议每5分钟执行一次
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d3gsbk3zy97882355' });
const db = cloud.database();
const _ = db.command;

// 超时时间：30分钟（毫秒）
const TIMEOUT_MS = 30 * 60 * 1000;

exports.main = async (event) => {
  const { mode = 'auto' } = event;

  if (mode === 'manual') {
    return manualCancel(event);
  }
  return autoCancel();
};

// ---------- 手动取消 ----------
async function manualCancel(event) {
  const { orderId, reason = '用户主动取消' } = event;
  if (!orderId) return { success: false, message: '缺少orderId' };

  try {
    return db.runTransaction(async (transaction) => {
      const { data: order } = await transaction.collection('orders').doc(orderId).get();
      if (!order) throw new Error('订单不存在');
      if (order.status !== 'pending_pay') {
        throw new Error(`订单状态为"${order.status}"，无法取消`);
      }
      // 恢复库存
      await restoreStock(transaction, order.items);
      // 更新订单
      await transaction.collection('orders').doc(orderId).update({
        data: {
          status: 'cancelled',
          cancelTime: db.serverDate(),
          cancelReason: reason,
          updateTime: db.serverDate()
        }
      });
      return { success: true, message: '订单已取消', orderNo: order.orderNo };
    });
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---------- 自动取消超时订单 ----------
async function autoCancel() {
  const deadline = new Date(Date.now() - TIMEOUT_MS);

  try {
    // 查找所有超时未支付的待支付订单
    const { data: orders } = await db.collection('orders')
      .where({
        status: 'pending_pay',
        createTime: _.lt(deadline)
      })
      .limit(100)
      .get();

    if (orders.length === 0) {
      return { success: true, message: '无超时订单', cancelled: 0 };
    }

    let cancelled = 0;
    const cancelledOrders = [];

    for (const order of orders) {
      try {
        await db.runTransaction(async (transaction) => {
          // 再次确认状态（双重检查，防止并发）
          const { data: latest } = await transaction.collection('orders').doc(order._id).get();
          if (!latest || latest.status !== 'pending_pay') return;

          await restoreStock(transaction, order.items || latest.items);

          await transaction.collection('orders').doc(order._id).update({
            data: {
              status: 'cancelled',
              cancelTime: db.serverDate(),
              cancelReason: '超时未支付，系统自动取消',
              updateTime: db.serverDate()
            }
          });
        });
        cancelled++;
        cancelledOrders.push(order.orderNo);
      } catch (e) {
        console.error(`取消订单 ${order.orderNo} 失败:`, e.message);
      }
    }

    return {
      success: true,
      message: `已取消 ${cancelled} 个超时订单`,
      cancelled,
      orderNos: cancelledOrders
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---------- 恢复库存 ----------
async function restoreStock(transaction, items) {
  for (const item of items) {
    if (!item.dishId) continue;
    try {
      await transaction.collection('dishes').doc(item.dishId).update({
        data: {
          stock: _.inc(item.quantity),
          salesVolume: _.inc(-item.quantity),
          updateTime: db.serverDate()
        }
      });
    } catch (e) {
      console.error(`恢复菜品 ${item.dishName} 库存失败:`, e.message);
    }
  }
}
