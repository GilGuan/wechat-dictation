# TTS功能配置说明

## 功能概述

本项目已集成腾讯云语音合成(TTS)服务,可以将词语自动转换为语音播放,实现听写功能。

### 特性

- ✅ 腾讯云TTS API v3签名认证
- ✅ 基础语音合成(TextToVoice)
- ✅ 支持多种音色(默认:智瑜-1001)
- ✅ 支持语速调节(慢速/正常/快速)
- ✅ 音频自动缓存和播放
- ✅ 完善的错误处理

## 配置步骤

### 1. 获取腾讯云密钥

1. 访问 [腾讯云API密钥管理](https://console.cloud.tencent.com/cam/capi)
2. 如果没有密钥,点击"新建密钥"创建
3. 复制 `SecretId` 和 `SecretKey`

### 2. 配置密钥

1. 复制配置示例文件:
   ```bash
   cp utils/config.example.js utils/config.js
   ```

2. 编辑 `utils/config.js`,填入你的密钥:
   ```javascript
   module.exports = {
     tencentCloud: {
       secretId: '你的SecretId',
       secretKey: '你的SecretKey'
     }
   }
   ```

### 3. 开通TTS服务

1. 访问 [腾讯云语音合成控制台](https://console.cloud.tencent.com/tts)
2. 如果未开通,点击"立即开通"
3. 可以领取免费额度进行测试

## API文档参考

- [基础语音合成API](https://cloud.tencent.com/document/product/1073/37995)
- [签名方法v3](https://cloud.tencent.com/document/product/1073/37990)
- [音色列表](https://cloud.tencent.com/document/product/1073/92668)

## 音色选择

默认使用 `1001` (智瑜-女声),你可以修改 `pages/dictation/dictation.js` 中的 `voiceType` 参数来更换音色:

```javascript
const result = await this.ttsService.textToVoice(word.word, {
  speed: ttsSpeed,
  voiceType: 1001,  // 修改此处更换音色
  // ...
})
```

常用音色:
- `1001` - 智瑜(女声)
- `1002` - 智美(女声)
- `1003` - 智云(男声)
- `1004` - 智莉(女声)
- `1005` - 智娜(女声)

更多音色请参考 [音色列表](https://cloud.tencent.com/document/product/1073/92668)

## 语速设置

小程序支持三档语速:
- 慢速 (0.7x) → TTS语速 -1 (0.8倍)
- 正常 (1.0x) → TTS语速 0 (1.0倍)
- 快速 (1.3x) → TTS语速 1 (1.2倍)

## 计费说明

腾讯云TTS采用按字符计费,价格参考:
- [计费概述](https://cloud.tencent.com/document/product/1073/34112)

建议:
1. 新用户可先领取免费额度
2. 根据实际使用量选择包年包月或按量计费
3. 在控制台设置余额预警

## 常见问题

### Q: 提示"TTS服务未配置"
A: 请确保已完成配置步骤,特别是创建了 `utils/config.js` 文件

### Q: 提示"密钥配置错误"
A: 检查SecretId和SecretKey是否正确,注意不要有多余空格

### Q: 提示"腾讯云余额不足"
A:
1. 检查账户余额
2. 确认TTS服务已开通
3. 查看是否有免费额度

### Q: 提示"请求频率超限"
A: 默认并发限制为20,如需提升请提交工单申请

### Q: 音频播放失败
A:
1. 检查网络连接
2. 查看控制台错误日志
3. 确认小程序有网络权限

## 安全提示

⚠️ **重要**:
- `utils/config.js` 已添加到 `.gitignore`,不会被提交到Git
- **切勿**将密钥提交到公开仓库
- 生产环境建议使用临时密钥或后端代理

## 技术实现

### 签名算法

使用腾讯云API v3签名方法(TC3-HMAC-SHA256):

1. 拼接规范请求串(CanonicalRequest)
2. 拼接待签名字符串(StringToSign)
3. 计算签名(Signature)
4. 拼接Authorization

详细实现见 `utils/tts.js`

### 音频处理流程

```
文本 → TTS API → Base64音频 → 临时文件 → 播放
```

## 后续优化

可以考虑的优化方向:

- [ ] 音频缓存,避免重复合成
- [ ] 批量预加载下一个词的音频
- [ ] 支持更多音色选择
- [ ] 支持SSML标记语言
- [ ] 添加后端代理,避免密钥暴露

## 许可证

本项目TTS功能基于腾讯云TTS服务实现,使用请遵守腾讯云服务协议。
