/**
 * TTS配置管理器
 * 从云函数安全地获取TTS服务密钥
 */

class TTSConfigManager {
  constructor() {
    this.config = null
    this.cacheTime = null
    this.cacheExpiry = 5 * 60 * 1000 // 5分钟缓存
  }

  /**
   * 获取TTS配置
   * @param {boolean} forceRefresh - 是否强制刷新
   * @returns {Promise<object>} TTS配置
   */
  async getConfig(forceRefresh = false) {
    // 检查缓存是否有效
    if (!forceRefresh && this.config && this.cacheTime) {
      const now = Date.now()
      if (now - this.cacheTime < this.cacheExpiry) {
        console.log('[配置管理器] 使用缓存的配置')
        return this.config
      }
    }

    console.log('[配置管理器] 从云函数获取配置')

    try {
      // 调用云函数获取配置
      const res = await wx.cloud.callFunction({
        name: 'getTTSConfig',
        data: {}
      })

      // 云函数返回的结果在 res.result 中
      const config = res.result

      // 验证配置
      if (!config || (!config.tencentCloud && !config.xunfei)) {
        throw new Error('云函数返回的配置无效')
      }

      // 缓存配置
      this.config = config
      this.cacheTime = Date.now()

      console.log('[配置管理器] 配置获取成功')
      return config

    } catch (error) {
      console.error('[配置管理器] 获取配置失败:', error)

      // 如果有缓存，返回缓存（即使过期）
      if (this.config) {
        console.warn('[配置管理器] 使用过期的缓存配置')
        return this.config
      }

      throw error
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.config = null
    this.cacheTime = null
    console.log('[配置管理器] 缓存已清除')
  }

  /**
   * 验证配置是否有效
   * @param {object} config - 配置对象
   * @returns {boolean} 是否有效
   */
  validateConfig(config) {
    if (!config) return false

    // 检查是否有腾讯云配置
    const hasTencent = config.tencentCloud &&
      config.tencentCloud.secretId &&
      config.tencentCloud.secretKey &&
      config.tencentCloud.secretId !== 'YOUR_TENCENT_SECRET_ID' &&
      config.tencentCloud.secretKey !== 'YOUR_TENCENT_SECRET_KEY'

    // 检查是否有讯飞配置
    const hasXunfei = config.xunfei &&
      config.xunfei.appId &&
      config.xunfei.apiKey &&
      config.xunfei.apiSecret &&
      config.xunfei.appId !== 'YOUR_XUNFEI_APP_ID' &&
      config.xunfei.apiKey !== 'YOUR_XUNFEI_API_KEY' &&
      config.xunfei.apiSecret !== 'YOUR_XUNFEI_API_SECRET'

    return hasTencent || hasXunfei
  }
}

// 单例模式
let configManagerInstance = null

function getConfigManager() {
  if (!configManagerInstance) {
    configManagerInstance = new TTSConfigManager()
  }
  return configManagerInstance
}

module.exports = {
  TTSConfigManager,
  getConfigManager
}