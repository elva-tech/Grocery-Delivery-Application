type ImageLike = {
  imageUrl?: unknown;
  image?: unknown;
};
import { API_BASE_URL } from '../config';

function toUrlList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  }
  if (typeof value === 'string' && value.trim()) return [value];
  if (typeof value === 'object' && value !== null && 'url' in value) {
    const maybeUrl = (value as { url?: unknown }).url;
    if (typeof maybeUrl === 'string' && maybeUrl.trim()) return [maybeUrl];
  }
  return [];
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }

  const normalizedPath = trimmed.replace(/\\/g, '/');
  const base = (API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!base) return normalizedPath;
  const withLeadingSlash = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  return `${base}${withLeadingSlash}`;
}

export function resolveImageGallery(item: ImageLike | null | undefined): string[] {
  if (!item) return [];
  const primary = toUrlList(item.imageUrl).map(normalizeUrl).filter(Boolean);
  if (primary.length > 0) return primary;
  return toUrlList(item.image).map(normalizeUrl).filter(Boolean);
}

export function resolveImageUrl(item: ImageLike | null | undefined): string {
  return resolveImageGallery(item)[0] ?? '';
}
