import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/db/client';
import { checkResultOnce, isPlayableAudioUrl, normalizeSongTitle } from '@/lib/ai-music';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 300;

/**
 * POST /api/admin/recover
 *
 * Rescue orders stuck in a non-terminal state whose song was actually finished.
 *
 * Why this is needed: generation status was only ever advanced by the CUSTOMER'S
 * BROWSER polling /api/generate-status. The frontend gives up after 120 polls (~10
 * minutes), and closing the tab stops it immediately. Nothing server-side re-checked
 * afterwards, so a song that finished on 302.ai a second later stayed 'generating'
 * forever and the paying customer never got it.
 *
 * This walks the stuck orders, asks 302.ai once per order, and promotes any that are
 * actually complete. Safe to run repeatedly (idempotent): it only ever moves an order
 * toward a terminal state it has verified.
 *
 * Body (optional): { limit?: number }  — cap how many orders to check in one run.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const reqId = `[${new Date().toISOString()}] [admin:recover]`;
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit) || 20, 1), 50);

    // Anything still in flight but older than a minute — younger ones are legitimately
    // mid-generation and the customer's own poll will handle them.
    const cutoff = new Date(Date.now() - 60_000);
    const stuck = await prisma.order.findMany({
      where: {
        status: { in: ['generating', 'processing', 'testing'] },
        aiRequestId: { not: null },
        createdAt: { lt: cutoff },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const results: {
      id: string;
      outcome: 'recovered' | 'still_generating' | 'failed' | 'error';
      title?: string | null;
    }[] = [];

    for (const order of stuck) {
      const taskId = order.aiRequestId;
      if (!taskId) continue;
      try {
        const result = await checkResultOnce(taskId);

        if (result.success && isPlayableAudioUrl(result.audioUrl)) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'success',
              audioUrl: result.audioUrl,
              lyrics: result.lyrics || order.lyrics,
              title:
                normalizeSongTitle(result.title, {
                  recipientName: order.recipientName,
                  genre: order.genre,
                }) || order.title,
              coverImageUrl: result.coverImageUrl || order.coverImageUrl,
              duration: result.duration || order.duration,
            },
          });
          console.log(`${reqId} RECOVERED ${order.id} task=${taskId} title=${result.title}`);
          results.push({ id: order.id, outcome: 'recovered', title: result.title ?? null });
        } else if (result.error) {
          // 302 reports a real failure for this task — stop pretending it is in flight.
          await prisma.order.update({ where: { id: order.id }, data: { status: 'failed' } });
          console.log(`${reqId} MARKED FAILED ${order.id} task=${taskId}: ${result.error}`);
          results.push({ id: order.id, outcome: 'failed' });
        } else {
          results.push({ id: order.id, outcome: 'still_generating' });
        }
      } catch (e) {
        console.error(`${reqId} Error on order ${order.id}:`, e);
        results.push({ id: order.id, outcome: 'error' });
      }
    }

    const summary = {
      checked: stuck.length,
      recovered: results.filter((r) => r.outcome === 'recovered').length,
      failed: results.filter((r) => r.outcome === 'failed').length,
      stillGenerating: results.filter((r) => r.outcome === 'still_generating').length,
      errors: results.filter((r) => r.outcome === 'error').length,
    };
    console.log(`${reqId} done:`, JSON.stringify(summary));

    return NextResponse.json({ success: true, summary, results });
  } catch (error) {
    console.error(`${reqId} Error:`, error);
    return NextResponse.json({ success: false, error: 'Recovery failed' }, { status: 500 });
  }
}
