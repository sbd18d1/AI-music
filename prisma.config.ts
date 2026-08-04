import 'dotenv/config';
import { defineConfig } from 'prisma/config';

function getDatabaseUrl(): string {
  // 优先使用 TURSO_DATABASE_URL + TURSO_AUTH_TOKEN（Vercel 生产环境配置方式）
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    return `${tursoUrl}?authToken=${tursoToken}`;
  }

  // 兼容旧格式 DATABASE_URL（已包含 authToken）
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // 本地开发回退
  return 'file:./dev.db';
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: getDatabaseUrl(),
  },
});
