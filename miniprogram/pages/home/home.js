// pages/home/home.js
const app = getApp();

/** 格式化价格：分→元 */
function fmt(c) { return (c / 100).toFixed(0); }
function fmtDiscount(sale, orig) { return (sale / orig * 10).toFixed(1); }

Page({
  data: {
    // 分类
    categories: [],
    activeCategoryId: '',

    // 菜品列表
    dishList: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    total: 0,

    // 状态
    isLoading: true,        // 首次加载（默认 true，进入页面即显示骨架屏）
    isLoadingMore: false,
    isEmpty: false,
    isError: false,         // 加载失败
    errorMsg: '',           // 失败原因
  },

  onLoad() {
    this.loadCategories();
  },

  onShow() {
    if (app.globalData.userInfo) {
      this.updateCartBadge();
    }
  },

  // ==================== 下拉刷新 ====================
  async onPullDownRefresh() {
    try {
      await this.loadCategories();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  // ==================== 上拉加载更多 ====================
  async onReachBottom() {
    if (this.data.isLoadingMore || !this.data.hasMore) return;
    const nextPage = this.data.page + 1;
    this.setData({ isLoadingMore: true, page: nextPage });
    try {
      await this.loadDishes(false);
    } finally {
      this.setData({ isLoadingMore: false });
    }
  },

  // ==================== 加载分类 ====================
  async loadCategories() {
    this.setData({ isLoading: true, isError: false, isEmpty: false });

    try {
      const res = await wx.cloud.callFunction({ name: 'getCategories' });

      if (res.result && res.result.success && res.result.data && res.result.data.length > 0) {
        const categories = res.result.data;
        this.setData({
          categories,
          activeCategoryId: categories[0]._id
        });
        // 加载第一个分类的菜品
        await this.loadDishes(true);
      } else {
        // 分类数据为空（可能未初始化数据库）
        const errMsg = (res.result && res.result.message) || '分类数据为空，请先初始化数据库';
        this.setData({
          isLoading: false,
          isEmpty: true,
          isError: true,
          errorMsg: errMsg
        });
      }
    } catch (err) {
      console.error('加载分类失败:', err);
      // 判断错误类型
      let errorMsg = '网络请求失败';
      if (err.errMsg) {
        if (err.errMsg.includes('FunctionName')) {
          errorMsg = '云函数未部署，请在微信开发者工具中上传 getCategories 云函数';
        } else if (err.errMsg.includes('Environment not found')) {
          errorMsg = '云环境配置错误，请检查 app.js 中的 env 参数';
        } else {
          errorMsg = err.errMsg;
        }
      }
      this.setData({
        isLoading: false,
        isError: true,
        isEmpty: true,
        errorMsg
      });
    }
  },

  // ==================== 加载菜品列表 ====================
  async loadDishes(reset) {
    if (reset) {
      this.setData({ isLoading: true, page: 1, dishList: [] });
    }

    const { activeCategoryId, page, pageSize, categories } = this.data;

    // 防御：当分类列表为空或 activeCategoryId 无效时，跳过请求
    if (!activeCategoryId) {
      this.setData({ isLoading: false, isEmpty: true });
      return;
    }

    // 判断是否为"推荐"tab
    const activeCategory = categories.find(c => c._id === activeCategoryId);
    const isRecommendTab = activeCategory && activeCategory.name === '推荐';

    try {
      const res = await wx.cloud.callFunction({
        name: 'dishes',
        data: {
          action: 'list',
          // 推荐tab：不传categoryId，传isRecommend
          categoryId: isRecommendTab ? undefined : activeCategoryId,
          isRecommend: isRecommendTab ? true : undefined,
          page: reset ? 1 : page,
          pageSize
        }
      });

      if (res.result && res.result.success) {
        const { list, total, page: curPage, hasMore } = res.result.data;
        // 预格式化价格
        const formatted = list.map(d => ({
          ...d,
          priceText: fmt(d.price),
          originPriceText: d.originalPrice > d.price ? fmt(d.originalPrice) : '',
          discountText: d.originalPrice > d.price ? fmtDiscount(d.price, d.originalPrice) + '折' : '',
          ratingText: d.rating ? d.rating.toFixed(1) : '',
        }));
        const newList = reset ? formatted : [...this.data.dishList, ...formatted];

        this.setData({
          dishList: newList,
          total,
          page: curPage,
          hasMore,
          isEmpty: newList.length === 0,
          isError: false,
          isLoading: false
        });
      } else {
        const errMsg = (res.result && res.result.message) || '加载菜品失败';
        this.setData({
          isLoading: false,
          isEmpty: true,
          isError: true,
          errorMsg: errMsg
        });
      }
    } catch (err) {
      console.error('加载菜品失败:', err);
      this.setData({
        isLoading: false,
        isEmpty: this.data.dishList.length === 0,
        isError: true,
        errorMsg: '网络错误，请下拉刷新重试'
      });
    }
  },

  // ==================== 切换分类 ====================
  handleCategoryTap(e) {
    const id = e.currentTarget.dataset.id;
    if (id === this.data.activeCategoryId) return;
    this.setData({ activeCategoryId: id });
    this.loadDishes(true);
  },

  // ==================== 跳转菜品详情 ====================
  handleDishTap(e) {
    const dishId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/dish-detail/dish-detail?id=${dishId}`
    });
  },

  // ==================== 快速加入购物车 ====================
  async handleAddCart(e) {
    const dish = e.currentTarget.dataset.dish;
    if (!app.globalData.userInfo) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    try {
      const res = await wx.cloud.callFunction({
        name: 'cart',
        data: {
          action: 'add',
          dishId: dish._id,
          dishName: dish.name,
          dishImage: dish.image || '',
          price: dish.price,
          quantity: 1
        }
      });
      if (res.result && res.result.success) {
        wx.showToast({ title: '已加入购物车', icon: 'success', duration: 1200 });
        this.updateCartBadge();
      } else {
        wx.showToast({ title: (res.result && res.result.message) || '操作失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'error' });
    }
  },

  // ==================== 重试加载 ====================
  handleRetry() {
    this.loadCategories();
  },

  // ==================== 搜索入口 ====================
  onSearchTap() {
    wx.showToast({ title: '搜索功能开发中', icon: 'none' });
  },

  // ==================== 回到顶部 ====================
  onBackTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  },

  // ==================== 更新购物车角标 ====================
  async updateCartBadge() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'cart',
        data: { action: 'list' }
      });
      if (res.result && res.result.success) {
        const count = res.result.data.totalCount || 0;
        if (count > 0) {
          wx.setTabBarBadge({ index: 2, text: count > 99 ? '99+' : String(count) });
        } else {
          wx.removeTabBarBadge({ index: 2 });
        }
      }
    } catch (err) {
      // 静默处理
    }
  }
});
