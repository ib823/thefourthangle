export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
export const FALLBACK_SITE_ORIGIN = 'https://thefourthangle.pages.dev';

export function withBuildId(path: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}v=${encodeURIComponent(BUILD_ID)}`;
}

export function freshFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(withBuildId(path), {
    ...init,
    cache: 'no-store',
  });
}

export function getSiteOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return FALLBACK_SITE_ORIGIN;
}
