// app.js
App({
  globalData: {
    userInfo: null,
    currentSession: null
  },

  onLaunch() {
    // 恢复上次会话
    this.restoreSession()
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