// pages/checkout/checkout.js
const app = getApp();

/** 格式化分→元 */
function fmt(c) { return (c / 100).toFixed(2); }

Page({
  data: {
    // 订单项
    items: [],
    totalPrice: 0,
    totalPriceText: '0.00',
    deliveryFee: 200,           // 配送费（分）
    deliveryFeeText: '2.00',
    finalPrice: 0,
    finalPriceText: '0.00',

    // 取餐方式: self | delivery
    pickupType: 'self',

    // 自取时段
    pickupTime: '',
    timeSlots: [
      '10:00-10:30', '10:30-11:00', '11:00-11:30', '11:30-12:00',
      '12:00-12:30', '12:30-13:00', '16:30-17:00', '17:00-17:30',
      '17:30-18:00', '18:00-18:30', '18:30-19:00'
    ],
    showTimePicker: false,

    // 送餐
    addresses: [],
    selectedAddressId: '',
    selectedAddress: null,
    deliveryTime: '',
    showAddressPicker: false,

    // 备注
    remark: '',

    // 状态
    isSubmitting: false,
    isPaying: false,

    // 支付结果
    showPayModal: false,
    payResult: null,
    createdOrder: null,    // 下单成功后暂存的订单信息
  },

  onLoad(options) {
    // 从URL参数解析订单项
    if (options.items) {
      try {
        const items = JSON.parse(decodeURIComponent(options.items));
        this.initPage(items);
      } catch (e) {
        wx.showToast({ title: '参数错误', icon: 'error' });
        setTimeout(() => wx.navigateBack(), 1000);
      }
    } else {
      wx.showToast({ title: '参数错误', icon: 'error' });
      setTimeout(() => wx.navigateBack(), 1000);
    }
  },

  initPage(items) {
    // 预格式化每个 item 的价格
    const formattedItems = items.map(i => ({
      ...i,
      priceText: (i.price / 100).toFixed(0)
    }));
    const totalPrice = formattedItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const deliveryFee = 200;
    const finalPrice = totalPrice + deliveryFee;

    this.setData({
      items: formattedItems,
      totalPrice,
      totalPriceText: fmt(totalPrice),
      deliveryFee,
      deliveryFeeText: fmt(deliveryFee),
      finalPrice,
      finalPriceText: fmt(finalPrice)
    });

    // 加载地址列表
    if (app.globalData.userInfo) {
      this.loadAddresses();
    }
  },

  // ============ 取餐方式切换 ============
  switchPickupType(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.pickupType) return;

    const finalPrice = this.data.totalPrice + (type === 'delivery' ? this.data.deliveryFee : 0);
    this.setData({
      pickupType: type,
      finalPrice,
      finalPriceText: fmt(finalPrice)
    });
  },

  // ============ 自取时段选择 ============
  openTimePicker() {
    this.setData({ showTimePicker: true });
  },
  selectTime(e) {
    this.setData({
      pickupTime: e.currentTarget.dataset.time,
      showTimePicker: false
    });
  },
  closeTimePicker() {
    this.setData({ showTimePicker: false });
  },

  // ============ 地址管理 ============
  async loadAddresses() {
    try {
      const db = wx.cloud.database();
      const openid = app.globalData.userInfo.openid;
      const { data } = await db.collection('addresses')
        .where({ userId: openid })
        .orderBy('isDefault', 'desc')
        .get();
      const defaultAddr = data.find(a => a.isDefault) || data[0];
      this.setData({
        addresses: data,
        selectedAddressId: defaultAddr ? defaultAddr._id : '',
        selectedAddress: defaultAddr || null
      });
    } catch (e) {
      // 地址加载失败不影响下单
    }
  },
  openAddressPicker() {
    if (this.data.addresses.length === 0) {
      wx.showToast({ title: '请先添加收货地址', icon: 'none' });
      return;
    }
    this.setData({ showAddressPicker: true });
  },
  selectAddress(e) {
    const addr = this.data.addresses.find(a => a._id === e.currentTarget.dataset.id);
    this.setData({
      selectedAddressId: addr._id,
      selectedAddress: addr,
      showAddressPicker: false
    });
  },
  closeAddressPicker() {
    this.setData({ showAddressPicker: false });
  },
  goAddAddress() {
    wx.navigateTo({ url: '/pages/address/address' });
  },

  // ============ 配送时间 ============
  inputDeliveryTime(e) {
    this.setData({ deliveryTime: e.detail.value });
  },

  // ============ 备注 ============
  inputRemark(e) {
    this.setData({ remark: e.detail.value });
  },

  // ============ 提交订单 ============
  async handleSubmit() {
    if (this.data.isSubmitting) return;

    // 参数校验
    const { pickupType, pickupTime, deliveryTime, remark } = this.data;
    if (pickupType === 'self' && !pickupTime) {
      wx.showToast({ title: '请选择取餐时段', icon: 'none' });
      return;
    }
    if (pickupType === 'delivery') {
      if (!this.data.selectedAddressId) {
        wx.showToast({ title: '请选择收货地址', icon: 'none' });
        return;
      }
      if (!deliveryTime) {
        wx.showToast({ title: '请选择配送时间', icon: 'none' });
        return;
      }
    }

    // 去重整理 items（确保字段名正确）
    const items = this.data.items.map(i => ({
      dishId: i.dishId,
      dishName: i.dishName,
      image: i.image || '',
      price: i.price,
      quantity: i.quantity
    }));

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '提交中...', mask: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'placeOrder',
        data: {
          items,
          orderType: 'instant',
          pickupType,
          pickupTime: pickupType === 'self' ? pickupTime : undefined,
          addressId: pickupType === 'delivery' ? this.data.selectedAddressId : undefined,
          deliveryTime: pickupType === 'delivery' ? deliveryTime : undefined,
          remark
        }
      });

      wx.hideLoading();
      this.setData({ isSubmitting: false });

      if (res.result && res.result.success) {
        const order = res.result.data;
        // 预格式化支付弹窗中的价格
        order.payPriceText = (order.finalPrice / 100).toFixed(2);
        order.payBtnText = '微信支付 ¥' + order.payPriceText;
        this.setData({
          createdOrder: order,
          showPayModal: true
        });
        // 下单成功后清空购物车
        this.clearCartQuietly();
      } else {
        wx.showModal({
          title: '下单失败',
          content: res.result.message || '请重试',
          showCancel: false
        });
      }
    } catch (err) {
      wx.hideLoading();
      this.setData({ isSubmitting: false });
      wx.showModal({ title: '错误', content: '网络异常，请重试', showCancel: false });
    }
  },

  // ============ 模拟支付 ============
  async handlePay() {
    if (this.data.isPaying || !this.data.createdOrder) return;

    this.setData({ isPaying: true });
    wx.showLoading({ title: '支付中...', mask: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'payOrder',
        data: { orderId: this.data.createdOrder._id }
      });

      wx.hideLoading();
      this.setData({ isPaying: false });

      if (res.result && res.result.success) {
        this.setData({
          showPayModal: false,
          payResult: res.result.data
        });
        // 跳转订单详情
        wx.redirectTo({
          url: `/pages/order-detail/order-detail?id=${this.data.createdOrder._id}`
        });
      } else {
        wx.showModal({
          title: '支付失败',
          content: res.result.message || '请重试',
          showCancel: false
        });
      }
    } catch (err) {
      wx.hideLoading();
      this.setData({ isPaying: false });
      wx.showModal({ title: '错误', content: '网络异常，请重试', showCancel: false });
    }
  },

  closePayModal() {
    this.setData({ showPayModal: false });
    // 关闭支付弹窗后跳转订单详情（订单已生成，可稍后支付）
    if (this.data.createdOrder) {
      wx.redirectTo({
        url: `/pages/order-detail/order-detail?id=${this.data.createdOrder._id}`
      });
    }
  },

  // ============ 辅助 ============
  async clearCartQuietly() {
    try {
      await wx.cloud.callFunction({ name: 'cart', data: { action: 'clear' } });
    } catch (e) {
      // 静默
    }
  }
});
