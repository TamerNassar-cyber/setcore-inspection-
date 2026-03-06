import { getDb } from './schema';
import type { Job, InspectionRun } from '../../types';

export async function saveJob(job: Job): Promise<void> {
  const db = await getDb();
  if (!db) return; // web — Supabase only
  await db.runAsync(
    `INSERT OR REPLACE INTO jobs
      (id, job_number, client, rig, well, field, country, standard, pipe_category, status, created_by, assigned_inspectors, created_at, updated_at, notes, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      job.id, job.job_number, job.client, job.rig, job.well, job.field ?? null,
      job.country, job.standard, job.pipe_category, job.status, job.created_by,
      JSON.stringify(job.assigned_inspectors), job.created_at, job.updated_at, job.notes ?? null,
    ]
  );
}

export async function getJobs(): Promise<Job[]> {
  const db = await getDb();
  if (!db) return []; // web — Supabase only
  const rows = await db.getAllAsync<any>('SELECT * FROM jobs ORDER BY created_at DESC');
  return rows.map((r: any) => {
    let assigned_inspectors: string[] = [];
    try { assigned_inspectors = JSON.parse(r.assigned_inspectors ?? '[]'); } catch (_) {}
    return { ...r, assigned_inspectors };
  });
}

export async function getJob(id: string): Promise<Job | null> {
  const db = await getDb();
  if (!db) return null; // web — Supabase only
  const row = await db.getFirstAsync<any>('SELECT * FROM jobs WHERE id = ?', [id]);
  if (!row) return null;
  let assigned_inspectors: string[] = [];
  try { assigned_inspectors = JSON.parse(row.assigned_inspectors ?? '[]'); } catch (_) {}
  return { ...row, assigned_inspectors };
}

export async function saveRun(run: InspectionRun): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync(
    `INSERT OR REPLACE INTO inspection_runs
      (id, job_id, inspector_id, start_time, end_time, status, location_lat, location_lng, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      run.id, run.job_id, run.inspector_id, run.start_time, run.end_time ?? null,
      run.status, run.location_lat ?? null, run.location_lng ?? null,
    ]
  );
}

export async function getRuns(jobId: string): Promise<InspectionRun[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.getAllAsync<InspectionRun>(
    'SELECT * FROM inspection_runs WHERE job_id = ? ORDER BY start_time DESC',
    [jobId]
  );
}

export async function getRun(id: string): Promise<InspectionRun | null> {
  const db = await getDb();
  if (!db) return null;
  return await db.getFirstAsync<InspectionRun>('SELECT * FROM inspection_runs WHERE id = ?', [id]);
}
