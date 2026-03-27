// utils/tts.js
// 腾讯云语音合成(TTS)服务

/**
 * SHA256纯JavaScript实现
 * 用于微信小程序环境(无法使用Node.js的crypto模块)
 */
class SHA256 {
  constructor() {
    this.k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]
  }

  rotateRight(n, x) {
    return (x >>> n) | (x << (32 - n))
  }

  majority(x, y, z) {
    return (x & y) ^ (x & z) ^ (y & z)
  }

  ch(x, y, z) {
    return (x & y) ^ (~x & z)
  }

  sigma0(x) {
    return this.rotateRight(2, x) ^ this.rotateRight(13, x) ^ this.rotateRight(22, x)
  }

  sigma1(x) {
    return this.rotateRight(6, x) ^ this.rotateRight(11, x) ^ this.rotateRight(25, x)
  }

  gamma0(x) {
    return this.rotateRight(7, x) ^ this.rotateRight(18, x) ^ (x >>> 3)
  }

  gamma1(x) {
    return this.rotateRight(17, x) ^ this.rotateRight(19, x) ^ (x >>> 10)
  }

  hash(message) {
    const msg = typeof message === 'string' ? this.stringToBytes(message) : message
    const msgLen = msg.length

    // Padding
    const bitLen = msgLen * 8
    const padding = (msgLen % 64 < 56) ? (56 - msgLen % 64 - 1) : (120 - msgLen % 64 - 1)

    const paddedMsg = new Uint8Array(msgLen + padding + 9)
    paddedMsg.set(msg)
    paddedMsg[msgLen] = 0x80

    // Append length
    const view = new DataView(paddedMsg.buffer)
    view.setUint32(msgLen + padding + 1, Math.floor(bitLen / 0x100000000), false)
    view.setUint32(msgLen + padding + 5, bitLen, false)

    // Initial hash values
    let h0 = 0x6a09e667
    let h1 = 0xbb67ae85
    let h2 = 0x3c6ef372
    let h3 = 0xa54ff53a
    let h4 = 0x510e527f
    let h5 = 0x9b05688c
    let h6 = 0x1f83d9ab
    let h7 = 0x5be0cd19

    // Process each 64-byte chunk
    const chunks = Math.floor(paddedMsg.length / 64)
    const w = new Uint32Array(64)

    for (let i = 0; i < chunks; i++) {
      const offset = i * 64

      // Prepare message schedule
      for (let j = 0; j < 16; j++) {
        w[j] = view.getUint32(offset + j * 4, false)
      }

      for (let j = 16; j < 64; j++) {
        w[j] = (this.gamma1(w[j - 2]) + w[j - 7] + this.gamma0(w[j - 15]) + w[j - 16]) >>> 0
      }

      // Working variables
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7

      for (let j = 0; j < 64; j++) {
        const t1 = (h + this.sigma1(e) + this.ch(e, f, g) + this.k[j] + w[j]) >>> 0
        const t2 = (this.sigma0(a) + this.majority(a, b, c)) >>> 0
        h = g
        g = f
        f = e
        e = (d + t1) >>> 0
        d = c
        c = b
        b = a
        a = (t1 + t2) >>> 0
      }

      h0 = (h0 + a) >>> 0
      h1 = (h1 + b) >>> 0
      h2 = (h2 + c) >>> 0
      h3 = (h3 + d) >>> 0
      h4 = (h4 + e) >>> 0
      h5 = (h5 + f) >>> 0
      h6 = (h6 + g) >>> 0
      h7 = (h7 + h) >>> 0
    }

    // Produce final hash value (big-endian)
    const result = new Uint8Array(32)
    const resultView = new DataView(result.buffer)
    resultView.setUint32(0, h0, false)
    resultView.setUint32(4, h1, false)
    resultView.setUint32(8, h2, false)
    resultView.setUint32(12, h3, false)
    resultView.setUint32(16, h4, false)
    resultView.setUint32(20, h5, false)
    resultView.setUint32(24, h6, false)
    resultView.setUint32(28, h7, false)

    return result
  }

  stringToBytes(str) {
    const bytes = new Uint8Array(str.length * 3)
    let pos = 0
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i)
      if (code < 0x80) {
        bytes[pos++] = code
      } else if (code < 0x800) {
        bytes[pos++] = 0xC0 | (code >> 6)
        bytes[pos++] = 0x80 | (code & 0x3F)
      } else {
        bytes[pos++] = 0xE0 | (code >> 12)
        bytes[pos++] = 0x80 | ((code >> 6) & 0x3F)
        bytes[pos++] = 0x80 | (code & 0x3F)
      }
    }
    return bytes.slice(0, pos)
  }

  bytesToHex(bytes) {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
}

