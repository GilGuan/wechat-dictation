// pages/dictation/dictation.js
const { createTTSService } = require('../../utils/tts')

// 尝试加载配置文件
let ttsConfig = null
try {
  ttsConfig = require('../../utils/config')
} catch (e) {
  console.warn('[听写] 未找到配置文件 utils/config.js，TTS功能不可用')
  console.warn('[听写] 请复制 utils/config.example.js 为 utils/config.js 并填入腾讯云密钥')
}

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

    voiceOptions: ['智瑜(情感女声)', '智云(通用男声)', '智希(通用女声)', '智梅(通用女声)', '智柯(通用男声)', '智友(通用男声)', '智甜(女童声)', '智萌(男童声)'],
    voiceIndex: 0,
    voiceValue: 101001,

    words: [],
    completed: false,

    loading: false,
    errorMsg: ''
  },

  audioContext: null,
  ttsService: null,

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

    // 恢复音色设置
    const savedVoice = wx.getStorageSync('tts_voice')
    if (savedVoice !== undefined && savedVoice !== null) {
      this.setData({
        voiceIndex: savedVoice,
        voiceValue: this.getVoiceValue(savedVoice)
      })
    }

    this.loadCurrentWord()
    this.audioContext = wx.createInnerAudioContext()

    // 初始化TTS服务
    if (ttsConfig && ttsConfig.tencentCloud) {
      const { secretId, secretKey } = ttsConfig.tencentCloud
      if (secretId && secretKey && secretId !== 'YOUR_SECRET_ID_HERE') {
        this.ttsService = createTTSService(secretId, secretKey)
        console.log('[听写] TTS服务已初始化')
      } else {
        console.warn('[听写] 腾讯云密钥未配置，TTS功能不可用')
      }
    }
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

  getVoiceValue(index) {
    const voices = [101001, 101004, 101026, 101027, 101030, 101054, 101016, 101015]
    return voices[index] || 101001
  },

  /**
   * 将小程序语速设置转换为腾讯云TTS语速参数
   * 小程序: 0.7, 1.0, 1.3
   * 腾讯云: -2到6, 其中-2=0.6倍, -1=0.8倍, 0=1.0倍, 1=1.2倍, 2=1.5倍, 6=2.5倍
   */
  convertSpeedToTTS(speedValue) {
    // 映射关系
    const speedMap = {
      0.7: -1,  // 0.8倍,最接近0.7倍
      1.0: 0,   // 1.0倍
      1.3: 1    // 1.2倍,最接近1.3倍
    }
    return speedMap[speedValue] || 0
  },

  loadCurrentWord() {
    const word = this.data.words[this.data.currentIndex]
    if (!word) {
      this.completeDictation()
      return
    }

    this.setData({
      currentWord: word,
      progress: ((this.data.currentIndex + 1) / this.data.totalWords * 100).toFixed(0)
    })

    // 自动播放
    setTimeout(() => {
      this.playWord()
    }, 500)
  },

  // 播放词语
  async playWord() {
    if (!this.ttsService) {
      wx.showModal({
        title: 'TTS服务未配置',
        content: '请先配置腾讯云密钥。\n复制 utils/config.example.js 为 utils/config.js，并填入你的SecretId和SecretKey。',
        showCancel: false
      })
      return
    }

    if (this.data.isPlaying) {
      console.log('[听写] 正在播放中，跳过')
      return
    }

    const word = this.data.currentWord
    if (!word || !word.text) {
      console.error('[听写] 当前词语为空')
      return
    }

    this.setData({
      isPlaying: true,
      loading: true,
      errorMsg: ''
    })

    try {
      console.log('[听写] 开始合成语音:', word.text)

      // 调用TTS API合成语音
      const ttsSpeed = this.convertSpeedToTTS(this.data.speedValue)
      const result = await this.ttsService.textToVoice(word.text, {
        speed: ttsSpeed,
        voiceType: this.data.voiceValue,
        sampleRate: 16000,
        codec: 'wav',
        volume: 0
      })

      console.log('[听写] 语音合成成功, sessionId:', result.sessionId)

      // 将base64音频转为临时文件
      const audioPath = await this.ttsService.base64ToTempFile(result.audio, 'wav')

      // 播放音频
      this.audioContext.src = audioPath
      this.audioContext.play()

      this.setData({ loading: false })

    } catch (error) {
      console.error('[听写] TTS调用失败:', error)

      let errorMsg = '语音合成失败'
      if (error.message) {
        if (error.message.includes('SecretId')) {
          errorMsg = '密钥配置错误'
        } else if (error.message.includes('欠费') || error.message.includes('用尽')) {
          errorMsg = '腾讯云余额不足'
        } else if (error.message.includes('超过限制')) {
          errorMsg = '请求频率超限'
        } else {
          errorMsg = error.message
        }
      }

      this.setData({
        loading: false,
        errorMsg: errorMsg
      })

      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 3000
      })
    } finally {
      // 播放完成后重置状态
      this.audioContext.onEnded(() => {
        this.setData({ isPlaying: false })
      })

      this.audioContext.onError((err) => {
        console.error('[听写] 音频播放错误:', err)
        this.setData({ isPlaying: false })
        wx.showToast({
          title: '音频播放失败',
          icon: 'none'
        })
      })
    }
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

  // 设置音色
  onVoiceChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      voiceIndex: index,
      voiceValue: this.getVoiceValue(index)
    })
    wx.setStorageSync('tts_voice', index)
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