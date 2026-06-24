// pages/order-detail/order-detail.js
const app = getApp();

/** 格式化分→元 */
function fmt(c) { return (c / 100).toFixed(2); }

/** 订单状态映射 */
const STATUS_MAP = {
  pending_pay: '待支付',
  paid: '已支付',
  completed: '已完成',
  cancelled: '已取消'
};

Page({
  data: {
    order: null,
    isLoading: true,
    isError: false,
    errorMsg: '',

    // 预格式化
    statusText: '',
    createTimeText: '',
    finalPriceText: '',
    deliveryFeeText: '',
    totalPriceText: '',

    // 按钮状态
    canPay: false,
    canCancel: false,
    canConfirm: false,
    canDelete: false,
    canReview: false,
    hasReviewed: false,
    isOperating: false,

    // 取餐码复制
    codeCopied: false,
  },

  onLoad(options) {
    this.setData({ orderId: options.id });
    if (options.id) {
      this.loadOrder(options.id);
    } else {
      this.setData({ isLoading: false, isError: true, errorMsg: '缺少订单ID' });
    }
  },

  onShow() {
    // 从评价页返回时刷新评价状态
    if (this.data.order) {
      this.checkReviewStatus();
    }
  },

  async loadOrder(orderId) {
    try {
      const db = wx.cloud.database();
      const { data } = await db.collection('orders').doc(orderId).get();

      if (!data) {
        this.setData({ isLoading: false, isError: true, errorMsg: '订单不存在' });
        return;
      }

      const order = data;
      // 格式化
      order.items.forEach(i => {
        i.priceText = fmt(i.price);
        i.subtotalText = fmt(i.price * i.quantity);
      });

      const statusText = STATUS_MAP[order.status] || order.status;
      const timeText = this.fmtTime(order.createTime);
      const canPay = order.status === 'pending_pay';
      const canCancel = order.status === 'pending_pay';
      const canConfirm = order.pickupType === 'delivery' && order.status === 'paid';
      const canDelete = order.status === 'completed' || order.status === 'cancelled';
      const canReview = order.status === 'completed';

      // 检查是否有评价
      let hasReviewed = false;
      if (order.status === 'completed') {
        try {
          const db = wx.cloud.database();
          const { data } = await db.collection('reviews').where({ orderId }).limit(1).get();
          hasReviewed = data.length > 0;
        } catch (e) { /* 静默 */ }
      }

      this.setData({
        order,
        isLoading: false,
        statusText,
        createTimeText: timeText,
        finalPriceText: fmt(order.finalPrice),
        deliveryFeeText: fmt(order.deliveryFee || 0),
        totalPriceText: fmt(order.totalPrice),
        canPay, canCancel, canConfirm, canDelete, canReview, hasReviewed
      });
    } catch (err) {
      console.error('加载订单失败:', err);
      this.setData({ isLoading: false, isError: true, errorMsg: '加载失败' });
    }
  },

  // ============ 支付 ============
  async handlePay() {
    if (this.data.isOperating) return;
    this.setData({ isOperating: true });
    wx.showLoading({ title: '支付中...', mask: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'payOrder',
        data: { orderId: this.data.order._id }
      });
      wx.hideLoading();

      if (res.result && res.result.success) {
        wx.showToast({ title: '支付成功', icon: 'success' });
        setTimeout(() => this.loadOrder(this.data.order._id), 500);
      } else {
        wx.showToast({ title: res.result.message || '支付失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'error' });
    } finally {
      this.setData({ isOperating: false });
    }
  },

  // ============ 取消订单 ============
  async handleCancel() {
    wx.showModal({
      title: '取消订单',
      content: '确定取消该订单吗？取消后库存将恢复。',
      success: async (res) => {
        if (!res.confirm) return;

        this.setData({ isOperating: true });
        wx.showLoading({ title: '取消中...', mask: true });

        try {
          const result = await wx.cloud.callFunction({
            name: 'cancelOrder',
            data: { mode: 'manual', orderId: this.data.order._id, reason: '用户主动取消' }
          });
          wx.hideLoading();

          if (result.result && result.result.success) {
            wx.showToast({ title: '已取消', icon: 'success' });
            setTimeout(() => this.loadOrder(this.data.order._id), 500);
          } else {
            wx.showToast({ title: result.result.message || '取消失败', icon: 'none' });
          }
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '网络错误', icon: 'error' });
        } finally {
          this.setData({ isOperating: false });
        }
      }
    });
  },

  // ============ 确认收货 ============
  async handleConfirm() {
    wx.showModal({
      title: '确认收货',
      content: '确认已收到餐品？',
      success: async (res) => {
        if (!res.confirm) return;

        this.setData({ isOperating: true });
        wx.showLoading({ title: '确认中...' });

        try {
          const cfRes = await wx.cloud.callFunction({
            name: 'confirmOrder',
            data: { orderId: this.data.order._id }
          });
          wx.hideLoading();

          if (cfRes.result && cfRes.result.success) {
            wx.showToast({ title: '已确认收货', icon: 'success' });
            setTimeout(() => this.loadOrder(this.data.order._id), 500);
          } else {
            wx.showToast({ title: cfRes.result.message || '操作失败', icon: 'none' });
          }
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'error' });
        } finally {
          this.setData({ isOperating: false });
        }
      }
    });
  },

  // ============ 去评价 ============
  handleReview() {
    wx.navigateTo({ url: `/pages/review/review?id=${this.data.orderId}` });
  },

  async checkReviewStatus() {
    try {
      const db = wx.cloud.database();
      const { data } = await db.collection('reviews').where({ orderId: this.data.orderId }).limit(1).get();
      this.setData({ hasReviewed: data.length > 0 });
    } catch (e) { /* 静默 */ }
  },

  // ============ 删除订单 ============
  async handleDeleteOrder() {
    wx.showModal({
      title: '删除订单',
      content: '确定删除该订单吗？删除后不可恢复。',
      success: async (res) => {
        if (!res.confirm) return;

        this.setData({ isOperating: true });
        wx.showLoading({ title: '删除中...', mask: true });

        try {
          const cfRes = await wx.cloud.callFunction({
            name: 'deleteOrder',
            data: { orderId: this.data.order._id }
          });
          wx.hideLoading();

          if (cfRes.result && cfRes.result.success) {
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 1000);
          } else {
            wx.showToast({ title: cfRes.result.message || '删除失败', icon: 'none' });
            this.setData({ isOperating: false });
          }
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '删除失败', icon: 'error' });
          this.setData({ isOperating: false });
        }
      }
    });
  },

  // ============ 复制取餐码 ============
  handleCopyCode() {
    if (!this.data.order || !this.data.order.pickupCode) return;
    wx.setClipboardData({
      data: this.data.order.pickupCode,
      success: () => {
        this.setData({ codeCopied: true });
        wx.showToast({ title: '取餐码已复制', icon: 'success' });
        setTimeout(() => this.setData({ codeCopied: false }), 3000);
      }
    });
  },

  // ============ 辅助 ============
  fmtTime(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date).slice(0, 16).replace('T', ' ');
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  },
});
