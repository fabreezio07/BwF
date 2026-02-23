import mariadb from 'mariadb';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'battle_with_friend',
  connectionLimit: 5
});

export default pool;
