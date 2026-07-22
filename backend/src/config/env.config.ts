import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  const url = process.env.DATABASE_URL;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
  const username = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  const ssl = process.env.DB_SSL === 'true' || true; // Force SSL for Supabase
  const rejectUnauthorized = false; // Always false for development to bypass self-signed errors

  return {
    url,
    host,
    port,
    username,
    password,
    database,
    ssl,
    rejectUnauthorized,
  };
});
