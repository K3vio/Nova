// A function rather than constants so callers can load .env files first.
export function getDatabaseConfig() {
  return {
    url: process.env.DATABASE_URL ?? "file:data/nova.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  };
}
