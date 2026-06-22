// index.js
Page({
  data: {
    showTip: false,
    powerList: [
      {
        title: "云托管",
        tip: "不限语言的全托管容器服务",
        showItem: false,
        item: [
          {
            type: "cloudbaserun",
            title: "云托管调用",
          },
        ],
      },
      {
        title: "云函数",
        tip: "安全、免鉴权运行业务代码",
        showItem: false,
        item: [
          {
            type: "getOpenId",
            title: "获取OpenId",
          },
          {
            type: "getMiniProgramCode",
            title: "生成小程序码",
          },
        ],
      },
      {
        title: "数据库",
        tip: "安全稳定的文档型数据库",
        showItem: false,
        item: [
          {
            type: "createCollection",
            title: "创建集合",
          },
          {
            type: "selectRecord",
            title: "增删改查记录",
          },
          // {
          //   title: '聚合操作',
          //   page: 'sumRecord',
          // },
        ],
      },
      {
        title: "云存储",
        tip: "自带CDN加速文件存储",
        showItem: false,
        item: [
          {
            type: "uploadFile",
            title: "上传文件",
          },
        ],
      },
      {
        title: "AI 接入能力",
        tip: "云开发 AI 接入能力",
        showItem: false,
        item: [
          {
            type: "model-guide",
            title: "大模型对话指引",
          },
        ],
      },
      {
        title: "AI 智能开发小程序",
        tip: "连接 AI 开发工具与 MCP 开发小程序",
        type: "ai-assistant",
        skipEnvCheck: true,
        showItem: false,
        item: [],
      },
    ],
    haveCreateCollection: false,
    title: "",
    content: "",
  },
  onClickPowerInfo(e) {
    const app = getApp();
    const index = e.currentTarget.dataset.index;
    const powerList = this.data.powerList;
    const selectedItem = powerList[index];
    
    // 检查是否跳过环境配置检测
    if (!selectedItem.skipEnvCheck && !app.globalData.env) {
      wx.showModal({
        title: "提示",
        content: "请在 `miniprogram/app.js` 中正确配置 `env` 参数",
      });
      return;
    }
    if (selectedItem.link) {
      wx.navigateTo({
        url: `../web/index?url=${selectedItem.link}&title=${selectedItem.title}`,
      });
    } else if (selectedItem.type) {
      wx.navigateTo({
        url: `/pages/example/index?envId=${this.data.selectedEnv?.envId}&type=${selectedItem.type}`,
      });
    } else if (selectedItem.page) {
      wx.navigateTo({
        url: `/pages/${selectedItem.page}/index`,
      });
    } else if (
      selectedItem.title === "数据库" &&
      !this.data.haveCreateCollection
    ) {
      this.onClickDatabase(powerList, selectedItem);
    } else {
      selectedItem.showItem = !selectedItem.showItem;
      this.setData({
        powerList,
      });
    }
  },

  jumpPage(e) {
    const { type, page } = e.currentTarget.dataset;
    console.log("jump page", type, page);
    if (type) {
      wx.navigateTo({
        url: `/pages/example/index?envId=${this.data.selectedEnv?.envId}&type=${type}`,
      });
    } else {
      wx.navigateTo({
        url: `/pages/${page}/index?envId=${this.data.selectedEnv?.envId}`,
      });
    }
  },

  // ========== 云函数验证 ==========
  testLogin() {
    this.call('login', { nickName: '测试用户' }, 'loginResult');
  },
  testDishes() {
    this.call('dishes', { action: 'list', page: 1, pageSize: 3 }, 'dishesResult');
  },
  testCart() {
    this.setData({ cartResult: '调用中...' });
    this.getFirstDish(dish => {
      this.call('cart', { action: 'add', dishId: dish._id, dishName: dish.name, dishImage: dish.image || '', price: dish.price, quantity: 1 }, 'cartResult');
    });
  },
  testPlaceOrder() {
    this.setData({ orderResult: '调用中...' });
    this.getFirstDish(dish => {
      wx.cloud.callFunction({
        name: 'placeOrder',
        data: {
          items: [{ dishId: dish._id, dishName: dish.name, image: dish.image || '', price: dish.price, quantity: 1 }],
          orderType: 'instant', pickupType: 'self', pickupTime: '12:00'
        }
      }).then(res => {
        this.setData({ orderResult: JSON.stringify(res.result) });
        if (res.result.success) {
          // 缓存结果供核销和取消使用
          this._lastOrder = res.result.data;
          this.setData({
            verifyResult: '已就绪，点击下面按钮直接核销',
            cancelResult: '已就绪，点击下面按钮取消该订单'
          });
        }
      }).catch(err => {
        this.setData({ orderResult: '错误: ' + err.errMsg });
      });
    });
  },
  testVerify() {
    if (!this._lastOrder) {
      this.setData({ verifyResult: '请先点4下单' });
      return;
    }
    this.call('verifyPickup', { pickupCode: this._lastOrder.pickupCode }, 'verifyResult');
  },
  testCancel() {
    if (!this._lastOrder) {
      this.setData({ cancelResult: '请先点4下单' });
      return;
    }
    this.call('cancelOrder', { mode: 'manual', orderId: this._lastOrder._id, reason: '测试取消' }, 'cancelResult');
  },

  // 获取第一个真实菜品
  getFirstDish(callback) {
    wx.cloud.callFunction({ name: 'dishes', data: { action: 'list', page: 1, pageSize: 1 } }).then(res => {
      if (res.result.success && res.result.data.list.length > 0) {
        callback(res.result.data.list[0]);
      } else {
        this.setData({ orderResult: '未找到菜品，请先初始化数据库' });
      }
    }).catch(err => {
      this.setData({ orderResult: '获取菜品失败: ' + err.errMsg });
    });
  },

  call(name, data, field) {
    this.setData({ [field]: '调用中...' });
    wx.cloud.callFunction({ name, data }).then(res => {
      this.setData({ [field]: JSON.stringify(res.result) });
    }).catch(err => {
      this.setData({ [field]: '错误: ' + err.errMsg });
    });
  },

  onClickDatabase(powerList, selectedItem) {
    wx.showLoading({
      title: "",
    });
    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: {
          type: "createCollection",
        },
      })
      .then((resp) => {
        if (resp.result.success) {
          this.setData({
            haveCreateCollection: true,
          });
        }
        selectedItem.showItem = !selectedItem.showItem;
        this.setData({
          powerList,
        });
        wx.hideLoading();
      })
      .catch((e) => {
        wx.hideLoading();
        const { errCode, errMsg } = e;
        if (errMsg.includes("Environment not found")) {
          this.setData({
            showTip: true,
            title: "云开发环境未找到",
            content:
              "如果已经开通云开发，请检查环境ID与 `miniprogram/app.js` 中的 `env` 参数是否一致。",
          });
          return;
        }
        if (errMsg.includes("FunctionName parameter could not be found")) {
          this.setData({
            showTip: true,
            title: "请上传云函数",
            content:
              "在'cloudfunctions/quickstartFunctions'目录右键，选择【上传并部署-云端安装依赖】，等待云函数上传完成后重试。",
          });
          return;
        }
      });
  },
});
