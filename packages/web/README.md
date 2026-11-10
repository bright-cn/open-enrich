这是一个使用 [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app) 引导创建的 [Next.js](https://nextjs.org) 项目。

## 开始使用

首先，运行开发服务器：

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

使用浏览器打开 [http://localhost:3000](http://localhost:3000) 查看结果。

你可以通过修改 `app/page.tsx` 开始编辑页面。编辑文件时，页面会自动更新。

本项目使用 [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) 自动优化并加载 [Geist](https://vercel.com/font)，这是 Vercel 推出的新字体系列。

## 了解更多

要进一步了解 Next.js，请参阅以下资源：

- [Next.js 文档](https://nextjs.org/docs) - 了解 Next.js 功能和 API。
- [学习 Next.js](https://nextjs.org/learn) - 交互式 Next.js 教程。

你也可以查看 [Next.js GitHub 仓库](https://github.com/vercel/next.js)：欢迎提供反馈和贡献！

## 部署到 Vercel

部署 Next.js 应用最简单的方法，是使用 Next.js 创建者提供的 [Vercel 平台](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme)。

更多详情请参阅我们的 [Next.js 部署文档](https://nextjs.org/docs/app/building-your-application/deploying)。

## 演示模式

设置 `DEMO_MODE=1` 后，可将每位访问者的终身使用量限制为 50 行丰富数据（按 IP 计算）。达到上限时，系统会弹出一个可关闭的模态窗口，说明限制并引导用户前往代码仓库和 Bright Data 注册页面。

`DEMO_MODE=1` 时所需的环境变量：

- `TURSO_DATABASE_URL`：你的 Turso libSQL 数据库 URL
- `TURSO_AUTH_TOKEN`：该数据库的身份验证 token（仅限服务器，绝不向客户端公开）

设置：

1. 创建 Turso 数据库：`turso db create open-enrich-demo`（或通过 Turso 控制面板）。
2. 获取 URL：`turso db show open-enrich-demo --url`
3. 获取身份验证 token：`turso db tokens create open-enrich-demo`
4. 在部署环境中设置 `DEMO_MODE=1`、`TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN`。
5. `demo_quota` 表会在首次检查配额时自动创建，无需手动执行架构步骤。
6. 确认你的部署位于会设置 `x-forwarded-for` 的代理之后（Vercel 默认如此）。

终身上限 50 定义于 `lib/demo-mode/config.ts`（`DEMO_LIFETIME_ROW_LIMIT`）。
