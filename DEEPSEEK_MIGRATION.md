# AI助手供应商更换 - Anthropic Claude → Deepseek V3

**更换时间**: 2026-06-08  
**状态**: ✅ 代码已修改完成

---

## 📝 改动内容

### API供应商更换

| 项目 | 原值 | 新值 |
|------|------|------|
| SDK | anthropic | openai |
| 环境变量 | ANTHROPIC_API_KEY | DEEPSEEK_API_KEY |
| API地址 | api.anthropic.com | api.deepseek.com |
| 模型 | claude-3-5-sonnet | deepseek-chat |

### 修改的文件
- ✅ `backend/app/api/admin/ai.py` - 已完成修改

---

## 🔧 部署步骤

### 1. 安装openai包（服务器）
```bash
ssh -i xiaochengxu.pem ubuntu@122.51.156.252
cd /opt/fapai/backend
source venv/bin/activate
pip install openai
```

### 2. 配置API Key
```bash
nano .env
# 添加：DEEPSEEK_API_KEY=sk-xxxx
```

### 3. 上传代码并重启
```bash
# 本地上传
scp -i xiaochengxu.pem backend/app/api/admin/ai.py ubuntu@122.51.156.252:/opt/fapai/backend/app/api/admin/

# 重启服务
ssh -i xiaochengxu.pem ubuntu@122.51.156.252 "sudo systemctl restart fapai-backend"
```

---

## 💰 成本优势

Deepseek价格约为Claude的**10%**，大幅降低成本。

---

## ✅ 验证清单

- [ ] openai包已安装
- [ ] DEEPSEEK_API_KEY已配置
- [ ] 代码已上传
- [ ] 服务已重启
- [ ] 发送消息测试通过

**获取Deepseek API Key**: https://platform.deepseek.com/
