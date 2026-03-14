/**
 * useSyncOnFocus
 *
 * Background sync hook that flushes unsynced joints and defects from local
 * SQLite to Supabase whenever the app comes back into focus.
 *
 * - Native: listens to AppState 'active' events.
 * - Web: listens to the document 'visibilitychange' event.
 * - A syncingRef flag prevents overlapping sync runs.
 * - Returns a SyncStatus object so the root layout can surface failures.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { supabase } from '../supabase';
import {
  getUnsyncedJoints,
  markJointSynced,
  getUnsyncedDefects,
  markDefectSynced,
} from '../db/joints';

export interface SyncStatus {
  /** True while a sync pass is in progress. */
  syncing: boolean;
  /** Number of joints that failed to sync in the last pass. */
  pendingJoints: number;
  /** Number of defects that failed to sync in the last pass. */
  pendingDefects: number;
  /** ISO timestamp of the last completed sync attempt (null = never). */
  lastSyncAt: string | null;
}

export function useSyncOnFocus(): SyncStatus {
  const syncingRef = useRef(false);
  const [status, setStatus] = useState<SyncStatus>({
    syncing: false,
    pendingJoints: 0,
    pendingDefects: 0,
    lastSyncAt: null,
  });

  const runSync = useCallback(async () => {
    // Bail if already syncing or on web (SQLite not available on web)
    if (syncingRef.current) return;
    if (Platform.OS === 'web') return;

    // Only sync when the user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    syncingRef.current = true;
    setStatus(s => ({ ...s, syncing: true }));

    let failedJoints = 0;
    let failedDefects = 0;

    try {
      const [unsyncedJoints, unsyncedDefects] = await Promise.all([
        getUnsyncedJoints(),
        getUnsyncedDefects(),
      ]);

      // ── Sync joints ────────────────────────────────────────────────────
      for (const joint of unsyncedJoints) {
        // Remove the local-only 'synced' flag before sending to Supabase
        const { synced: _s, ...jointData } = joint;
        const { error } = await supabase
          .from('joints')
          .upsert(jointData, { onConflict: 'id', ignoreDuplicates: true });

        if (error) {
          console.warn(`[Sync] Joint ${joint.id} failed:`, error.message);
          failedJoints++;
        } else {
          await markJointSynced(joint.id);
        }
      }

      // ── Sync defects ───────────────────────────────────────────────────
      for (const defect of unsyncedDefects) {
        // Remove local-only fields before sending to Supabase
        const { synced: _s, photo_local_uri: _p, ...defectData } = defect;
        const { error } = await supabase
          .from('defects')
          .upsert(defectData, { onConflict: 'id', ignoreDuplicates: true });

        if (error) {
          console.warn(`[Sync] Defect ${defect.id} failed:`, error.message);
          failedDefects++;
        } else {
          await markDefectSynced(defect.id);
        }
      }

      const totalAttempted = unsyncedJoints.length + unsyncedDefects.length;
      if (totalAttempted > 0) {
        const synced = totalAttempted - failedJoints - failedDefects;
        console.log(
          `[Sync] Complete — ${synced}/${totalAttempted} records uploaded` +
          (failedJoints + failedDefects > 0
            ? ` (${failedJoints + failedDefects} pending — will retry on next focus)`
            : ''),
        );
      }
    } catch (err) {
      console.warn('[Sync] Unexpected error during sync pass:', err);
    } finally {
      syncingRef.current = false;
      setStatus({
        syncing: false,
        pendingJoints: failedJoints,
        pendingDefects: failedDefects,
        lastSyncAt: new Date().toISOString(),
      });
    }
  }, []);

  useEffect(() => {
    // Run immediately on mount
    runSync();

    if (Platform.OS === 'web') {
      // Web: re-sync when the browser tab regains focus
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') runSync();
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => document.removeEventListener('visibilitychange', handleVisibility);
    } else {
      // Native: re-sync when the app comes back to the foreground
      const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (nextState === 'active') runSync();
      });
      return () => sub.remove();
    }
  }, [runSync]);

  return status;
}
