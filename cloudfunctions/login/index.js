/**
 * 登录/注册云函数
 * 微信授权登录，获取 openid，自动创建/更新用户信息
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d3gsbk3zy97882355' });
const db = cloud.database();

exports.main = async (event) => {
  const { nickName, avatarUrl } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return { success: false, message: '获取openid失败' };
  }

  try {
    // 查用户是否已存在
    const { data: users } = await db.collection('users').where({ openid }).get();

    if (users.length > 0) {
      // 老用户 → 更新昵称头像
      const user = users[0];
      if (nickName || avatarUrl) {
        await db.collection('users').doc(user._id).update({
          data: {
            nickName: nickName || user.nickName,
            avatarUrl: avatarUrl || user.avatarUrl,
            updateTime: db.serverDate()
          }
        });
      }
      return {
        success: true,
        isNew: false,
        user: { ...user, nickName: nickName || user.nickName, avatarUrl: avatarUrl || user.avatarUrl }
      };
    }

    // 新用户 → 注册
    const newUser = {
      openid,
      nickName: nickName || '微信用户',
      avatarUrl: avatarUrl || '',
      role: 'student',
      phone: '',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    };

    const { _id } = await db.collection('users').add({ data: newUser });
    return { success: true, isNew: true, user: { ...newUser, _id } };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
