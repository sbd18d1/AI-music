import { NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { createClient } from '@libsql/client';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('order_id');

  if (!orderId) {
    return NextResponse.json({ error: 'Missing order_id' });
  }

  // 1. Prisma 查询
  const prismaOrder = await prisma.order.findUnique({
    where: { id: orderId },
  });

  // 2. Raw libsql 查询
  const libsqlClient = createClient({
    url: process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const rawResult = await libsqlClient.execute({
    sql: 'SELECT id, status, "paymentOrderId", "audioUrl" FROM "Order" WHERE id = ?',
    args: [orderId],
  });
  libsqlClient.close();

  return NextResponse.json({
    prisma: {
      status: prismaOrder?.status,
      paymentOrderId: prismaOrder?.paymentOrderId,
      audioUrl: prismaOrder?.audioUrl?.substring(0, 60),
    },
    rawSql: {
      status: rawResult.rows[0]?.status,
      paymentOrderId: rawResult.rows[0]?.paymentOrderId,
      audioUrl: (rawResult.rows[0]?.audioUrl as string)?.substring(0, 60),
      rowCount: rawResult.rows.length,
    },
  });
}
