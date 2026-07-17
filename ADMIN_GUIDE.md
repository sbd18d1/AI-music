# AI 个性化音乐生成器 - 管理员操作指南

## 项目概述

这是一个面向北美市场的 AI 个性化音乐生成 SaaS 应用。用户可以通过输入定制信息，由 AI 为其生成个性化歌曲。

### 技术栈

| 模块 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js | 14+ (App Router) |
| 语言 | TypeScript | - |
| 样式 | Tailwind CSS + Shadcn UI | - |
| 数据库 | SQLite + Prisma | - |
| 支付 | PayPal / Stripe | - |
| AI 音乐 | 302.ai Suno API | - |
| 邮件 | Resend | - |

---

## 快速开始

### 1. 环境要求

- Node.js >= 18.x
- npm >= 9.x

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env`，并填写相关配置：

```bash
cp .env.example .env
```

### 4. 初始化数据库

```bash
npx prisma db push
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

---

## 环境变量配置

### 核心配置项

#### 数据库配置
```env
# SQLite 数据库文件路径
DATABASE_URL="file:./dev.db"
```

#### Stripe 支付配置
```env
# Stripe 公钥（前端使用）
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here
# Stripe 密钥（后端使用）
STRIPE_SECRET_KEY=your_stripe_secret_key_here
# Stripe Webhook 签名密钥
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here
```

#### 302.ai Suno API 配置
```env
# 302.ai API 密钥
THREE02_AI_KEY=your_302_ai_key_here
# API 基础地址
THREE02_AI_BASE_URL=https://api.302.ai
# AI 生成模式："mock" 或 "real"
NEXT_PUBLIC_AI_GENERATION_MODE=mock
```

#### Resend 邮件配置
```env
# Resend API 密钥
RESEND_API_KEY=your_resend_api_key_here
# 发件人地址
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

#### 支付渠道配置
```env
# 支付渠道："paypal" 或 "stripe"
NEXT_PUBLIC_PAYMENT_PROVIDER=paypal
```

#### PayPal 支付配置
```env
# PayPal 客户端 ID
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id_here
# PayPal 客户端密钥
PAYPAL_CLIENT_SECRET=your_paypal_secret_here
# PayPal Webhook ID
PAYPAL_WEBHOOK_ID=your_paypal_webhook_id_here
# PayPal 模式："sandbox" 或 "live"
PAYPAL_MODE=sandbox
```

---

## AI 生成模式切换

### Mock 模式（开发测试）

```env
NEXT_PUBLIC_AI_GENERATION_MODE=mock
```

**特点**：
- 使用预设的测试音频，不消耗 API 余额
- 适用于开发调试、前端 UI 测试
- 生成速度快（3秒延迟）

### Real 模式（生产环境）

```env
NEXT_PUBLIC_AI_GENERATION_MODE=real
```

**特点**：
- 调用真实的 302.ai Suno API
- 会消耗账户余额
- 生成时间较长（通常 1-2 分钟）
- 需要确保网络能访问 `api.302.ai`

---

## 支付渠道切换

### 使用 PayPal（默认）

```env
NEXT_PUBLIC_PAYMENT_PROVIDER=paypal
```

### 使用 Stripe

```env
NEXT_PUBLIC_PAYMENT_PROVIDER=stripe
```

---

## 本地测试支付

### PayPal Sandbox 测试

1. 登录 [PayPal Developer](https://developer.paypal.com/)
2. 创建 Sandbox 账户（买家和卖家）
3. 获取 Client ID 和 Secret
4. 配置到 `.env` 文件中
5. 使用测试买家账户进行支付

### Stripe 测试

1. 登录 [Stripe Dashboard](https://dashboard.stripe.com/)
2. 获取测试模式的 API Keys
3. 配置到 `.env` 文件中
4. 使用 Stripe CLI 启动 Webhook 转发：
   ```bash
   stripe listen --forward-to localhost:3000/api/webhook/stripe
   ```
5. 使用测试卡号 `4242 4242 4242 4242` 进行支付

---

## 数据库操作

### 查看数据

```bash
npx prisma studio
```

### 执行迁移

```bash
npx prisma migrate dev --name migration_name
```

### 部署迁移

```bash
npx prisma migrate deploy
```

---

## 项目结构

```
AiMusic/
├── .env                    # 环境变量配置
├── .env.example            # 环境变量模板
├── prisma/
│   └── schema.prisma       # 数据库 Schema
└── src/
    ├── app/
    │   ├── page.tsx        # 主页面（Landing Page）
    │   ├── order-status/
    │   │   └── page.tsx    # 订单状态页面
    │   └── api/
    │       ├── checkout/route.ts          # Stripe 创建支付会话
    │       ├── generate-test/route.ts     # 免费试用生成
    │       ├── order-status/route.ts      # 查询订单状态
    │       ├── paypal/
    │       │   ├── create-order/route.ts  # PayPal 创建订单
    │       │   └── capture-order/route.ts # PayPal 捕获支付
    │       └── webhook/
    │           ├── stripe/route.ts        # Stripe Webhook
    │           └── paypal/route.ts        # PayPal Webhook
    ├── db/
    │   └── client.ts       # Prisma 客户端
    └── lib/
        ├── ai-music.ts     # AI 音乐生成模块
        └── email.ts        # 邮件发送模块
```

---

## 核心业务流程

### 免费试用流程

```
用户访问首页 → 填写表单 → 点击 "Free Trial" → 前端检查 localStorage → 
后端检查 IP 频次限制 → 调用 AI 生成（预览模式，30秒） → 返回结果
```

### 付费购买流程

```
用户填写表单 → 点击 "Unlock Full Version" → 创建支付会话（PayPal/Stripe）→
用户完成支付 → 支付回调触发 → 调用 AI 生成（完整版，3分钟） → 
更新订单状态 → 发送邮件通知 → 展示结果
```

---

## 防刷机制

### 客户端防刷
- localStorage 标记：`has_used_free_trial`
- Cookie 标记：有效期 30 天

### 服务端防刷
- IP 级频次限制：24 小时内每个 IP 仅允许 1 次免费试用
- 订单状态检查：防止重复处理

---

## 部署指南

### Vercel 部署

1. 连接 GitHub 仓库
2. 设置环境变量（在 Vercel Dashboard）
3. 部署

### 环境变量注意事项

- `NEXT_PUBLIC_URL` 设置为生产环境域名
- `PAYPAL_MODE` 设置为 `live`
- `NEXT_PUBLIC_AI_GENERATION_MODE` 设置为 `real`
- 确保所有密钥正确配置

---

## 故障排查

### 常见问题

1. **PayPal 支付后状态一直 Pending**
   - 检查 PayPal Webhook 是否配置正确
   - 检查服务器日志是否有 Webhook 回调

2. **AI 生成失败**
   - 检查网络连接是否能访问 `api.302.ai`
   - 检查 `THREE02_AI_KEY` 是否正确
   - 检查账户余额是否充足

3. **支付回调不触发**
   - 确保 Webhook URL 公网可访问
   - 检查签名密钥是否正确

### 日志查看

服务器控制台会输出详细日志，包含时间戳：

```
[2026-07-09T08:58:22.618Z] PayPal payment captured: xxx
[2026-07-09T08:58:22.641Z] MOCK MODE: Simulating song generation
[2026-07-09T08:58:25.668Z] Full song generation successful! Order: xxx
```

---

## 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-07-08 | 项目初始化，Stripe 支付集成 |
| v1.1 | 2026-07-09 | 添加 PayPal 支付支持，AI 生成模式切换 |

---

## 联系信息

如有问题，请联系项目管理员。
