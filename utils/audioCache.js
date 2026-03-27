/**
 * 音频缓存管理器
 * 使用LRU策略管理TTS音频缓存
 * 限制：微信小程序10MB存储限制
 */

class AudioCacheManager {
  constructor() {
    this.cacheKey = 'tts_audio_cache_index' // 缓存索引存储key
    this.maxSize = 8 * 1024 * 1024 // 最大缓存大小：8MB (留2MB给其他数据)
    this.maxAge = 7 * 24 * 60 * 60 * 1000 // 缓存过期时间：7天
    this.maxItems = 200 // 最大缓存项数量
    this.cacheDir = `${wx.env.USER_DATA_PATH}/tts_cache` // 缓存目录

    this.ensureCacheDir()
    this.cleanupIfNeeded()
  }

  /**
   * 确保缓存目录存在
   */
  ensureCacheDir() {
    try {
      const fs = wx.getFileSystemManager()
      try {
        fs.accessSync(this.cacheDir)
      } catch (e) {
        fs.mkdirSync(this.cacheDir, true)
        console.log('[缓存] 创建缓存目录:', this.cacheDir)
      }
    } catch (error) {
      console.error('[缓存] 创建缓存目录失败:', error)
    }
  }

  /**
   * 生成缓存key
   * 格式: 文本_语速_音色_采样率_格式
   */
  generateCacheKey(text, speed, voiceType, sampleRate = 16000, codec = 'wav') {
    // 使用简单的hash避免文件名过长或特殊字符问题
    const hash = this.simpleHash(`${text}_${speed}_${voiceType}_${sampleRate}_${codec}`)
    return `audio_${hash}.${codec}`
  }

  /**
   * 简单hash函数
   */
  simpleHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * 获取缓存索引
   */
  getCacheIndex() {
    try {
      const index = wx.getStorageSync(this.cacheKey)
      return index || {
        items: {},
        totalSize: 0,
        totalCount: 0,
        lastCleanup: Date.now()
      }
    } catch (error) {
      console.error('[缓存] 读取缓存索引失败:', error)
      return {
        items: {},
        totalSize: 0,
        totalCount: 0,
        lastCleanup: Date.now()
      }
    }
  }

  /**
   * 保存缓存索引
   */
  saveCacheIndex(index) {
    try {
      wx.setStorageSync(this.cacheKey, index)
    } catch (error) {
      console.error('[缓存] 保存缓存索引失败:', error)
    }
  }

  /**
   * 获取缓存文件路径
   */
  getCachePath(cacheKey) {
    return `${this.cacheDir}/${cacheKey}`
  }

  /**
   * 检查缓存是否存在
   */
  has(cacheKey) {
    const index = this.getCacheIndex()
    const item = index.items[cacheKey]

    if (!item) return false

    // 检查是否过期
    if (Date.now() - item.lastAccess > this.maxAge) {
      this.delete(cacheKey)
      return false
    }

    // 检查文件是否存在
    try {
      const fs = wx.getFileSystemManager()
      const filePath = this.getCachePath(cacheKey)
      fs.accessSync(filePath)
      return true
    } catch (e) {
      // 文件不存在，清理索引
      this.delete(cacheKey)
      return false
    }
  }

  /**
   * 获取缓存
   */
  get(cacheKey) {
    const index = this.getCacheIndex()
    const item = index.items[cacheKey]

    if (!item) return null

    // 更新访问时间和频率
    item.lastAccess = Date.now()
    item.accessCount = (item.accessCount || 0) + 1
    this.saveCacheIndex(index)

    const filePath = this.getCachePath(cacheKey)
    console.log('[缓存] 命中:', cacheKey, '大小:', item.size, '访问次数:', item.accessCount)

    return {
      path: filePath,
      size: item.size,
      age: Date.now() - item.createTime
    }
  }

  /**
   * 设置缓存
   */
  set(cacheKey, audioBuffer, size) {
    try {
      const filePath = this.getCachePath(cacheKey)
      const fs = wx.getFileSystemManager()

      // 写入文件
      fs.writeFileSync(filePath, audioBuffer, 'binary')

      // 更新索引
      const index = this.getCacheIndex()

      // 如果已存在，先删除旧的
      if (index.items[cacheKey]) {
        index.totalSize -= index.items[cacheKey].size
      } else {
        index.totalCount++
      }

      index.items[cacheKey] = {
        size: size,
        createTime: Date.now(),
        lastAccess: Date.now(),
        accessCount: 1
      }
      index.totalSize += size

      this.saveCacheIndex(index)

      console.log('[缓存] 保存成功:', cacheKey, '大小:', size, '总大小:', index.totalSize, '总数:', index.totalCount)

      return filePath
    } catch (error) {
      console.error('[缓存] 保存失败:', error)
      return null
    }
  }

