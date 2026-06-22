// pages/address/address.js
const app = getApp();

Page({
  data: {
    addressList: [],
    isLoading: true,
    showForm: false,
    formMode: 'add',       // 'add' | 'edit'
    formData: {
      name: '',
      phone: '',
      building: '',
      detail: '',
      tag: '',
      isDefault: false,
    },
    editingId: null,
  },

  onShow() {
    this.loadAddresses();
  },

  // ============ 加载地址列表 ============
  async loadAddresses() {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.openid) {
      this.setData({ isLoading: false, addressList: [] });
      return;
    }

    try {
      const db = wx.cloud.database();
      const { data } = await db.collection('addresses')
        .where({ userId: userInfo.openid })
        .orderBy('isDefault', 'desc')
        .orderBy('createTime', 'desc')
        .get();
      this.setData({ addressList: data, isLoading: false });
    } catch (err) {
      console.error('加载地址失败:', err);
      this.setData({ isLoading: false });
      wx.showToast({ title: '加载失败', icon: 'error' });
    }
  },

  // ============ 弹出表单（添加） ============
  onShowForm() {
    this.setData({
      formMode: 'add',
      editingId: null,
      formData: { name: '', phone: '', building: '', detail: '', tag: '', isDefault: false },
      showForm: true,
    });
  },

  // ============ 弹出表单（编辑） ============
  onEdit(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      formMode: 'edit',
      editingId: item._id,
      formData: {
        name: item.name || '',
        phone: item.phone || '',
        building: item.building || '',
        detail: item.detail || '',
        tag: item.tag || '',
        isDefault: item.isDefault || false,
      },
      showForm: true,
    });
  },

  // ============ 关闭表单 ============
  onHideForm() {
    this.setData({ showForm: false });
  },

  // ============ 表单输入 ============
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({ [`formData.${field}`]: value });
  },

  // ============ 切换默认地址开关 ============
  onToggleDefault(e) {
    this.setData({ 'formData.isDefault': e.detail.value });
  },

  // ============ 保存地址 ============
  async onSave() {
    const { formData, formMode, editingId } = this.data;

    // 校验
    if (!formData.name.trim()) return wx.showToast({ title: '请输入收货人', icon: 'none' });
    if (!formData.phone.trim()) return wx.showToast({ title: '请输入手机号', icon: 'none' });
    if (!formData.phone.match(/^1\d{10}$/)) return wx.showToast({ title: '手机号格式不正确', icon: 'none' });
    if (!formData.building.trim()) return wx.showToast({ title: '请输入楼栋/区域', icon: 'none' });
    if (!formData.detail.trim()) return wx.showToast({ title: '请输入详细地址', icon: 'none' });

    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.openid) {
      return wx.showToast({ title: '请先登录', icon: 'none' });
    }

    wx.showLoading({ title: '保存中...', mask: true });

    try {
      const db = wx.cloud.database();

      // 如果设为默认，先把其他地址的默认取消
      if (formData.isDefault) {
        await db.collection('addresses')
          .where({ userId: userInfo.openid, isDefault: true })
          .update({ data: { isDefault: false } });
      }

      if (formMode === 'add') {
        await db.collection('addresses').add({
          data: {
            userId: userInfo.openid,
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            building: formData.building.trim(),
            detail: formData.detail.trim(),
            tag: formData.tag.trim(),
            isDefault: formData.isDefault,
            createTime: new Date(),
            updateTime: new Date(),
          }
        });
      } else {
        await db.collection('addresses').doc(editingId).update({
          data: {
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            building: formData.building.trim(),
            detail: formData.detail.trim(),
            tag: formData.tag.trim(),
            isDefault: formData.isDefault,
            updateTime: new Date(),
          }
        });
      }

      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.setData({ showForm: false });
      this.loadAddresses();
    } catch (err) {
      wx.hideLoading();
      console.error('保存地址失败:', err);
      wx.showToast({ title: '保存失败', icon: 'error' });
    }
  },

  // ============ 设为默认 ============
  async onSetDefault(e) {
    const id = e.currentTarget.dataset.id;
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (!userInfo) return;

    wx.showLoading({ title: '设置中...', mask: true });
    try {
      const db = wx.cloud.database();
      // 取消所有默认
      await db.collection('addresses')
        .where({ userId: userInfo.openid, isDefault: true })
        .update({ data: { isDefault: false } });
      // 设置新默认
      await db.collection('addresses').doc(id).update({
        data: { isDefault: true, updateTime: new Date() }
      });
      wx.hideLoading();
      wx.showToast({ title: '已设为默认', icon: 'success' });
      this.loadAddresses();
    } catch (err) {
      wx.hideLoading();
      console.error('设置默认失败:', err);
      wx.showToast({ title: '操作失败', icon: 'error' });
    }
  },

  // ============ 删除地址 ============
  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除地址',
      content: '确定删除该地址吗？',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中...', mask: true });
        try {
          const db = wx.cloud.database();
          await db.collection('addresses').doc(id).remove();
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadAddresses();
        } catch (err) {
          wx.hideLoading();
          console.error('删除地址失败:', err);
          wx.showToast({ title: '删除失败', icon: 'error' });
        }
      }
    });
  },
});
