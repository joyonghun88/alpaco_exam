function normalizeBaseUrl(value: string | undefined, fallback: string) {
  const raw = (value ?? '').trim();
  if (!raw) return fallback;
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

// Examples:
// - Docker/production behind nginx proxy: VITE_API_URL=/api
// - Local dev without proxy: VITE_API_URL=http://localhost:3000/api
export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_URL,
  '/api',
);

// Socket.io defaults to current origin when passed an empty string.
// For local dev without proxy: VITE_SOCKET_URL=http://localhost:3000
export const SOCKET_URL = normalizeBaseUrl(import.meta.env.VITE_SOCKET_URL, '');
