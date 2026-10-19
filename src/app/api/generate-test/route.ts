import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/db/client';
import { generateSong, isPlayableAudioUrl } from '@/lib/ai-music';
import { recordServerEvent } from '@/lib/ensure-analytics-table';
import { canPreview, disablePreview, touchDevice } from '@/lib/device-state';
import { PURCHASE_PRICE } from '@/lib/money';

const generateSchema = z.object({
  recipientName: z.string().min(1).max(100),
  // Description must be non-empty after trimming — whitespace-only is invalid.
  personality: z.string().trim().min(5).max(1000),
  genre: z.string().min(1).max(100),
  selectedStyle: z.string().optional(),
  selectedArtistStyle: z.string().optional(),
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

// Whether this device may still see the free preview.
//
// This used to be INFERRED by counting rows in TrialUsage and Order, which meant
// "reset" had to delete rows and the rule could not be changed without touching
// several queries. It is now a single explicit flag on the Device row (see
// lib/device-state.ts): true = may preview, false = used or purchased.
//
// Written to fail OPEN (return true) if the lookup throws, so a database hiccup can
// never lock a legitimate first-time visitor out of their free preview.
async function checkTrialLimit(deviceId: string | undefined): Promise<boolean> {
  if (!deviceId) return false;
  try {
    return !(await canPreview(deviceId));
  } catch (e) {
    console.error('[trial] canPreview lookup failed:', e);
    return false;
  }
}

async function recordTrialUsage(deviceId: string | undefined, ipAddress: string): Promise<void> {
  await prisma.trialUsage.create({
    data: {
      ipAddress,
      deviceId: deviceId || null,
    },
  });
  // Consuming the preview flips the explicit Device flag. Setting it here (rather than
  // at each call site) keeps the flag correct no matter which branch recorded the use.
  if (deviceId) await disablePreview(deviceId, 'trial_used');
}

// Find this device's MOST RECENT trial order, in ANY state.
//
// It used to select only `status: 'success'` with a usable audioUrl. That meant a
// user who reloaded while their song was still generating got null, and the page
// behaved as if they had never generated anything: no player, no progress, and no
// retry — even though the order existed and the song usually finished a moment later.
//
// Returning the latest order regardless of state lets the caller decide what to show:
// a finished song, a "still generating" state (which it can resume polling for), or a
// failure the user can act on. 'testing' is skipped because it is the transient
// pre-submit state in mock mode.
async function findLatestTrialOrder(deviceId: string | undefined) {
  if (!deviceId) return null;

  return prisma.order.findFirst({
    where: {
      deviceId,
      isFullVersion: false,
      status: { not: 'testing' },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const reqId = `[${new Date().toISOString()}] [gen]`;
  try {
    const ipAddress = getClientIp(request);
    const AI_GENERATION_MODE = process.env.NEXT_PUBLIC_AI_GENERATION_MODE || 'mock';

    const body = await request.json();
    const deviceId: string | undefined = body.deviceId;

    console.log(`${reqId} Trial request from IP: ${ipAddress}, deviceId: ${deviceId || 'none'}`);

    // Look the device's latest trial order up FIRST, before the trial-limit gate.
    // The gate returns 429 for any device that already used its trial — which is
    // exactly the population that needs this lookup (to see their finished song, or
    // to resume an in-flight one). Gating first would hide their own order from them.
    const existingTrialOrder = await findLatestTrialOrder(deviceId);

    // Decide what this request should do. canPreview is the single source of truth:
    //   false → the device already used its preview; serve back whatever it has
    //           (a finished song, or an in-flight one to resume).
    //   true  → the device may preview again (first visit, or just after a reset),
    //           so start a NEW generation instead of replaying the old order.
    //
    // Reset no longer deletes orders, so after a reset the previous row is still in the
    // table. Replaying it would make reset look broken: the page would immediately show
    // the old song and hide the preview button again.
    const previewUsed = AI_GENERATION_MODE !== 'mock' ? await checkTrialLimit(deviceId) : false;

    if (previewUsed && existingTrialOrder) {
      if (existingTrialOrder.audioUrl && isPlayableAudioUrl(existingTrialOrder.audioUrl)) {
        console.log(`[${new Date().toISOString()}] Reusing existing trial order ${existingTrialOrder.id} for device: ${deviceId}`);
        // Match the fresh-generation path: return the remote CDN URL directly for <audio>,
        // so mobile Safari plays the file instead of the streaming proxy (which can fail
        // playback). Only fall back to /api/stream-audio for non-http/local-ish paths.
        const audioUrl = existingTrialOrder.audioUrl;
        const isLocalFile = audioUrl.startsWith('/') && !audioUrl.startsWith('//');
        const isRemoteHttp = /^https?:\/\//i.test(audioUrl);
        const audioUrlForFrontend = isLocalFile || isRemoteHttp
          ? audioUrl
          : `/api/stream-audio/${existingTrialOrder.id}`;
        return NextResponse.json({
          success: true,
          audioUrl: audioUrlForFrontend,
          orderId: existingTrialOrder.id,
          isPreview: true,
          lyrics: existingTrialOrder.lyrics,
          title: existingTrialOrder.title,
          coverImageUrl: existingTrialOrder.coverImageUrl,
          duration: existingTrialOrder.duration,
          reused: true,
        });
      }

      if (
        (existingTrialOrder.status === 'generating' || existingTrialOrder.status === 'processing') &&
        existingTrialOrder.aiRequestId
      ) {
        // Still in flight — hand back the task id so the page can pick the polling back up
        // instead of starting (and paying for) a duplicate generation.
        console.log(`[${new Date().toISOString()}] Trial ${existingTrialOrder.id} still ${existingTrialOrder.status}, resuming`);
        return NextResponse.json({
          success: true,
          status: 'generating',
          taskId: existingTrialOrder.aiRequestId,
          orderId: existingTrialOrder.id,
          reused: true,
        });
      }
      // In flight but with no task id: nothing to poll. Fall through and let the caller
      // start a fresh generation rather than stranding the user on a spinner forever.

      if (existingTrialOrder.status === 'failed') {
        // A failed order must not be re-served, so we fall through to generate again.
        // That fall-through is a NEW generation, so the preview flag has to be honoured
        // here — otherwise an exhausted device gets a fresh free song every time its
        // previous attempt failed.
        const blocked = await checkTrialLimit(deviceId);
        if (blocked) {
          await recordServerEvent('trial_blocked', { path: '/', deviceId });
          return NextResponse.json(
            {
              success: false,
              error: `Free trial limit exceeded. Please purchase the full version for ${PURCHASE_PRICE}.`,
              showUpgrade: true,
            },
            { status: 429 }
          );
        }
        console.log(`[${new Date().toISOString()}] Trial ${existingTrialOrder.id} previously failed; allowing a fresh attempt`);
      }
    }

    // Exhausted devices with no order to fall back on must not get a free song.
    if (previewUsed && !existingTrialOrder) {
      await recordServerEvent('trial_blocked', { path: '/', deviceId });
      return NextResponse.json(
        {
          success: false,
          error: `Free trial limit exceeded. Please purchase the full version for ${PURCHASE_PRICE}.`,
          showUpgrade: true,
        },
        { status: 429 }
      );
    }

    let recipientName = body.recipientName || 'Gift Recipient';
    let personality = body.personality || '';
    let genre = body.genre || 'Classic Rock';
    let selectedStyle = body.selectedStyle || genre;
    let selectedArtistStyle = body.selectedArtistStyle || 'None';
    const songConfig = body.songConfig || undefined;

    if (AI_GENERATION_MODE === 'mock') {
      if (!personality || personality.length < 5) {
        personality = "I want a warm, nostalgic Country song for my husband Bob's 70th birthday. He spent 40 years as a petroleum pipe-fitter in Houston and now loves fishing on Lake Conroe. Please thank him for working so hard for our three kids, and let him know how much we love him.";
      }
    } else {
      const validation = generateSchema.safeParse(body);
      if (!validation.success) {
        await recordServerEvent('trial_invalid', { path: '/', deviceId });
        return NextResponse.json(
          { error: 'Invalid input', details: validation.error.issues },
          { status: 400 }
        );
      }
      ({ recipientName, personality, genre, selectedStyle, selectedArtistStyle } = validation.data);
    }

    const order = await prisma.order.create({
      data: {
        recipientName,
        personality,
        genre,
        selectedStyle,
        selectedArtistStyle,
        songConfig: songConfig ? JSON.stringify(songConfig) : null,
        status: 'testing',
        isFullVersion: false,
        ipAddress,
        deviceId: deviceId || null,
      },
    });

    const tGen = Date.now();
    const aiResponse = await generateSong({
      recipientName,
      personality,
      genre,
      isPreview: AI_GENERATION_MODE === 'mock',
      selectedStyle,
      selectedArtistStyle,
      songConfig,
      waitForResult: AI_GENERATION_MODE === 'mock',
    });
    console.log(`${reqId} generateSong: ${Date.now() - tGen}ms, success=${aiResponse.success}, hasTaskId=${!!aiResponse.requestId}, hasAudio=${!!aiResponse.audioUrl}`);

    if (aiResponse.success && aiResponse.requestId && !aiResponse.audioUrl) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'generating',
          aiRequestId: aiResponse.requestId,
        },
      });

      // Record the trial HERE, not in the synchronous branch further down. Real-mode
      // generation is async: this branch returns as soon as it has a task id, so the
      // sync branch (and its recordTrialUsage call) was never reached — which left
      // TrialUsage empty and made the server-side one-trial-per-device limit a no-op.
      if (AI_GENERATION_MODE !== 'mock') {
        await recordTrialUsage(deviceId, ipAddress);
      }

      console.log(`[${new Date().toISOString()}] Trial submitted for device: ${deviceId}, order: ${order.id}, taskId: ${aiResponse.requestId}`);

      return NextResponse.json({
        success: true,
        status: 'generating',
        taskId: aiResponse.requestId,
        orderId: order.id,
      });
    }

    if (aiResponse.success && aiResponse.audioUrl) {
      if (AI_GENERATION_MODE !== 'mock') {
        await recordTrialUsage(deviceId, ipAddress);
      }

      // Save remote URL to DB; frontend uses /api/stream-audio for playback
      // (works on both Vercel read-only FS and self-hosted)
      if (AI_GENERATION_MODE === 'mock') {
        // Mock mode: audioUrl is already a local path like /test-song.mp3
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'success',
            audioUrl: aiResponse.audioUrl,
            aiRequestId: aiResponse.requestId,
            lyrics: aiResponse.lyrics || null,
            title: aiResponse.title || null,
            coverImageUrl: aiResponse.coverImageUrl || null,
            duration: aiResponse.duration || null,
          },
        });

        return NextResponse.json({
          success: true,
          audioUrl: aiResponse.audioUrl,
          orderId: order.id,
          isPreview: true,
          lyrics: aiResponse.lyrics,
          title: aiResponse.title,
          coverImageUrl: aiResponse.coverImageUrl,
          duration: aiResponse.duration,
        });
      }

      // Real mode: save remote URL to DB, return stream-audio proxy URL to frontend
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'success',
          audioUrl: aiResponse.audioUrl,
          aiRequestId: aiResponse.requestId,
          lyrics: aiResponse.lyrics || null,
          title: aiResponse.title || null,
          coverImageUrl: aiResponse.coverImageUrl || null,
          duration: aiResponse.duration || null,
        },
      });

      // Resolve the frontend audio URL (match reused-trial + order-status):
      // remote http(s) URLs served directly so mobile Safari can play; only fall
      // back to /api/stream-audio for non-http/local-ish paths.
      const raw = aiResponse.audioUrl;
      const audioUrlForFrontend = /^https?:\/\//i.test(raw) ? raw : `/api/stream-audio/${order.id}`;
      console.log(`[${new Date().toISOString()}] Trial successful for device: ${deviceId}, order: ${order.id}, audioUrl: ${audioUrlForFrontend}`);

      return NextResponse.json({
        success: true,
        audioUrl: audioUrlForFrontend,
        orderId: order.id,
        isPreview: true,
        lyrics: aiResponse.lyrics,
        title: aiResponse.title,
        coverImageUrl: aiResponse.coverImageUrl,
        duration: aiResponse.duration,
      });
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'failed',
          aiRequestId: aiResponse.requestId,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: aiResponse.error || 'Failed to generate song',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Trial generation error:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
