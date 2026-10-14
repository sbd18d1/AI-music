import { NextRequest, NextResponse } from 'next/server';
import { tursoClient } from '@/lib/turso-client';
import { ensureOrderAmountColumn } from '@/lib/ensure-analytics-table';
import { ensureOrderCouponColumn, ensureOrderEmailColumn } from '@/lib/ensure-coupon-table';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PAGE_SIZE = 50;

type Row = Record<string, unknown>;

const s = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const b = (v: unknown): boolean => v === 1 || v === true || v === '1';

/**
 * GET /api/admin/songs?range=all|1d|3d|7d|30d&status=&kind=&q=&page=1
 *
 * Every song ever generated — free trials AND paid — with the prompt the user wrote.
 * This is the browse view; /api/admin/payments/[id] remains the per-order drill-down.
 *
 * Email and IP are deliberately NOT returned here: the list can be many rows of other
 * people's personal data, and browsing it is a different activity from investigating
 * one specific order. The drill-down endpoint (already admin-gated) still exposes them
 * when there is an actual reason to look.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const reqId = `[${new Date().toISOString()}] [admin:songs]`;
  try {
    await ensureOrderAmountColumn();
    await ensureOrderCouponColumn();
    await ensureOrderEmailColumn();

    const params = new URL(request.url).searchParams;
    const range = params.get('range') || 'all';
    const status = params.get('status') || '';
    const kind = params.get('kind') || ''; // '' | 'trial' | 'paid'
    const q = (params.get('q') || '').trim().slice(0, 200);
    const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

    const RANGES: Record<string, number> = { '1d': 1, '3d': 3, '7d': 7, '30d': 30 };
    const days = RANGES[range] ?? null;

    // Build the WHERE clause with bound params only — never interpolate user input.
    const where: string[] = ['1 = 1'];
    const args: (string | number)[] = [];

    if (days) {
      where.push(`"createdAt" >= date('now','-${days - 1} days')`);
    }
    if (status) {
      where.push(`"status" = ?`);
      args.push(status);
    }
    if (kind === 'trial' || kind === 'paid') {
      where.push(`"isFullVersion" = ?`);
      args.push(kind === 'paid' ? 1 : 0);
    }
    if (q) {
      // Search the prompt, the generated title, and the recipient.
      where.push(`("personality" LIKE ? OR "title" LIKE ? OR "recipientName" LIKE ?)`);
      const like = `%${q}%`;
      args.push(like, like, like);
    }

    const whereSql = where.join(' AND ');

    const countRes = await tursoClient.execute({
      sql: `SELECT COUNT(*) AS total FROM "Order" WHERE ${whereSql}`,
      args,
    });
    const total = Number((countRes.rows[0] as Row)?.total ?? 0);

    const offset = (page - 1) * PAGE_SIZE;
    const listRes = await tursoClient.execute({
      sql: `SELECT "id", "status", "isFullVersion", "recipientName", "genre", "title",
                   "personality", "lyrics", "duration", "audioUrl", "coverImageUrl",
                   "amountPaid", "currency", "couponCode", "trialOrderId", "deviceId",
                   "aiRequestId",
                   strftime('%Y-%m-%dT%H:%M:%SZ', "createdAt") AS createdAt,
                   strftime('%Y-%m-%dT%H:%M:%SZ', "updatedAt") AS updatedAt
            FROM "Order"
            WHERE ${whereSql}
            ORDER BY "createdAt" DESC
            LIMIT ? OFFSET ?`,
      args: [...args, PAGE_SIZE, offset],
    });

    return NextResponse.json({
      success: true,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      songs: (listRes.rows as unknown as Row[]).map((r) => ({
        id: s(r.id),
        status: s(r.status),
        isFullVersion: b(r.isFullVersion),
        recipientName: s(r.recipientName),
        genre: s(r.genre),
        title: s(r.title),
        // The user's own words — the reason this view exists.
        prompt: s(r.personality),
        hasLyrics: !!(r.lyrics && String(r.lyrics).length > 0),
        lyricsPreview: r.lyrics ? String(r.lyrics).slice(0, 160) : null,
        duration: s(r.duration),
        hasAudio: !!r.audioUrl,
        coverImageUrl: s(r.coverImageUrl),
        amountPaid: r.amountPaid === null || r.amountPaid === undefined ? null : Number(r.amountPaid),
        currency: s(r.currency),
        couponCode: s(r.couponCode),
        fromTrial: !!r.trialOrderId,
        deviceId: s(r.deviceId), // fingerprint only; the drill-down has email + IP
        aiRequestId: s(r.aiRequestId),
        createdAt: s(r.createdAt),
        updatedAt: s(r.updatedAt),
      })),
    });
  } catch (error) {
    console.error(`${reqId} Error:`, error);
    return NextResponse.json({ success: false, error: 'Failed to load songs' }, { status: 500 });
  }
}
