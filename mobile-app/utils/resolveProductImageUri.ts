/**
 * Picks Cloudinary / legacy image URLs from API-shaped objects without crashing
 * when fields are missing or oddly typed.
 */
import { ACTIVE_API_URL } from '@/src/config/constants';

function urlsFromField(field: unknown): string[] {
  if (field == null) return [];
  if (Array.isArray(field)) {
    return field
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean);
  }
  if (typeof field === 'string' && field.trim()) return [field.trim()];
  if (typeof field === 'object' && field !== null && 'url' in field) {
    const u = (field as { url?: unknown }).url;
    if (typeof u === 'string' && u.trim()) return [u.trim()];
  }
  return [];
}

function normalizeUri(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }

  const normalizedPath = trimmed.replace(/\\/g, '/');
  const base = (ACTIVE_API_URL || '').trim().replace(/\/+$/, '');
  if (!base) return normalizedPath;
  const withLeadingSlash = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  return `${base}${withLeadingSlash}`;
}

export type ProductLikeImages = {
  imageUrl?: unknown;
  image?: unknown;
};

export function resolveProductImageGallery(entity: ProductLikeImages | null | undefined): string[] {
  if (!entity) return [];
  const primary = urlsFromField(entity.imageUrl).map(normalizeUri).filter(Boolean);
  if (primary.length) return primary;
  return urlsFromField(entity.image).map(normalizeUri).filter(Boolean);
}

export function resolveProductImageUri(entity: ProductLikeImages | null | undefined): string | null {
  const list = resolveProductImageGallery(entity);
  return list[0] ?? null;
}
