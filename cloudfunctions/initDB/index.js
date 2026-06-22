/**
 * 校园点餐系统 - 数据库初始化云函数
 * 
 * 功能：
 *   1. 创建分类初始数据
 *   2. 创建菜品初始数据
 *   3. 建立数据库索引
 * 
 * 调用方式：在云开发控制台 -> 云函数 -> 手动触发
 * 或在小程序中调用: wx.cloud.callFunction({ name: 'initDB' })
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { step } = event; // step: 'categories' | 'dishes' | 'indexes' | 'all'
  const results = {};

  try {
    // Step 1: 插入分类
    if (step === 'categories' || step === 'all' || !step) {
      results.categories = await initCategories();
    }

    // Step 2: 插入菜品（依赖分类已存在）
    if (step === 'dishes' || step === 'all' || !step) {
      // 先查询分类ID
      const cates = await db.collection('categories').get();
      const cateMap = {};
      cates.data.forEach(c => { cateMap[c.name] = c._id; });

      results.dishes = await initDishes(cateMap);
    }

    // Step 3: 创建索引
    if (step === 'indexes' || step === 'all' || !step) {
      results.indexes = await createIndexes();
    }

    return {
      success: true,
      message: '数据库初始化完成',
      results
    };
  } catch (err) {
    return {
      success: false,
      message: err.message,
      stack: err.stack
    };
  }
};

// ---------- 初始化分类 ----------
async function initCategories() {
  const count = await db.collection('categories').count();
  if (count.total > 0) {
    return { message: '分类已存在，跳过', existed: count.total };
  }

  const list = [
    { name: "推荐", icon: "star", sort: 1, isActive: true, createTime: db.serverDate() },
    { name: "主食", icon: "rice", sort: 2, isActive: true, createTime: db.serverDate() },
    { name: "小炒", icon: "stir", sort: 3, isActive: true, createTime: db.serverDate() },
    { name: "面食", icon: "noodle", sort: 4, isActive: true, createTime: db.serverDate() },
    { name: "盖饭", icon: "ricebowl", sort: 5, isActive: true, createTime: db.serverDate() },
    { name: "饮品", icon: "drink", sort: 6, isActive: true, createTime: db.serverDate() },
    { name: "早餐", icon: "breakfast", sort: 7, isActive: true, createTime: db.serverDate() }
  ];

  for (const item of list) {
    await db.collection('categories').add({ data: item });
  }
  return { message: '分类初始化成功', count: list.length };
}

// ---------- 初始化菜品 ----------
async function initDishes(cateMap) {
  const count = await db.collection('dishes').count();
  if (count.total > 0) {
    return { message: '菜品已存在，跳过', existed: count.total };
  }

  const list = [
    // ---- 小炒 ----
    {
      name: "宫保鸡丁", categoryId: cateMap["小炒"] || "",
      price: 1200, originalPrice: 1500,
      image: "", description: "经典川味宫保鸡丁，花生脆香鸡肉嫩滑",
      ingredients: "鸡胸肉、花生、青椒、干辣椒",
      nutrition: { calories: 320, protein: 28, fat: 18, carbs: 12 },
      stock: 50, mealType: "lunch", isRecommend: true,
      sort: 1, isOnSale: true, salesVolume: 156, rating: 4.5, ratingCount: 32,
      createTime: db.serverDate(), updateTime: db.serverDate()
    },
    {
      name: "鱼香肉丝", categoryId: cateMap["小炒"] || "",
      price: 1200, originalPrice: 1400,
      image: "", description: "酸甜微辣，下饭神器",
      ingredients: "猪肉、木耳、胡萝卜、豆瓣酱",
      stock: 50, mealType: "lunch", isRecommend: true,
      sort: 2, isOnSale: true, salesVolume: 132, rating: 4.3, ratingCount: 28,
      createTime: db.serverDate(), updateTime: db.serverDate()
    },
    {
      name: "青椒肉丝", categoryId: cateMap["小炒"] || "",
      price: 1000, originalPrice: 1200,
      image: "", description: "家常小炒，清淡可口",
      ingredients: "猪肉、青椒",
      stock: 50, mealType: "lunch", isRecommend: false,
      sort: 3, isOnSale: true, salesVolume: 98, rating: 4.0, ratingCount: 20,
      createTime: db.serverDate(), updateTime: db.serverDate()
    },
    {
      name: "番茄炒蛋", categoryId: cateMap["小炒"] || "",
      price: 800, originalPrice: 900,
      image: "", description: "酸甜可口，营养美味",
      ingredients: "番茄、鸡蛋",
      stock: 60, mealType: "all", isRecommend: true,
      sort: 4, isOnSale: true, salesVolume: 210, rating: 4.6, ratingCount: 45,
      createTime: db.serverDate(), updateTime: db.serverDate()
    },

    // ---- 面食 ----
    {
      name: "红烧牛肉面", categoryId: cateMap["面食"] || "",
      price: 1500, originalPrice: 1800,
      image: "", description: "大块牛肉配手工拉面",
      ingredients: "牛肉、面条、青菜",
      stock: 30, mealType: "lunch", isRecommend: true,
      sort: 1, isOnSale: true, salesVolume: 87, rating: 4.7, ratingCount: 18,
      createTime: db.serverDate(), updateTime: db.serverDate()
    },
    {
      name: "炸酱面", categoryId: cateMap["面食"] || "",
      price: 1000, originalPrice: 1200,
      image: "", description: "老北京风味炸酱面",
      ingredients: "面条、肉末、黄瓜丝",
      stock: 40, mealType: "lunch", isRecommend: false,
      sort: 2, isOnSale: true, salesVolume: 65, rating: 4.2, ratingCount: 15,
      createTime: db.serverDate(), updateTime: db.serverDate()
    },

    // ---- 盖饭 ----
    {
      name: "红烧肉盖饭", categoryId: cateMap["盖饭"] || "",
      price: 1500, originalPrice: 1800,
      image: "", description: "肥而不腻，入口即化",
      ingredients: "五花肉、土豆",
      stock: 40, mealType: "lunch", isRecommend: true,
      sort: 1, isOnSale: true, salesVolume: 176, rating: 4.8, ratingCount: 38,
      createTime: db.serverDate(), updateTime: db.serverDate()
    },
    {
      name: "黄焖鸡盖饭", categoryId: cateMap["盖饭"] || "",
      price: 1400, originalPrice: 1600,
      image: "", description: "鲜嫩多汁黄焖鸡",
      ingredients: "鸡腿肉、香菇、青椒",
      stock: 40, mealType: "lunch", isRecommend: true,
      sort: 2, isOnSale: true, salesVolume: 145, rating: 4.4, ratingCount: 30,
      createTime: db.serverDate(), updateTime: db.serverDate()
    },
    {
      name: "咖喱鸡块盖饭", categoryId: cateMap["盖饭"] || "",
      price: 1300, originalPrice: 1500,
      image: "", description: "浓郁咖喱配嫩鸡块",
      ingredients: "鸡肉、土豆、胡萝卜、咖喱",
      stock: 40, mealType: "lunch", isRecommend: false,
      sort: 3, isOnSale: true, salesVolume: 112, rating: 4.1, ratingCount: 25,
      createTime: db.serverDate(), updateTime: db.serverDate()
    },

    // ---- 饮品 ----
    {
      name: "冰镇酸梅汤", categoryId: cateMap["饮品"] || "",
      price: 500, originalPrice: 600,
      image: "", description: "消暑解渴酸梅汤",
      stock: 100, mealType: "all",
      sort: 1, isOnSale: true, salesVolume: 320, rating: 4.5, ratingCount: 60,
      createTime: db.serverDate(), updateTime: db.serverDate()
    },
    {
      name: "绿豆汤", categoryId: cateMap["饮品"] || "",
      price: 400, originalPrice: 500,
      image: "", description: "清热解暑绿豆汤",
      stock: 80, mealType: "all",
      sort: 2, isOnSale: true, salesVolume: 280, rating: 4.3, ratingCount: 52,
      createTime: db.serverDate(), updateTime: db.serverDate()
    },

    // ---- 早餐 ----
    {
      name: "鲜肉包子(2个)", categoryId: cateMap["早餐"] || "",
      price: 400, originalPrice: 500,
      image: "", description: "皮薄馅多的鲜肉大包",
      stock: 100, mealType: "breakfast",
      sort: 1, isOnSale: true, salesVolume: 450, rating: 4.2, ratingCount: 88,
      createTime: db.serverDate(), updateTime: db.serverDate()
    },
    {
      name: "豆浆油条套餐", categoryId: cateMap["早餐"] || "",
      price: 500, originalPrice: 600,
      image: "", description: "豆浆+油条+茶叶蛋",
      stock: 80, mealType: "breakfast",
      sort: 2, isOnSale: true, salesVolume: 380, rating: 4.4, ratingCount: 72,
      createTime: db.serverDate(), updateTime: db.serverDate()
    },
    {
      name: "鸡蛋灌饼", categoryId: cateMap["早餐"] || "",
      price: 600, originalPrice: 700,
      image: "", description: "现做鸡蛋灌饼",
      stock: 50, mealType: "breakfast",
      sort: 3, isOnSale: true, salesVolume: 290, rating: 4.6, ratingCount: 56,
      createTime: db.serverDate(), updateTime: db.serverDate()
    }
  ];

  for (const item of list) {
    await db.collection('dishes').add({ data: item });
  }
  return { message: '菜品初始化成功', count: list.length };
}

// ---------- 创建索引 ----------
async function createIndexes() {
  const results = [];

  try {
    // users: openid 唯一索引
    await db.collection('users').createIndex({ openid: 1 }, { unique: true });
    results.push('users.openid 唯一索引 ✓');

    // dishes: 分类+上架+排序 复合索引
    try {
      await db.collection('dishes').createIndex({ categoryId: 1, isOnSale: 1, sort: 1 });
      results.push('dishes(categoryId+isOnSale+sort) 复合索引 ✓');
    } catch (e) { results.push('dishes 复合索引: ' + e.message); }

    // dishes: 推荐菜品索引
    try {
      await db.collection('dishes').createIndex({ isRecommend: 1, sort: 1 });
      results.push('dishes(isRecommend+sort) 索引 ✓');
    } catch (e) { results.push('dishes 推荐索引: ' + e.message); }

    // carts: 用户+菜品 唯一索引（同一用户同一菜品只存一条，更新数量）
    try {
      await db.collection('carts').createIndex({ userId: 1, dishId: 1 }, { unique: true });
      results.push('carts(userId+dishId) 唯一索引 ✓');
    } catch (e) { results.push('carts 唯一索引: ' + e.message); }

    // orders: 订单号唯一索引
    try {
      await db.collection('orders').createIndex({ orderNo: 1 }, { unique: true });
      results.push('orders.orderNo 唯一索引 ✓');
    } catch (e) { results.push('orders.orderNo: ' + e.message); }

    // orders: 用户订单查询
    try {
      await db.collection('orders').createIndex({ userId: 1, createTime: -1 });
      results.push('orders(userId+createTime) 索引 ✓');
    } catch (e) { results.push('orders 用户订单: ' + e.message); }

    // orders: 取餐码查询
    try {
      await db.collection('orders').createIndex({ pickupCode: 1 });
      results.push('orders.pickupCode 索引 ✓');
    } catch (e) { results.push('orders.pickupCode: ' + e.message); }

    // addresses: 用户地址
    try {
      await db.collection('addresses').createIndex({ userId: 1 });
      results.push('addresses.userId 索引 ✓');
    } catch (e) { results.push('addresses: ' + e.message); }

    // reviews: 订单唯一评价
    try {
      await db.collection('reviews').createIndex({ orderId: 1 }, { unique: true });
      results.push('reviews.orderId 唯一索引 ✓');
    } catch (e) { results.push('reviews: ' + e.message); }

    // reviews: 菜品评价查询
    try {
      await db.collection('reviews').createIndex({ dishId: 1, createTime: -1 });
      results.push('reviews(dishId+createTime) 索引 ✓');
    } catch (e) { results.push('reviews 菜品评价: ' + e.message); }

    // group_orders: 团餐编号
    try {
      await db.collection('group_orders').createIndex({ groupNo: 1 }, { unique: true });
      results.push('group_orders.groupNo 唯一索引 ✓');
    } catch (e) { results.push('group_orders: ' + e.message); }

    // group_orders: 用户团餐查询
    try {
      await db.collection('group_orders').createIndex({ userId: 1, createTime: -1 });
      results.push('group_orders(userId+createTime) 索引 ✓');
    } catch (e) { results.push('group_orders 用户索引: ' + e.message); }

  } catch (err) {
    results.push('索引创建异常: ' + err.message);
  }

  return results;
}
