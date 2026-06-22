// pages/dish-detail/dish-detail.js
const app = getApp();

/** 格式化价格：分→元，保留两位小数 */
function fmt(c) { return (c / 100).toFixed(2); }
/** 格式化价格：分→元，整数 */
function fmtSimple(c) { return String(Math.round(c / 100)); }

Page({
  data: {
    dish: null,
    isLoading: true,
    quantity: 1,            // 购买数量
    canAdd: true,           // 库存是否充足
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.loadDishDetail(id);
    } else {
      wx.showToast({ title: '参数错误', icon: 'error' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  /**
   * 加载菜品详情
   */
  async loadDishDetail(dishId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'dishes',
        data: { action: 'detail', dishId }
      });
      if (res.result.success) {
        const dish = res.result.data;
        // 预格式化价格
        dish.priceText = fmt(dish.price);
        dish.originPriceText = dish.originalPrice > dish.price ? fmt(dish.originalPrice) : '';
        dish.ratingText = dish.rating ? dish.rating.toFixed(1) : '';
        this.setData({
          dish,
          isLoading: false,
          canAdd: dish.stock > 0
        });
      } else {
        wx.showToast({ title: '菜品不存在', icon: 'error' });
        setTimeout(() => wx.navigateBack(), 1500);
      }
    } catch (err) {
      console.error('加载菜品详情失败:', err);
      wx.showToast({ title: '加载失败', icon: 'error' });
    }
  },

  /**
   * 增加数量
   */
  handleIncrease() {
    const { quantity, dish } = this.data;
    if (quantity >= dish.stock) {
      wx.showToast({ title: `库存仅剩${dish.stock}份`, icon: 'none' });
      return;
    }
    this.setData({ quantity: quantity + 1 });
  },

  /**
   * 减少数量
   */
  handleDecrease() {
    const { quantity } = this.data;
    if (quantity <= 1) return;
    this.setData({ quantity: quantity - 1 });
  },

  /**
   * 加入购物车
   */
  async handleAddCart() {
    if (!app.globalData.userInfo) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    const { dish, quantity } = this.data;
    try {
      wx.showLoading({ title: '加入中...' });
      const res = await wx.cloud.callFunction({
        name: 'cart',
        data: {
          action: 'add',
          dishId: dish._id,
          dishName: dish.name,
          dishImage: dish.image || '',
          price: dish.price,
          quantity
        }
      });
      wx.hideLoading();
      if (res.result.success) {
        wx.showToast({ title: '已加入购物车', icon: 'success' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'error' });
    }
  },

  /**
   * 立即购买
   */
  handleBuyNow() {
    if (!app.globalData.userInfo) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    const { dish, quantity } = this.data;
    // 将当前菜品作为单个订单项，跳转到下单确认页
    const items = [{
      dishId: dish._id,
      dishName: dish.name,
      image: dish.image || '',
      price: dish.price,
      quantity
    }];
    wx.navigateTo({
      url: `/pages/checkout/checkout?items=${encodeURIComponent(JSON.stringify(items))}`
    });
  },

  /**
   * 预览大图
   */
  handlePreviewImage() {
    const { dish } = this.data;
    if (!dish.image) return;
    wx.previewImage({
      urls: [dish.image],
      current: dish.image
    });
  }
});
