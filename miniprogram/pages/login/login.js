// pages/login/login.js
const app = getApp();

Page({
  data: {
    isLoading: false,
    canIUseGetUserProfile: false,
  },

  onLoad() {
    // 检查是否支持新版 getUserProfile
    if (wx.getUserProfile) {
      this.setData({ canIUseGetUserProfile: true });
    }
    // 检查是否已登录过
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo._id) {
      app.globalData.userInfo = userInfo;
      wx.switchTab({ url: '/pages/home/home' });
    }
  },

  /**
   * 微信授权登录
   */
  handleLogin() {
    if (this.data.isLoading) return;
    this.setData({ isLoading: true });

    // 先用 wx.login 获取 code，再通过云函数获取 openid
    wx.showLoading({ title: '登录中...', mask: true });

    // 获取用户信息（新版 API）
    const doLogin = (userProfile) => {
      const nickName = userProfile?.nickName || '';
      const avatarUrl = userProfile?.avatarUrl || '';

      wx.cloud.callFunction({
        name: 'login',
        data: { nickName, avatarUrl }
      }).then(res => {
        wx.hideLoading();
        this.setData({ isLoading: false });

        if (res.result.success) {
          const user = res.result.user;
          // 存储用户信息
          wx.setStorageSync('userInfo', user);
          app.globalData.userInfo = user;

          wx.showToast({
            title: res.result.isNew ? '欢迎新用户!' : '登录成功',
            icon: 'success',
            duration: 1500
          });

          // 延迟跳转，让用户看到提示
          setTimeout(() => {
            wx.switchTab({ url: '/pages/home/home' });
          }, 800);
        } else {
          wx.showToast({
            title: res.result.message || '登录失败',
            icon: 'error'
          });
        }
      }).catch(err => {
        wx.hideLoading();
        this.setData({ isLoading: false });
        console.error('登录失败:', err);
        wx.showToast({ title: '网络错误，请重试', icon: 'error' });
      });
    };

    // 尝试获取微信用户信息
    if (wx.getUserProfile) {
      wx.getUserProfile({
        desc: '用于展示个人头像和昵称',
        success: (res) => {
          doLogin(res.userInfo);
        },
        fail: () => {
          // 用户拒绝授权，使用默认信息登录
          doLogin(null);
        }
      });
    } else {
      // 旧版兼容
      doLogin(null);
    }
  },

  /**
   * 跳过登录，仅浏览
   */
  handleSkip() {
    wx.switchTab({ url: '/pages/home/home' });
  }
});
