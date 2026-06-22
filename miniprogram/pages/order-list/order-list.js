// pages/order-list/order-list.js
const app = getApp();

Page({
  data: {
    currentTab: 'all',      // all | pending_pay | paid | completed | cancelled
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'pending_pay', label: '待支付' },
      { key: 'paid', label: '已支付' },
      { key: 'completed', label: '已完成' },
      { key: 'cancelled', label: '已取消' },
    ],
    orderList: [],
    page: 1,
    hasMore: true,
    isLoading: false,
    isEmpty: false,
    userInfo: null,
  },

  onShow() {
    this.setData({ userInfo: app.globalData.userInfo });
    if (app.globalData.userInfo) {
      this.loadOrders(true);
    }
  },

  handleLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) return;
    this.setData({ currentTab: tab });
    this.loadOrders(true);
  },

  async loadOrders(reset) {
    if (reset) {
      this.setData({ isLoading: true, page: 1, orderList: [] });
    }

    const openid = app.globalData.userInfo?.openid;
    if (!openid) {
      this.setData({ isLoading: false, isEmpty: true });
      return;
    }

    try {
      const db = wx.cloud.database();
      const _ = db.command;
      const where = { userId: openid };
      if (this.data.currentTab !== 'all') {
        where.status = this.data.currentTab;
      }

      const pageSize = 10;
      const skip = (this.data.page - 1) * pageSize;

      const [listRes, countRes] = await Promise.all([
        db.collection('orders').where(where).orderBy('createTime', 'desc').skip(skip).limit(pageSize).get(),
        db.collection('orders').where(where).count()
      ]);

      const list = listRes.data.map(o => ({
        ...o,
        priceText: (o.finalPrice / 100).toFixed(2),
        // 格式化 createTime 为可读字符串
        timeText: o.createTime ? String(o.createTime).slice(0, 16).replace('T', ' ') : '',
      }));
      const orderList = reset ? list : [...this.data.orderList, ...list];

      this.setData({
        orderList,
        hasMore: skip + list.length < countRes.total,
        isEmpty: orderList.length === 0,
        isLoading: false
      });
    } catch (err) {
      console.error('加载订单失败:', err);
      this.setData({ isLoading: false });
    }
  },

  onReachBottom() {
    if (!this.data.hasMore) return;
    this.setData({ page: this.data.page + 1 });
    this.loadOrders(false);
  },

  onPullDownRefresh() {
    this.loadOrders(true);
    wx.stopPullDownRefresh();
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}` });
  },
});
