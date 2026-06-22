// pages/user/user.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    isAdmin: false,
    menuList: [
      { icon: '📋', title: '我的订单', desc: '查看所有订单', url: '/pages/order-list/order-list' },
      { icon: '📍', title: '收货地址', desc: '管理配送地址', url: '/pages/address/address' },
      { icon: '⭐', title: '我的评价', desc: '查看我的评价', url: '' },
      { icon: '🔔', title: '消息通知', desc: '订单通知与提醒', url: '' },
    ],
    adminMenuList: [
      { icon: '🔍', title: '核销管理', desc: '核验取餐凭证', url: '' },
      { icon: '🍽️', title: '菜品管理', desc: '上下架与编辑菜品', url: '' },
      { icon: '📊', title: '订单管理', desc: '查看所有订单', url: '' },
      { icon: '📦', title: '团餐管理', desc: '团餐订单处理', url: '' },
    ],
  },

  onShow() {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || null;
    const isAdmin = userInfo && (userInfo.role === 'admin' || userInfo.role === 'canteen_staff');
    this.setData({ userInfo, isAdmin });
  },

  handleLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  handleMenuTap(e) {
    const { url } = e.currentTarget.dataset;
    if (url) {
      wx.navigateTo({ url });
    } else {
      wx.showToast({ title: '功能开发中', icon: 'none' });
    }
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo');
          app.globalData.userInfo = null;
          this.setData({ userInfo: null, isAdmin: false });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  },
});
