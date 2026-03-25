// pages/dictation/dictation.js

Page({
  data: {
    currentIndex: 0,
    totalWords: 0,
    currentWord: null,
    isPlaying: false,

    progress: 0,

    speedOptions: ['慢速 (0.7x)', '正常 (1.0x)', '快速 (1.3x)'],
    speedIndex: 1,
    speedValue: 1.0,

    words: [],
    completed: false,

    loading: false,
    errorMsg: ''
  },

  audioContext: null,

  onLoad(options) {
    const app = getApp()
    const session = app.globalData.currentSession

    if (!session || !session.words || session.words.length === 0) {
      wx.showToast({
        title: '未找到听写会话',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({
      words: session.words,
      totalWords: session.words.length,
      currentIndex: session.currentIndex || 0
    })

    // 恢复语速设置
    const savedSpeed = wx.getStorageSync('tts_speed')
    if (savedSpeed !== undefined && savedSpeed !== null) {
      this.setData({
        speedIndex: savedSpeed,
        speedValue: this.getSpeedValue(savedSpeed)
      })
    }

    this.loadCurrentWord()
    this.audioContext = wx.createInnerAudioContext()
  },

  onUnload() {
    if (this.audioContext) {
      this.audioContext.destroy()
    }
    this.saveProgress()
  },

  getSpeedValue(index) {
    const speeds = [0.7, 1.0, 1.3]
    return speeds[index] || 1.0
  },

  loadCurrentWord() {
    const word = this.data.words[this.data.currentIndex]
    if (!word) {
      this.completeDictation()
      return
    }

    this.setData({
      currentWord: word,
      progress: ((this.data.currentIndex) / this.data.totalWords * 100).toFixed(0)
    })

    // 自动播放
    setTimeout(() => {
      this.playWord()
    }, 500)
  },

  // 播放词语
  async playWord() {
    // TTS 功能已移除
    // 原实现使用 ttsManager.getWordAudio() 获取音频
    console.log('[听写] TTS 功能已移除，播放功能暂不可用')
    wx.showToast({
      title: 'TTS 功能已移除',
      icon: 'none',
      duration: 2000
    })
  },

  // 再读一遍
  replayWord() {
    this.playWord()
  },

  // 上一个词
  prevWord() {
    const prevIndex = this.data.currentIndex - 1

    if (prevIndex < 0) {
      wx.showToast({
        title: '已经是第一个词了',
        icon: 'none'
      })
      return
    }

    this.setData({
      currentIndex: prevIndex
    })

    this.saveProgress()
    this.loadCurrentWord()
  },

  // 下一个词
  nextWord() {
    const nextIndex = this.data.currentIndex + 1

    if (nextIndex >= this.data.totalWords) {
      this.completeDictation()
      return
    }

    this.setData({
      currentIndex: nextIndex
    })

    this.saveProgress()
    this.loadCurrentWord()
  },

  // 保存进度
  saveProgress() {
    const app = getApp()
    const session = app.globalData.currentSession
    if (session) {
      session.currentIndex = this.data.currentIndex
      app.saveSession(session)
    }
  },

  // 完成听写
  completeDictation() {
    this.setData({ completed: true })

    // 清除会话
    const app = getApp()
    app.clearSession()
  },

  // 再来一课
  restart() {
    wx.navigateBack()
  },

  // 设置语速
  onSpeedChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      speedIndex: index,
      speedValue: this.getSpeedValue(index)
    })
    wx.setStorageSync('tts_speed', index)
  },

  // 退出确认
  onBack() {
    wx.showModal({
      title: '退出听写',
      content: '进度将保存，下次可以继续',
      success: (res) => {
        if (res.confirm) {
          this.saveProgress()
          wx.navigateBack()
        }
      }
    })
  }
})