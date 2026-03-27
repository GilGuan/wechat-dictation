// app.js
const config = require('./config.js')

App({
  globalData: {
    userInfo: null,
    currentSession: null,
    cloudEnvId: config.cloudEnvId
  },

  onLaunch() {
    // 初始化云开发
    this.initCloud()

    // 恢复上次会话
    this.restoreSession()
  },

  /**
   * 初始化云开发
   *
   * 注意：开发者工具可能报错 "webapi_getwxaasyncsecinfo:fail Failed to fetch"
   * 这是微信开发者工具的已知问题，不影响云函数正常使用
   * 参考：https://developers.weixin.qq.com/community/develop/article/doc/00026a5b964580a8bfec0b3b25bc13
   */
  initCloud() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }

    try {
      wx.cloud.init({
        env: this.globalData.cloudEnvId,
        traceUser: true
      })
      console.log('[云开发] 初始化成功')
    } catch (error) {
      console.error('[云开发] 初始化失败:', error)
    }
  },

  /**
   * 设置云开发环境ID
   * @param {string} envId - 云开发环境ID
   */
  setCloudEnvId(envId) {
    this.globalData.cloudEnvId = envId
    // 重新初始化
    this.initCloud()
  },

  restoreSession() {
    try {
      const session = wx.getStorageSync('dictation_session')
      if (session && session.lessonIds && session.lessonIds.length > 0) {
        this.globalData.currentSession = session
        console.log('恢复会话:', session)
      }
    } catch (e) {
      console.error('恢复会话失败:', e)
    }
  },

  saveSession(session) {
    try {
      this.globalData.currentSession = session
      wx.setStorageSync('dictation_session', session)
      console.log('保存会话:', session)
    } catch (e) {
      console.error('保存会话失败:', e)
    }
  },

  clearSession() {
    try {
      this.globalData.currentSession = null
      wx.removeStorageSync('dictation_session')
      console.log('清除会话')
    } catch (e) {
      console.error('清除会话失败:', e)
    }
  }
})