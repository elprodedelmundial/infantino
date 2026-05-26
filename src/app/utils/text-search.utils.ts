/** Lowercases and strips diacritics so "mexico" matches "México", "espana" matches "España", etc. */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '');
}

export function includesNormalized(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeForSearch(needle);
  if (!normalizedNeedle) {
    return true;
  }
  return normalizeForSearch(haystack).includes(normalizedNeedle);
}
