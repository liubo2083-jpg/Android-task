// pages/review/review.js
const app = getApp();

Page({
  data: {
    orderId: '',
    order: null,
    isLoading: true,
    submitting: false,
    reviews: [], // { dishId, dishName, dishImage, rating, content, images, uploading }
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ orderId: options.id });
      this.loadOrder(options.id);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  async loadOrder(orderId) {
    try {
      const db = wx.cloud.database();
      const { data: order } = await db.collection('orders').doc(orderId).get();

      // 查已提交过的评价
      const { data: existing } = await db.collection('reviews')
        .where({ orderId })
        .get();

      const reviewedDishIds = new Set(existing.map(r => r.dishId));

      const reviews = (order.items || []).map(item => {
        const ex = existing.find(r => r.dishId === item.dishId);
        return {
          dishId: item.dishId,
          dishName: item.dishName,
          dishImage: item.image || '',
          rating: ex ? ex.rating : 0,
          content: ex ? ex.content : '',
          images: ex ? ex.images : [],
          uploading: false,
          hasReviewed: reviewedDishIds.has(item.dishId),
        };
      });

      this.setData({ order, reviews, isLoading: false });
    } catch (err) {
      console.error('加载订单失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  setRating(e) {
    const { dishid: dishId, score } = e.currentTarget.dataset;
    const reviews = this.data.reviews.map(r =>
      r.dishId === dishId ? { ...r, rating: score } : r
    );
    this.setData({ reviews });
  },

  onContentInput(e) {
    const { dishid: dishId } = e.currentTarget.dataset;
    const reviews = this.data.reviews.map(r =>
      r.dishId === dishId ? { ...r, content: e.detail.value } : r
    );
    this.setData({ reviews });
  },

  async chooseImage(e) {
    const { dishid: dishId } = e.currentTarget.dataset;
    const review = this.data.reviews.find(r => r.dishId === dishId);
    if (!review || review.images.length >= 3) return;

    try {
      const res = await wx.chooseImage({
        count: 3 - review.images.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });

      this.setData({
        reviews: this.data.reviews.map(r =>
          r.dishId === dishId ? { ...r, uploading: true } : r
        ),
      });

      const tasks = res.tempFilePaths.map((fp, i) => {
        const ext = fp.split('.').pop() || 'jpg';
        const cloudPath = `reviews/${this.data.orderId}/${dishId}/${Date.now()}_${i}.${ext}`;
        return wx.cloud.uploadFile({ cloudPath, filePath: fp });
      });

      const results = await Promise.all(tasks);
      const fileIDs = results.map(r => r.fileID);

      this.setData({
        reviews: this.data.reviews.map(r =>
          r.dishId === dishId
            ? { ...r, images: [...r.images, ...fileIDs], uploading: false }
            : r
        ),
      });
    } catch (err) {
      console.error('上传图片失败:', err);
      wx.showToast({ title: '上传失败', icon: 'none' });
      this.setData({
        reviews: this.data.reviews.map(r =>
          r.dishId === dishId ? { ...r, uploading: false } : r
        ),
      });
    }
  },

  removeImage(e) {
    const { dishid: dishId, index } = e.currentTarget.dataset;
    const reviews = this.data.reviews.map(r => {
      if (r.dishId !== dishId) return r;
      const images = [...r.images];
      images.splice(index, 1);
      return { ...r, images };
    });
    this.setData({ reviews });
  },

  async submitReviews() {
    const hasRating = this.data.reviews.some(r => r.rating > 0);
    if (!hasRating) {
      wx.showToast({ title: '请至少给一个菜品评分', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...', mask: true });

    try {
      const db = wx.cloud.database();
      const openid = app.globalData.userInfo?.openid;
      const userName = app.globalData.userInfo?.nickName || '匿名用户';
      const userAvatar = app.globalData.userInfo?.avatarUrl || '';

      const tasks = this.data.reviews
        .filter(r => r.rating > 0)
        .map(r =>
          db.collection('reviews').add({
            data: {
              orderId: this.data.orderId,
              userId: openid,
              userName,
              userAvatar,
              dishId: r.dishId,
              dishName: r.dishName,
              dishImage: r.dishImage,
              rating: r.rating,
              content: r.content,
              images: r.images,
              createTime: new Date(),
            },
          })
        );

      await Promise.all(tasks);
      wx.hideLoading();
      wx.showToast({ title: '评价成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (err) {
      console.error('提交评价失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
      this.setData({ submitting: false });
    }
  },
});
