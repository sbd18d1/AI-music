import { createClient, type Client } from '@libsql/client';

function getDatabaseUrl(): string {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!url) {
    throw new Error('Database URL is missing in environment variables.');
  }

  return url.split('?')[0];
}

function getAuthToken(): string | undefined {
  if (process.env.TURSO_AUTH_TOKEN) {
    return process.env.TURSO_AUTH_TOKEN;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const match = databaseUrl.match(/[?&]authToken=([^&]+)/);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

export const tursoClient: Client = createClient({
  url: getDatabaseUrl(),
  authToken: getAuthToken(),
});

export function getTursoClient(): Client {
  return tursoClient;
}