// pages/cart/cart.js
const app = getApp();

/**
 * 格式化价格为显示文本（分 → 元，保留两位小数）
 */
function fmtPrice(cents) {
  return (cents / 100).toFixed(2);
}

Page({
  data: {
    userInfo: null,
    cartList: [],
    totalPrice: 0,
    totalPriceText: '0.00',
    totalCount: 0,
    allSelected: true,
    isLoading: false,
    isEmpty: true,
  },

  onShow() {
    this.setData({ userInfo: app.globalData.userInfo });
    if (app.globalData.userInfo) {
      this.loadCart();
    }
  },

  handleLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  async loadCart() {
    this.setData({ isLoading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'cart',
        data: { action: 'list' }
      });
      if (res.result.success) {
        const { list, totalPrice, totalCount } = res.result.data;
        const allSelected = list.length > 0 && list.every(item => item.selected);
        // 预格式化价格，WXML 不支持 .toFixed()
        const cartList = list.map(item => ({
          ...item,
          priceText: fmtPrice(item.price)
        }));
        this.setData({
          cartList,
          totalPrice,
          totalPriceText: fmtPrice(totalPrice),
          totalCount,
          allSelected,
          isEmpty: list.length === 0
        });
      }
    } catch (err) {
      console.error('加载购物车失败:', err);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async toggleSelect(e) {
    const { id, selected } = e.currentTarget.dataset;
    try {
      await wx.cloud.callFunction({
        name: 'cart',
        data: { action: 'update', cartId: id, selected: !selected }
      });
      this.loadCart();
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'error' });
    }
  },

  async toggleAll() {
    const { cartList, allSelected } = this.data;
    const newSelected = !allSelected;
    try {
      for (const item of cartList) {
        if (item.selected !== newSelected) {
          await wx.cloud.callFunction({
            name: 'cart',
            data: { action: 'update', cartId: item._id, selected: newSelected }
          });
        }
      }
      this.loadCart();
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'error' });
    }
  },

  async changeQuantity(e) {
    const { id, quantity, type } = e.currentTarget.dataset;
    const newQty = type === 'plus' ? quantity + 1 : quantity - 1;
    if (newQty < 1) {
      this.removeItem(e);
      return;
    }
    try {
      await wx.cloud.callFunction({
        name: 'cart',
        data: { action: 'update', cartId: id, quantity: newQty }
      });
      this.loadCart();
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'error' });
    }
  },

  async removeItem(e) {
    const { id } = e.currentTarget.dataset;
    try {
      await wx.cloud.callFunction({
        name: 'cart',
        data: { action: 'remove', cartId: id }
      });
      wx.showToast({ title: '已移除', icon: 'success', duration: 1000 });
      this.loadCart();
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'error' });
    }
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  goCheckout() {
    if (this.data.totalCount === 0) {
      wx.showToast({ title: '请先选择菜品', icon: 'none' });
      return;
    }
    const items = this.data.cartList
      .filter(item => item.selected)
      .map(item => ({
        dishId: item.dishId,
        dishName: item.dishName,
        image: item.dishImage,
        price: item.price,
        quantity: item.quantity
      }));
    wx.navigateTo({
      url: `/pages/checkout/checkout?items=${encodeURIComponent(JSON.stringify(items))}`
    });
  },
});
