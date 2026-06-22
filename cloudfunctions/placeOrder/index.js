/**
 * 下单云函数 - 核心业务
 * 
 * 使用云数据库事务保证原子性：
 *   校验库存 → 扣减库存 → 生成订单 → 生成取餐码
 *   任一步骤失败则全部回滚
 * 
 * 输入参数:
 *   items: [{dishId, dishName, image, price, quantity}]
 *   orderType: 'instant' | 'reserve'
 *   pickupType: 'self' | 'delivery'
 *   pickupTime: 自取时段 (pickupType='self' 时必填)
 *   addressId: 地址ID (pickupType='delivery' 时必填)
 *   deliveryTime: 配送时间 (pickupType='delivery' 时必填)
 *   remark: 备注 (可选)
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d3gsbk3zy97882355' });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const {
    items,
    orderType = 'instant',
    pickupType = 'self',
    pickupTime,
    addressId,
    deliveryTime,
    remark = ''
  } = event;

  // 参数校验
  if (!items || items.length === 0) {
    return { success: false, message: '订单项不能为空' };
  }

  try {
    const result = await db.runTransaction(async (transaction) => {

      // 1. 校验每个菜品的库存并扣减
      for (const item of items) {
        const { data: dish } = await transaction.collection('dishes').doc(item.dishId).get();
        if (!dish) throw new Error(`菜品 ${item.dishName} 不存在`);
        if (dish.stock < item.quantity) {
          throw new Error(`菜品 "${dish.name}" 库存不足 (剩余${dish.stock}份)`);
        }
        // 扣减库存
        await transaction.collection('dishes').doc(item.dishId).update({
          data: {
            stock: dish.stock - item.quantity,
            salesVolume: (dish.salesVolume || 0) + item.quantity,
            updateTime: db.serverDate()
          }
        });
      }

      // 2. 计算金额
      const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const deliveryFee = pickupType === 'delivery' ? 200 : 0; // 配送费2元
      const finalPrice = totalPrice + deliveryFee;

      // 3. 生成订单号和取餐码
      const orderNo = generateOrderNo();
      const pickupCode = pickupType === 'self' ? generatePickupCode() : '';

      // 4. 获取地址快照（送餐时）
      let addressSnapshot = null;
      if (pickupType === 'delivery' && addressId) {
        const { data: addr } = await transaction.collection('addresses').doc(addressId).get();
        if (addr) {
          addressSnapshot = {
            name: addr.name,
            phone: addr.phone,
            building: addr.building,
            detail: addr.detail
          };
        }
      }

      // 5. 获取用户信息
      const { data: users } = await transaction.collection('users').where({ openid }).get();
      const user = users[0] || {};
      const userPhone = user.phone || '';

      // 6. 写入订单
      const orderData = {
        orderNo,
        userId: openid,
        userName: user.nickName || '用户',
        userPhone,
        orderType,
        pickupType,
        pickupTime: pickupType === 'self' ? pickupTime : '',
        pickupCode,
        pickupStatus: pickupType === 'self' ? 'pending' : 'noneed',
        deliveryStatus: pickupType === 'delivery' ? 'pending' : 'noneed',
        addressId: addressId || '',
        addressSnapshot,
        deliveryTime: deliveryTime || '',
        items,
        totalPrice,
        deliveryFee,
        finalPrice,
        status: 'pending_pay',
        remark,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      };

      const { _id } = await transaction.collection('orders').add({ data: orderData });

      return {
        _id,
        orderNo,
        pickupCode,
        finalPrice,
        deliveryFee,
        totalPrice
      };
    });

    return { success: true, data: result };

  } catch (err) {
    return { success: false, message: err.message };
  }
};

// ---------- 生成订单号: YYYYMMDDHHmmss + 6位随机数 ----------
function generateOrderNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  const min = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  const rand = Math.floor(Math.random() * 900000 + 100000);
  return `${y}${m}${d}${h}${min}${s}${rand}`;
}

// ---------- 生成取餐码: 8位字母数字 ----------
function generatePickupCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符 I/1/O/0
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}
