import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resetDeviceData } from '@/lib/reset-device';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const resetSchema = z.object({
  // Required now. Without a fingerprint there is no safe way to scope the deletion:
  // falling back to IP would wipe every other user sharing that address.
  deviceId: z.string().min(1).max(200),
});

/**
 * POST /api/reset-trial
 * Clears the free-trial state for ONE device fingerprint (see reset-device.ts).
 * Paid orders are preserved.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            'A device fingerprint is required to reset. Refusing to fall back to IP, ' +
            'which would delete other users sharing the same network.',
        },
        { status: 400 }
      );
    }

    const { deviceId } = parsed.data;
    console.log(
      `[${new Date().toISOString()}] Reset requested for device: ${deviceId.slice(0, 12)}…`
    );

    const result = await resetDeviceData(deviceId);

    console.log(
      `[${new Date().toISOString()}] Reset complete for device ${deviceId.slice(0, 12)}…: ` +
        `preview re-enabled (no records deleted)`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Reset error:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset data' },
      { status: 500 }
    );
  }
}
