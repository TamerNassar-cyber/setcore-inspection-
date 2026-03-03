import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('setcore_inspection.db');
  }
  return db;
}

export async function initDb(): Promise<void> {
  const database = await getDb();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      job_number TEXT NOT NULL,
      client TEXT NOT NULL,
      rig TEXT NOT NULL,
      well TEXT NOT NULL,
      field TEXT,
      country TEXT NOT NULL,
      standard TEXT NOT NULL,
      pipe_category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_by TEXT NOT NULL,
      assigned_inspectors TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      notes TEXT,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inspection_runs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      inspector_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      location_lat REAL,
      location_lng REAL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS joints (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      joint_number INTEGER NOT NULL,
      serial_number TEXT,
      grade TEXT,
      weight REAL,
      od REAL,
      length REAL,
      result TEXT NOT NULL,
      notes TEXT,
      inspected_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS defects (
      id TEXT PRIMARY KEY,
      joint_id TEXT NOT NULL,
      defect_type TEXT NOT NULL,
      location TEXT,
      severity TEXT NOT NULL,
      description TEXT,
      photo_url TEXT,
      photo_local_uri TEXT,
      standard_reference TEXT,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS qualifications (
      id TEXT PRIMARY KEY,
      inspector_id TEXT NOT NULL,
      cert_type TEXT NOT NULL,
      cert_number TEXT NOT NULL,
      issued_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      document_url TEXT,
      synced INTEGER NOT NULL DEFAULT 0
    );
  `);
}
