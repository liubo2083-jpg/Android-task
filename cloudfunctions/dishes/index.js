/**
 * 菜品管理云函数
 * action: list | detail | add | update | delete
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d3gsbk3zy97882355' });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { action } = event;

  switch (action) {
    case 'list': return listDishes(event);
    case 'detail': return getDetail(event);
    case 'add': return addDish(event);
    case 'update': return updateDish(event);
    case 'delete': return deleteDish(event);
    default: return { success: false, message: '未知action: ' + action };
  }
};

// ---------- 菜品列表（分页+分类筛选+仅上架）----------
async function listDishes(event) {
  const { categoryId, page = 1, pageSize = 10, mealType, isRecommend } = event;
  const skip = (page - 1) * pageSize;

  const where = { isOnSale: true };
  if (isRecommend) where.isRecommend = true;
  if (categoryId) where.categoryId = categoryId;
  if (mealType) where.mealType = _.in([mealType, 'all']);

  try {
    const [{ data: list }, { total }] = await Promise.all([
      db.collection('dishes').where(where).orderBy('sort', 'asc').skip(skip).limit(pageSize).get(),
      db.collection('dishes').where(where).count()
    ]);

    return {
      success: true,
      data: {
        list,
        total,
        page,
        pageSize,
        hasMore: skip + list.length < total
      }
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---------- 菜品详情 ----------
async function getDetail(event) {
  const { dishId } = event;
  if (!dishId) return { success: false, message: '缺少dishId' };

  try {
    const { data } = await db.collection('dishes').doc(dishId).get();
    if (!data) return { success: false, message: '菜品不存在' };
    return { success: true, data };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---------- 添加菜品（管理员）----------
async function addDish(event) {
  const openid = cloud.getWXContext().OPENID;
  if (!(await isAdmin(openid))) return { success: false, message: '无权限' };

  const dish = {
    name: event.name, categoryId: event.categoryId,
    price: event.price, originalPrice: event.originalPrice || event.price,
    image: event.image || '', description: event.description || '',
    ingredients: event.ingredients || '', stock: event.stock || 50,
    mealType: event.mealType || 'all', isRecommend: !!event.isRecommend,
    isOnSale: true, salesVolume: 0, rating: 0, ratingCount: 0,
    sort: event.sort || 99,
    createTime: db.serverDate(), updateTime: db.serverDate()
  };

  try {
    const { _id } = await db.collection('dishes').add({ data: dish });
    return { success: true, data: { _id, ...dish } };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---------- 更新菜品（管理员）----------
async function updateDish(event) {
  const openid = cloud.getWXContext().OPENID;
  if (!(await isAdmin(openid))) return { success: false, message: '无权限' };

  const { dishId, ...updates } = event;
  if (!dishId) return { success: false, message: '缺少dishId' };
  updates.updateTime = db.serverDate();

  try {
    await db.collection('dishes').doc(dishId).update({ data: updates });
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---------- 删除菜品（管理员，实际下架）----------
async function deleteDish(event) {
  const openid = cloud.getWXContext().OPENID;
  if (!(await isAdmin(openid))) return { success: false, message: '无权限' };

  const { dishId } = event;
  if (!dishId) return { success: false, message: '缺少dishId' };

  try {
    await db.collection('dishes').doc(dishId).update({
      data: { isOnSale: false, updateTime: db.serverDate() }
    });
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ---------- 检查管理员权限 ----------
async function isAdmin(openid) {
  const { data } = await db.collection('users').where({
    openid, role: db.command.in(['admin', 'canteen_staff'])
  }).get();
  return data.length > 0;
}
