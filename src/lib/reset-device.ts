/**
 * What "reset" actually does now: flip the device's preview switch back on.
 *
 * That is deliberately ALL it does. Earlier versions also deleted the device's
 * TrialUsage rows, its trial Orders and its Visit analytics — which meant an
 * operator testing the flow silently destroyed their own (and users') history, and
 * the admin song list lost those songs. The explicit `canPreview` flag made those
 * deletions unnecessary: eligibility no longer depends on counting rows.
 *
 * Paid orders were never deleted (they are revenue), but trial orders were, so reset
 * left a misleading half-history behind. Nothing is deleted now.
 */

import { enablePreview } from '@/lib/device-state';

export interface ResetSummary {
  previewReenabled: boolean;
}

export async function resetDeviceData(deviceId: string): Promise<ResetSummary> {
  // The preview switch is the only thing that governs eligibility.
  await enablePreview(deviceId);
  return { previewReenabled: true };
}
