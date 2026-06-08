# AI助手供应商更换完成

**时间**: 2026-06-08 20:09  
**状态**: 部署完成

## 已完成

1. 代码修改完成（Anthropic → Deepseek）
2. openai包已安装（v2.41.0）
3. 代码已上传到服务器
4. 服务已重启成功

## 下一步

配置DEEPSEEK_API_KEY：

```bash
ssh -i xiaochengxu.pem ubuntu@122.51.156.252
sudo nano /opt/fapai/backend/.env
# 添加：DEEPSEEK_API_KEY=sk-xxxxx
sudo systemctl restart fapai-backend
```

获取Key: https://platform.deepseek.com/api_keys

## 成本节省

Deepseek比Claude便宜约90%
