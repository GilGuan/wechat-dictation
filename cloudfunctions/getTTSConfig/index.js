// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

/**
 * TTS配置云函数
 * 安全地返回TTS服务密钥
 */
exports.main = async (event, context) => {
  // 腾讯云TTS配置（主服务）
  const tencentConfig = {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY
  }

  // 科大讯飞TTS配置（备选服务）
  const xunfeiConfig = {
    appId: process.env.XUNFEI_APP_ID,
    apiKey: process.env.XUNFEI_API_KEY,
    apiSecret: process.env.XUNFEI_API_SECRET
  }

  // 返回配置
  return {
    tencentCloud: tencentConfig,
    xunfei: xunfeiConfig,
    timestamp: Date.now()
  }
}