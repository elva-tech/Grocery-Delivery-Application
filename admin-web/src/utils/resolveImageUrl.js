const getFirstNonEmptyString = (value) => {
  if (!Array.isArray(value)) return null;

  for (const entry of value) {
    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      if (trimmed) return trimmed;
    }
  }

  return null;
};

const getTrimmedString = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const resolveImageUrl = (entity) => {
  if (!entity || typeof entity !== 'object') return null;

  const preferred = entity.imageUrl;
  if (Array.isArray(preferred)) {
    return getFirstNonEmptyString(preferred);
  }

  const preferredString = getTrimmedString(preferred);
  if (preferredString) return preferredString;

  const fallback = entity.image;
  if (Array.isArray(fallback)) {
    return getFirstNonEmptyString(fallback);
  }

  return getTrimmedString(fallback);
};

export default resolveImageUrl;
