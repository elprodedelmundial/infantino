/** Lowercases and strips diacritics so "mexico" matches "México", "espana" matches "España", etc. */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '');
}

/** Alternate local names keyed by normalized official country name. */
const COUNTRY_SEARCH_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  'paises bajos': ['holanda']
};

function countrySynonymsForName(countryName: string): readonly string[] {
  return COUNTRY_SEARCH_SYNONYMS[normalizeForSearch(countryName)] ?? [];
}

export function includesNormalized(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeForSearch(needle);
  if (!normalizedNeedle) {
    return true;
  }
  return normalizeForSearch(haystack).includes(normalizedNeedle);
}

/** Country name search, including configured synonyms (e.g. Holanda → Países Bajos). */
export function matchesCountrySearch(countryName: string, needle: string): boolean {
  if (includesNormalized(countryName, needle)) {
    return true;
  }
  const normalizedNeedle = normalizeForSearch(needle);
  if (!normalizedNeedle) {
    return true;
  }
  return countrySynonymsForName(countryName).some(syn =>
    normalizeForSearch(syn).includes(normalizedNeedle)
  );
}