/**
 * HMAC-SHA256实现
 */
class HMAC {
  constructor(key) {
    this.sha256 = new SHA256()
    const keyBytes = typeof key === 'string' ? this.sha256.stringToBytes(key) : key

    // Keys longer than blockSize are hashed
    if (keyBytes.length > 64) {
      this.key = this.sha256.hash(keyBytes)
    } else {
      this.key = new Uint8Array(64)
      this.key.set(keyBytes)
    }
  }

  sign(message) {
    const msgBytes = typeof message === 'string' ? this.sha256.stringToBytes(message) : message

    // ipad and opad
    const ipad = new Uint8Array(64)
    const opad = new Uint8Array(64)

    for (let i = 0; i < 64; i++) {
      ipad[i] = this.key[i] ^ 0x36
      opad[i] = this.key[i] ^ 0x5c
    }

    // Inner hash
    const innerData = new Uint8Array(64 + msgBytes.length)
    innerData.set(ipad)
    innerData.set(msgBytes, 64)
    const innerHash = this.sha256.hash(innerData)

    // Outer hash
    const outerData = new Uint8Array(64 + 32)
    outerData.set(opad)
    outerData.set(innerHash, 64)
    const outerHash = this.sha256.hash(outerData)

    return outerHash
  }
}

/**
 * 腾讯云TTS服务类
 * 文档: https://cloud.tencent.com/document/product/1073/37995
 */
class TTSService {
  constructor(secretId, secretKey) {
    this.secretId = secretId
    this.secretKey = secretKey
    this.endpoint = 'tts.tencentcloudapi.com'
    this.service = 'tts'
    this.version = '2019-08-23'
    this.region = '' // 可选参数
  }

  /**
   * SHA256哈希
   */
  sha256(message) {
    const sha256 = new SHA256()
    const hash = sha256.hash(message)
    return sha256.bytesToHex(hash)
  }

  /**
   * HMAC-SHA256签名
   */
  hmacSha256(key, message) {
    const hmac = new HMAC(key)
    const result = hmac.sign(message)
    return result
  }

  /**
   * HMAC-SHA256签名(返回hex)
   */
  hmacSha256Hex(key, message) {
    const hmac = new HMAC(key)
    const result = hmac.sign(message)
    const sha256 = new SHA256()
    return sha256.bytesToHex(result)
  }

  /**
   * 获取UTC日期字符串
   */
  getDate(timestamp) {
    const date = new Date(timestamp * 1000)
    const year = date.getUTCFullYear()
    const month = ('0' + (date.getUTCMonth() + 1)).slice(-2)
    const day = ('0' + date.getUTCDate()).slice(-2)
    return `${year}-${month}-${day}`
  }

  /**
   * 生成签名
   * 签名方法v3文档: https://cloud.tencent.com/document/product/1073/37990
   */
  generateSignature(payload, timestamp, action) {
    const algorithm = 'TC3-HMAC-SHA256'
    const date = this.getDate(timestamp)

    // 步骤1: 拼接规范请求串
    const httpRequestMethod = 'POST'
    const canonicalUri = '/'
    const canonicalQueryString = ''
    const canonicalHeaders =
      `content-type:application/json; charset=utf-8\n` +
      `host:${this.endpoint}\n` +
      `x-tc-action:${action.toLowerCase()}\n`
    const signedHeaders = 'content-type;host;x-tc-action'
    const hashedRequestPayload = this.sha256(payload)
    const canonicalRequest =
      httpRequestMethod + '\n' +
      canonicalUri + '\n' +
      canonicalQueryString + '\n' +
      canonicalHeaders + '\n' +
      signedHeaders + '\n' +
      hashedRequestPayload

    // 步骤2: 拼接待签名字符串
    const credentialScope = date + '/' + this.service + '/' + 'tc3_request'
    const hashedCanonicalRequest = this.sha256(canonicalRequest)
    const stringToSign =
      algorithm + '\n' +
      timestamp.toString() + '\n' +
      credentialScope + '\n' +
      hashedCanonicalRequest

    // 步骤3: 计算签名
    const secretDate = this.hmacSha256('TC3' + this.secretKey, date)
    const secretService = this.hmacSha256(secretDate, this.service)
    const secretSigning = this.hmacSha256(secretService, 'tc3_request')
    const signature = this.hmacSha256Hex(secretSigning, stringToSign)

    // 步骤4: 拼接Authorization
    const authorization =
      algorithm + ' ' +
      'Credential=' + this.secretId + '/' + credentialScope + ', ' +
      'SignedHeaders=' + signedHeaders + ', ' +
      'Signature=' + signature

    return authorization
  }

