// utils/xunfei.js
// 科大讯飞在线语音合成(TTS)服务

/**
 * 科大讯飞TTS服务类
 * 文档: https://www.xfyun.cn/doc/tts/online_tts/API.html
 */
class XunFeiTSSService {
  constructor(appId, apiKey, apiSecret) {
    this.appId = appId
    this.apiKey = apiKey
    this.apiSecret = apiSecret
    this.baseUrl = 'tts-api.xfyun.cn'
    this.path = '/v2/tts'
  }

  /**
   * HMAC-SHA256签名并返回Base64
   */
  hmacSha256Base64(key, message) {
    const crypto = require('crypto')

    // 微信小程序环境没有crypto模块，使用自定义实现
    const hmac = crypto.createHmac('sha256', key)
    hmac.update(message)
    return hmac.digest('base64')
  }

  /**
   * 简化版HMAC-SHA256实现（兼容微信小程序）
   */
  hmacSha256Simple(key, message) {
    // 使用tts.js中的HMAC实现
    const { HMAC } = require('./tts')
    const hmac = new HMAC(key)
    const result = hmac.sign(message)

    // 转换为base64
    return wx.arrayBufferToBase64(result)
  }

  /**
   * 生成签名URL
   */
  generateAuthUrl() {
    const host = this.baseUrl
    const path = this.path
    const now = new Date()

    // 生成日期字符串 (RFC1123格式)
    const date = now.toUTCString()

    // 生成签名原串
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`

    // 使用apiSecret进行HMAC-SHA256签名
    const signature = this.hmacSha256Simple(this.apiSecret, signatureOrigin)

    // 构建authorization
    const authorizationOrigin = `api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`

    // Base64编码
    const authBuffer = new TextEncoder().encode(authorizationOrigin)
    const authorizationBase64 = wx.arrayBufferToBase64(authBuffer)

    // 构建完整URL
    const url = `wss://${host}${path}?authorization=${encodeURIComponent(authorizationBase64)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`

    return url
  }

  /**
   * 调用科大讯飞TTS API - 在线语音合成
   * @param {string} text - 要合成的文本
   * @param {object} options - 可选参数
   * @returns {Promise<object>} - 返回结果
   */
  async textToVoice(text, options = {}) {
    return new Promise((resolve, reject) => {
      // 生成认证URL
      const url = this.generateAuthUrl()

      // 构建请求参数（按照官方API文档格式）
      const textBase64 = wx.arrayBufferToBase64(new TextEncoder().encode(text))

      const requestBody = {
        common: {
          app_id: this.appId
        },
        business: {
          aue: 'lame', // 音频编码，lame表示mp3
          sfl: 1, // 开启流式返回mp3（配合aue=lame使用）
          auf: 'audio/L16;rate=' + (options.sampleRate || 16000), // 采样率
          vcn: options.voiceType || 'xiaoyan', // 发音人，默认xiaoyan
          speed: options.speed || 50, // 语速 [0-100]
          volume: options.volume || 50, // 音量 [0-100]
          pitch: options.pitch || 50, // 音高 [0-100]
          tte: 'UTF8' // 文本编码
        },
        data: {
          text: textBase64,
          status: 2 // 固定为2，表示一次性传输
        }
      }

      console.log('[讯飞TTS] 开始连接WebSocket')

      // 发送WebSocket请求（科大讯飞TTS使用WebSocket协议）
      const socketTask = wx.connectSocket({
        url: url,
        success: () => {
          console.log('[讯飞TTS] WebSocket连接请求已发送')
        },
        fail: (err) => {
          console.error('[讯飞TTS] WebSocket连接失败:', err)
          reject(new Error('WebSocket连接失败: ' + (err.errMsg || JSON.stringify(err))))
        }
      })

      let audioData = []
      let resultReceived = false
      let connectionClosed = false

      socketTask.onOpen(() => {
        console.log('[讯飞TTS] WebSocket已打开，发送请求')

        // 发送请求
        socketTask.send({
          data: JSON.stringify(requestBody),
          success: () => {
            console.log('[讯飞TTS] 请求已发送')
          },
          fail: (err) => {
            console.error('[讯飞TTS] 发送请求失败:', err)
            if (!connectionClosed) {
              reject(new Error('发送请求失败: ' + (err.errMsg || JSON.stringify(err))))
              socketTask.close()
              connectionClosed = true
            }
          }
        })
      })

      socketTask.onMessage((res) => {
        try {
          const response = JSON.parse(res.data)

          if (response.code !== 0) {
            console.error('[讯飞TTS] API返回错误:', response)
            if (!connectionClosed) {
              reject(new Error(`讯飞TTS错误: ${response.message || '错误码 ' + response.code}`))
              socketTask.close()
              connectionClosed = true
            }
            return
          }

          // 收集音频数据
          if (response.data && response.data.audio) {
            const audioBuffer = wx.base64ToArrayBuffer(response.data.audio)
            audioData.push(audioBuffer)
            console.log('[讯飞TTS] 收到音频片段, 状态:', response.data.status)
          }

          // 检查是否完成 (status=2表示音频传输完成)
          if (response.data && response.data.status === 2) {
            resultReceived = true

            // 合并所有音频数据
            const totalLength = audioData.reduce((sum, arr) => sum + arr.byteLength, 0)
            const combinedBuffer = new Uint8Array(totalLength)
            let offset = 0
            audioData.forEach(arr => {
              combinedBuffer.set(new Uint8Array(arr), offset)
              offset += arr.byteLength
            })

            // 转换为base64
            const audioBase64 = wx.arrayBufferToBase64(combinedBuffer.buffer)

            console.log('[讯飞TTS] 音频合成成功, 总大小:', totalLength, 'bytes')

            socketTask.close()
            connectionClosed = true

            resolve({
              audio: audioBase64,
              codec: 'mp3',
              requestId: response.data?.sid || '',
              size: totalLength
            })
          }
        } catch (error) {
          console.error('[讯飞TTS] 解析响应失败:', error)
          if (!connectionClosed) {
            reject(new Error('解析响应失败: ' + error.message))
            socketTask.close()
            connectionClosed = true
          }
        }
      })

      socketTask.onError((err) => {
        console.error('[讯飞TTS] WebSocket错误:', err)
        if (!connectionClosed) {
          reject(new Error('WebSocket错误: ' + (err.errMsg || JSON.stringify(err))))
          connectionClosed = true
        }
      })

      socketTask.onClose(() => {
        console.log('[讯飞TTS] WebSocket已关闭')
        connectionClosed = true

        if (!resultReceived) {
          reject(new Error('连接关闭但未收到完整响应'))
        }
      })

      // 超时处理
      setTimeout(() => {
        if (!resultReceived && !connectionClosed) {
          console.error('[讯飞TTS] 请求超时')
          socketTask.close()
          connectionClosed = true
          reject(new Error('请求超时（30秒）'))
        }
      }, 30000) // 30秒超时
    })
  }
}

/**
 * 创建科大讯飞TTS服务实例
 * @param {string} appId - 应用ID
 * @param {string} apiKey - API Key
 * @param {string} apiSecret - API Secret
 * @returns {XunFeiTSSService}
 */
function createXunFeiTSSService(appId, apiKey, apiSecret) {
  return new XunFeiTSSService(appId, apiKey, apiSecret)
}

module.exports = {
  XunFeiTSSService,
  createXunFeiTSSService
}
