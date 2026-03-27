// pages/dictation/dictation.js
const { createTTSService } = require('../../utils/tts')
const { createXunFeiTSSService } = require('../../utils/xunfei')
const { getCacheManager } = require('../../utils/audioCache')
const { getConfigManager } = require('../../utils/ttsConfigManager')

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
  ttsService: null, // 腾讯云TTS（主服务）
  xunfeiService: null, // 科大讯飞TTS（备选服务）
  currentService: 'tencent', // 当前使用的服务
  cacheManager: null,
  configManager: null,

  async onLoad(options) {
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

    this.audioContext = wx.createInnerAudioContext()

    // 初始化配置管理器
    this.configManager = getConfigManager()

    // 初始化缓存管理器
    this.cacheManager = getCacheManager()
    const stats = this.cacheManager.getStats()
    console.log('[听写] 缓存统计:', stats)

    // 初始化TTS服务（异步）
    await this.initTTSServices()

    // TTS服务初始化完成后再加载当前词语（会自动播放）
    this.loadCurrentWord()
  },

  /**
   * 初始化TTS服务
   */
  async initTTSServices() {
    try {
      console.log('[听写] 开始初始化TTS服务...')

      // 从云函数获取配置
      const config = await this.configManager.getConfig()

      // 初始化腾讯云TTS服务（主服务）
      if (config.tencentCloud) {
        const { secretId, secretKey } = config.tencentCloud
        if (secretId && secretKey && secretId !== 'YOUR_TENCENT_SECRET_ID') {
          this.ttsService = createTTSService(secretId, secretKey)
          console.log('[听写] 腾讯云TTS服务已初始化')
        } else {
          console.warn('[听写] 腾讯云密钥未配置')
        }
      }

      // 初始化科大讯飞TTS服务（备选服务）
      if (config.xunfei) {
        const { appId, apiKey, apiSecret } = config.xunfei
        if (appId && apiKey && apiSecret && appId !== 'YOUR_XUNFEI_APP_ID') {
          this.xunfeiService = createXunFeiTSSService(appId, apiKey, apiSecret)
          console.log('[听写] 科大讯飞TTS服务已初始化（备选）')
        } else {
          console.warn('[听写] 科大讯飞密钥未配置')
        }
      }

      // 检查是否有可用的TTS服务
      if (!this.ttsService && !this.xunfeiService) {
        console.error('[听写] 未配置任何TTS服务，请检查云函数环境变量配置')
      } else if (this.ttsService) {
        this.currentService = 'tencent'
        console.log('[听写] 使用腾讯云TTS服务')
      } else {
        this.currentService = 'xunfei'
        console.log('[听写] 使用科大讯飞TTS服务')
      }

    } catch (error) {
      console.error('[听写] TTS服务初始化失败:', error)

      wx.showModal({
        title: '初始化失败',
        content: '无法获取TTS服务配置，请检查云函数是否正确部署。\n错误: ' + error.message,
        showCancel: false
      })
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

  /**
   * 使用腾讯云TTS服务合成语音
   */
  async synthesizeWithTencent(word, ttsSpeed) {
    if (!this.ttsService) {
      throw new Error('腾讯云TTS服务未初始化')
    }

    const result = await this.ttsService.textToVoice(word.text, {
      speed: ttsSpeed,
      voiceType: this.data.voiceValue,
      sampleRate: 16000,
      codec: 'wav',
      volume: 0
    })

    return {
      audio: result.audio,
      codec: 'wav',
      service: 'tencent'
    }
  },

  /**
   * 使用科大讯飞TTS服务合成语音
   */
  async synthesizeWithXunfei(word, ttsSpeed) {
    if (!this.xunfeiService) {
      throw new Error('科大讯飞TTS服务未初始化')
    }

    // 讯飞语速映射：腾讯云 -2到6 -> 讯飞 0到10
    // -2(0.6x) -> 2, -1(0.8x) -> 3, 0(1.0x) -> 5, 1(1.2x) -> 7
    const xunfeiSpeedMap = {
      '-2': 2,
      '-1': 3,
      '0': 5,
      '1': 7
    }
    const xunfeiSpeed = xunfeiSpeedMap[String(ttsSpeed)] || 5

    const result = await this.xunfeiService.textToSpeech(word.text, {
      speed: xunfeiSpeed,
      voice: 'xiaoyan',
      sampleRate: 16000,
      frameSize: this.xunfeiService.frameSize || 6
    })

    return {
      audio: result.audio,
      codec: 'wav',
      service: 'xunfei'
    }
  },

  /**
   * 尝试使用指定服务合成语音，失败则切换服务
   */
  async synthesizeWithFallback(word, ttsSpeed, cacheKey) {
    let lastError = null

    // 尝试主服务
    const primaryService = this.currentService
    console.log(`[听写] 尝试使用主服务: ${primaryService}`)

    try {
      if (primaryService === 'tencent') {
        return await this.synthesizeWithTencent(word, ttsSpeed)
      } else {
        return await this.synthesizeWithXunfei(word, ttsSpeed)
      }
    } catch (error) {
      console.error(`[听写] 主服务(${primaryService})失败:`, error.message)
      lastError = error

      // 尝试切换到备用服务
      const backupService = primaryService === 'tencent' ? 'xunfei' : 'tencent'

      if ((backupService === 'tencent' && this.ttsService) ||
          (backupService === 'xunfei' && this.xunfeiService)) {
        console.log(`[听写] 切换到备用服务: ${backupService}`)

        try {
          let result
          if (backupService === 'tencent') {
            result = await this.synthesizeWithTencent(word, ttsSpeed)
          } else {
            result = await this.synthesizeWithXunfei(word, ttsSpeed)
          }

          // 备用服务成功，更新当前服务
          this.currentService = backupService
          console.log(`[听写] 已切换到备用服务: ${backupService}`)

          return result
        } catch (backupError) {
          console.error(`[听写] 备用服务(${backupService})也失败:`, backupError.message)
          throw lastError
        }
      } else {
        console.warn('[听写] 无可用备用服务')
        throw lastError
      }
    }
  },

  // 播放词语
  async playWord() {
    if (!this.ttsService && !this.xunfeiService) {
      console.error('[听写] TTS服务未初始化，无法播放')
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
      // 生成缓存key
      const ttsSpeed = this.convertSpeedToTTS(this.data.speedValue)
      const cacheKey = this.cacheManager.generateCacheKey(
        word.text,
        ttsSpeed,
        this.data.voiceValue,
        16000,
        'wav'
      )

      let audioPath = null

      // 检查缓存
      if (this.cacheManager.has(cacheKey)) {
        const cached = this.cacheManager.get(cacheKey)
        if (cached) {
          audioPath = cached.path
          console.log('[听写] 使用缓存音频:', cacheKey)
        }
      }

      // 缓存未命中，调用TTS API（带自动切换）
      if (!audioPath) {
        console.log('[听写] 缓存未命中，开始合成语音:', word.text)

        const result = await this.synthesizeWithFallback(word, ttsSpeed, cacheKey)
        console.log(`[听写] 语音合成成功, 使用服务: ${result.service}`)

        // 将base64音频转为ArrayBuffer
        const audioBuffer = wx.base64ToArrayBuffer(result.audio)
        const audioSize = audioBuffer.byteLength

        // 保存到缓存
        audioPath = this.cacheManager.set(cacheKey, audioBuffer, audioSize)

        if (!audioPath) {
          // 缓存保存失败，使用临时文件
          const tempFileName = `tts_audio_${Date.now()}.${result.codec}`
          const fs = wx.getFileSystemManager()
          audioPath = `${wx.env.USER_DATA_PATH}/${tempFileName}`

          await new Promise((resolve, reject) => {
            fs.writeFile({
              filePath: audioPath,
              data: audioBuffer,
              encoding: 'binary',
              success: resolve,
              fail: reject
            })
          })
        }
      }

      // 播放音频
      this.audioContext.src = audioPath
      this.audioContext.play()

      this.setData({ loading: false })

    } catch (error) {
      console.error('[听写] TTS调用失败:', error)

      let errorMsg = '语音合成失败'
      if (error.message) {
        if (error.message.includes('SecretId') || error.message.includes('密钥')) {
          errorMsg = '密钥配置错误'
        } else if (error.message.includes('欠费') || error.message.includes('用尽') || error.message.includes('余额')) {
          errorMsg = '服务余额不足'
        } else if (error.message.includes('超过限制') || error.message.includes('频率')) {
          errorMsg = '请求频率超限'
        } else if (error.message.includes('网络') || error.message.includes('timeout')) {
          errorMsg = '网络连接失败'
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