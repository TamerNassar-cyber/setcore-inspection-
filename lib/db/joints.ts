import { getDb } from './schema';
import type { Joint, Defect } from '../../types';

export async function saveJoint(joint: Joint): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO joints
      (id, run_id, joint_number, serial_number, grade, weight, od, length, result, notes, inspected_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      joint.id, joint.run_id, joint.joint_number, joint.serial_number ?? null,
      joint.grade ?? null, joint.weight ?? null, joint.od ?? null,
      joint.length ?? null, joint.result, joint.notes ?? null, joint.inspected_at,
    ]
  );
}

export async function getJointsByRun(runId: string): Promise<Joint[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM joints WHERE run_id = ? ORDER BY joint_number ASC',
    [runId]
  );
  return rows.map(r => ({ ...r, synced: !!r.synced }));
}

export async function saveDefect(defect: Defect): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO defects
      (id, joint_id, defect_type, location, severity, description, photo_url, photo_local_uri, standard_reference, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      defect.id, defect.joint_id, defect.defect_type, defect.location ?? null,
      defect.severity, defect.description ?? null, defect.photo_url ?? null,
      defect.photo_local_uri ?? null, defect.standard_reference ?? null,
    ]
  );
}

export async function getDefectsByJoint(jointId: string): Promise<Defect[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM defects WHERE joint_id = ?',
    [jointId]
  );
  return rows.map(r => ({ ...r, synced: !!r.synced }));
}

export async function getTally(runId: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT
      COUNT(*) as total_joints,
      SUM(CASE WHEN result = 'PASS' THEN 1 ELSE 0 END) as accepted,
      SUM(CASE WHEN result = 'FAIL' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN result = 'REJECT' THEN 1 ELSE 0 END) as rejected,
      SUM(COALESCE(length, 0)) as total_length_m
    FROM joints WHERE run_id = ?`,
    [runId]
  );
  return {
    total_joints: row?.total_joints ?? 0,
    accepted: row?.accepted ?? 0,
    failed: row?.failed ?? 0,
    rejected: row?.rejected ?? 0,
    total_length_m: row?.total_length_m ?? 0,
    total_length_ft: (row?.total_length_m ?? 0) * 3.28084,
  };
}

export async function getUnsyncedJoints(): Promise<Joint[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM joints WHERE synced = 0');
  return rows.map(r => ({ ...r, synced: false }));
}

export async function markJointSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE joints SET synced = 1 WHERE id = ?', [id]);
}
