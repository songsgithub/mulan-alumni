# 生产镜像：Next.js + Payload（同一个进程同时服务公开站 / 工作台 / CMS 三个域）。
# 活动材料 PDF 用 Playwright 驱动 Chromium 打印，所以镜像里带 Chromium 与中文字体。
#
# 构建：docker compose --profile app build
# 运行：docker compose --profile app up -d      （启动时先执行数据库迁移，再起服务）
FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---------- 依赖 ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --registry=https://registry.npmjs.org --no-audit --no-fund

# ---------- 构建 ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 构建期只需要占位的连接串与密钥（payload.config.ts 在构建阶段不连库、不校验密钥强度）
RUN DATABASE_URI=postgresql://build:build@localhost:5432/build PAYLOAD_SECRET=build-only-placeholder-secret-0000000000 \
    npm run build

# ---------- 运行 ----------
FROM base AS runner
ENV NODE_ENV=production PORT=3000 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=deps /app/node_modules ./node_modules
# Chromium 及其系统依赖 + 中文字体（打印 PDF 用）；浏览器装在共享目录，运行用户 node 也读得到
#
# ⚠️ fonts-dejavu-core 是**页码**用的：Chromium 渲染 PDF 的页眉页脚模板时
# 不加载页面的 @font-face、也不认自定义系统字体，只有它自带的少数字体能真正嵌入。
# 实测 DejaVu Serif 能嵌成 Type0 真字体（页码可选可搜），Noto Serif SC 则会落成位图路径。
# 正文与标题不依赖系统字体，走 public/fonts/ 的 @font-face（见打印路由的 CORS 处理）。
# 上传文件（未启用 S3 时）落在这两个目录：生产务必挂卷持久化
RUN npx playwright install --with-deps chromium \
  && apt-get update && apt-get install -y --no-install-recommends fonts-noto-cjk fonts-dejavu-core curl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
RUN mkdir -p media finance-evidence && chown -R node:node media finance-evidence .next
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD curl -fsS http://127.0.0.1:3000/api/health -H "Host: ${WORKSPACE_HOST:-connect.localhost}" || exit 1
CMD ["sh", "-c", "npx payload migrate && npm run start"]
