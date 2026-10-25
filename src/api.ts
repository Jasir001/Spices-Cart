const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

export const serverApiEnabled = !import.meta.env.DEV || import.meta.env.VITE_API_ENABLED === 'true';