  /**
   * 调用腾讯云TTS API - 基础语音合成
   * @param {string} text - 要合成的文本
   * @param {object} options - 可选参数
   * @returns {Promise<object>} - 返回结果
   */
  async textToVoice(text, options = {}) {
    const timestamp = Math.floor(Date.now() / 1000)
    const action = 'TextToVoice'
    const sessionId = 'session-' + Date.now()

    // 构建请求参数
    const requestBody = {
      Text: text,
      SessionId: sessionId,
      Volume: options.volume || 0,
      Speed: options.speed || 0,
      ProjectId: options.projectId || 0,
      ModelType: options.modelType || 1,
      VoiceType: options.voiceType || 101001, // 默认使用音色101001(智瑜-情感女声)
      PrimaryLanguage: options.primaryLanguage || 1, // 1-中文
      SampleRate: options.sampleRate || 16000,
      Codec: options.codec || 'wav',
      EnableSubtitle: options.enableSubtitle || false
    }

    const payload = JSON.stringify(requestBody)
    const authorization = this.generateSignature(payload, timestamp, action)

    // 构建请求头
    const headers = {
      'Authorization': authorization,
      'Content-Type': 'application/json; charset=utf-8',
      'Host': this.endpoint,
      'X-TC-Action': action,
      'X-TC-Timestamp': timestamp.toString(),
      'X-TC-Version': this.version
    }

    if (this.region) {
      headers['X-TC-Region'] = this.region
    }

    try {
      // 发送请求
      const response = await new Promise((resolve, reject) => {
        wx.request({
          url: `https://${this.endpoint}`,
          method: 'POST',
          header: headers,
          data: requestBody,
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res.data)
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`))
            }
          },
          fail: (err) => {
            reject(err)
          }
        })
      })

      // 检查响应
      if (response.Response && response.Response.Error) {
        throw new Error(response.Response.Error.Message || 'TTS API调用失败')
      }

      if (!response.Response || !response.Response.Audio) {
        throw new Error('TTS响应格式错误')
      }

      return {
        audio: response.Response.Audio,
        sessionId: response.Response.SessionId,
        subtitles: response.Response.Subtitles || [],
        requestId: response.Response.RequestId
      }
    } catch (error) {
      console.error('[TTS] API调用失败:', error)
      throw error
    }
  }

  /**
   * 将base64音频数据转换为临时文件
   * @param {string} base64Audio - base64编码的音频数据
   * @param {string} codec - 音频格式(wav/mp3)
   * @returns {Promise<string>} - 临时文件路径
   */
  async base64ToTempFile(base64Audio, codec = 'wav') {
    return new Promise((resolve, reject) => {
      // 创建临时文件路径
      const fs = wx.getFileSystemManager()
      const filePath = `${wx.env.USER_DATA_PATH}/tts_audio_${Date.now()}.${codec}`

      // 将base64转换为ArrayBuffer
      const buffer = wx.base64ToArrayBuffer(base64Audio)

      // 写入文件
      fs.writeFile({
        filePath: filePath,
        data: buffer,
        encoding: 'binary',
        success: () => {
          console.log('[TTS] 音频文件已保存:', filePath)
          resolve(filePath)
        },
        fail: (err) => {
          console.error('[TTS] 保存音频文件失败:', err)
          reject(err)
        }
      })
    })
  }
}

/**
 * 创建TTS服务实例
 * @param {string} secretId - 腾讯云SecretId
 * @param {string} secretKey - 腾讯云SecretKey
 * @returns {TTSService}
 */
function createTTSService(secretId, secretKey) {
  return new TTSService(secretId, secretKey)
}

module.exports = {
  SHA256,
  HMAC,
  TTSService,
  createTTSService
}
