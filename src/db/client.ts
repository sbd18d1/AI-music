import { PrismaClient } from '../generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

declare global {
  var prisma: PrismaClient | undefined;
}

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || 'file:./dev.db',
  authToken: process.env.DATABASE_TOKEN || undefined,
});

export const prisma = global.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