  /**
   * 删除单个缓存
   */
  delete(cacheKey) {
    try {
      const index = this.getCacheIndex()
      const item = index.items[cacheKey]

      if (item) {
        // 删除文件
        try {
          const fs = wx.getFileSystemManager()
          const filePath = this.getCachePath(cacheKey)
          fs.unlinkSync(filePath)
        } catch (e) {
          // 文件可能已不存在
        }

        // 更新索引
        index.totalSize -= item.size
        index.totalCount--
        delete index.items[cacheKey]
        this.saveCacheIndex(index)

        console.log('[缓存] 删除:', cacheKey)
      }
    } catch (error) {
      console.error('[缓存] 删除失败:', error)
    }
  }

  /**
   * 清理缓存
   */
  cleanupIfNeeded() {
    const index = this.getCacheIndex()

    // 检查是否需要清理（超过大小限制或数量限制）
    const needCleanup =
      index.totalSize > this.maxSize ||
      index.totalCount > this.maxItems ||
      Date.now() - index.lastCleanup > 24 * 60 * 60 * 1000 // 每天清理一次

    if (!needCleanup) return

    console.log('[缓存] 开始清理... 当前大小:', index.totalSize, '总数:', index.totalCount)

    // 按LRU排序（访问时间 + 访问频率）
    const items = Object.entries(index.items)
      .map(([key, item]) => ({
        key,
        item,
        score: this.calculateLRUScore(item)
      }))
      .sort((a, b) => a.score - b.score) // 分数低的优先删除

    // 删除到满足限制
    let deletedCount = 0
    let deletedSize = 0

    for (const { key, item } of items) {
      if (
        index.totalSize - deletedSize <= this.maxSize * 0.8 && // 清理到80%
        index.totalCount - deletedCount <= this.maxItems * 0.8 &&
        Date.now() - item.lastAccess <= this.maxAge // 不过期的保留
      ) {
        break
      }

      this.delete(key)
      deletedCount++
      deletedSize += item.size
    }

    // 更新最后清理时间
    const updatedIndex = this.getCacheIndex()
    updatedIndex.lastCleanup = Date.now()
    this.saveCacheIndex(updatedIndex)

    console.log('[缓存] 清理完成. 删除:', deletedCount, '个, 释放:', deletedSize, 'bytes')
  }

  /**
   * 计算LRU分数
   * 分数越低，越应该被淘汰
   */
  calculateLRUScore(item) {
    const age = Date.now() - item.lastAccess
    const accessCount = item.accessCount || 1

    // 综合考虑：访问时间（权重70%）+ 访问频率（权重30%）
    // 时间越久远分数越低，访问次数越多分数越高
    const timeScore = 1 / (age + 1) // 归一化时间分数
    const freqScore = accessCount / 10 // 归一化频率分数

    return timeScore * 0.7 + freqScore * 0.3
  }

  /**
   * 清空所有缓存
   */
  clear() {
    try {
      const fs = wx.getFileSystemManager()

      // 删除缓存目录下的所有文件
      const files = fs.readdirSync(this.cacheDir)
      for (const file of files) {
        try {
          fs.unlinkSync(`${this.cacheDir}/${file}`)
        } catch (e) {
          // 忽略单个文件删除失败
        }
      }

      // 清空索引
      wx.removeStorageSync(this.cacheKey)

      console.log('[缓存] 已清空所有缓存')
    } catch (error) {
      console.error('[缓存] 清空失败:', error)
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const index = this.getCacheIndex()
    return {
      totalCount: index.totalCount,
      totalSize: index.totalSize,
      totalSizeMB: (index.totalSize / 1024 / 1024).toFixed(2),
      maxSizeMB: (this.maxSize / 1024 / 1024).toFixed(2),
      usagePercent: ((index.totalSize / this.maxSize) * 100).toFixed(1),
      lastCleanup: new Date(index.lastCleanup).toLocaleString()
    }
  }
}

// 单例模式
let cacheManagerInstance = null

function getCacheManager() {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new AudioCacheManager()
  }
  return cacheManagerInstance
}

module.exports = {
  AudioCacheManager,
  getCacheManager
}