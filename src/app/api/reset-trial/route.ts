import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/db/client';

const resetSchema = z.object({
  deviceId: z.string().max(200).optional(),
});

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  const ip = request.ip;
  return ip || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId } = resetSchema.parse(body);
    const ipAddress = getClientIp(request);

    console.log(`[${new Date().toISOString()}] Resetting trial data for device: ${deviceId || 'none'}, IP: ${ipAddress}`);

    // Build match condition: match by deviceId OR by ipAddress.
    // IP fallback covers records created before deviceId was available,
    // and local testing where all requests share the same IP.
    const matchCondition = {
      OR: [
        ...(deviceId ? [{ deviceId }] : []),
        { ipAddress },
      ],
    };

    // Delete TrialUsage records for this device / IP
    const deletedUsage = await prisma.trialUsage.deleteMany({
      where: matchCondition,
    });

    // Delete trial orders (isFullVersion: false) for this device / IP.
    // Paid orders (isFullVersion: true) are preserved.
    const deletedOrders = await prisma.order.deleteMany({
      where: {
        OR: [
          ...(deviceId ? [{ deviceId }] : []),
          { ipAddress },
        ],
        isFullVersion: false,
      },
    });

    console.log(`[${new Date().toISOString()}] Reset complete: deleted ${deletedUsage.count} trial usage(s) and ${deletedOrders.count} trial order(s) for device: ${deviceId || 'none'}, IP: ${ipAddress}`);

    return NextResponse.json({
      success: true,
      deleted: {
        trialUsage: deletedUsage.count,
        trialOrders: deletedOrders.count,
      },
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Reset trial error:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset trial data' },
      { status: 500 }
    );
  }
}
