import fs from 'fs';
import path from 'path';
import pool from './database.js';

async function findMigrationsDir() {
  const candidates = [
    path.resolve(process.cwd(), 'backend/database/migrations'),
    path.resolve(process.cwd(), 'database/migrations'),
    path.resolve(process.cwd(), '../backend/database/migrations')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function run() {
  const migrationsDir = await findMigrationsDir();
  if (!migrationsDir) {
    console.error('No migrations directory found. Checked common locations.');
    process.exit(1);
  }
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  if (!files.length) {
    console.log('No migration files found in', migrationsDir);
    process.exit(0);
  }

  const conn = await pool.getConnection();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log('Running migration', file);
      await conn.query(sql);
    }
    console.log('Migrations completed');
  } catch (err) {
    console.error('Migration error', err);
    process.exitCode = 1;
  } finally {
    conn.release();
    process.exit();
  }
}

run();
