/**
 * Utilities for managing user-customizable Transformer Capacities (kVA) and Brands
 * with localStorage persistence.
 */

export const DEFAULT_CAPACITIES: number[] = [30, 50, 100, 160, 250, 315, 400, 500, 750, 1000];

export const DEFAULT_BRANDS: string[] = [
  'Ekarat',
  'Tirathai',
  'Charoenchai',
  'Precise',
  'QTC',
  'Asia Trafo',
  'Thai Trafo',
  'Bangkok Trafo',
  'ABB',
  'Schneider',
  'Siemens',
  'Other',
];

const STORAGE_KEY_CUSTOM_CAPACITIES = 'pea_custom_capacities';
const STORAGE_KEY_CUSTOM_BRANDS = 'pea_custom_brands';

export function getStoredCapacities(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_CAPACITIES);
    if (!raw) return DEFAULT_CAPACITIES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Merge unique and sort ascending
      const set = new Set([...DEFAULT_CAPACITIES, ...parsed.map(Number).filter(n => !isNaN(n) && n > 0)]);
      return Array.from(set).sort((a, b) => a - b);
    }
  } catch {
    // ignore
  }
  return DEFAULT_CAPACITIES;
}

export function addCustomCapacity(newCap: number): number[] {
  const current = getStoredCapacities();
  if (!current.includes(newCap) && newCap > 0) {
    const updated = [...current, newCap].sort((a, b) => a - b);
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_CAPACITIES, JSON.stringify(updated));
    } catch {
      // ignore
    }
    return updated;
  }
  return current;
}

export function removeCustomCapacity(cap: number): number[] {
  const current = getStoredCapacities();
  // Don't remove core defaults if they match unless desired
  const updated = current.filter((c) => c !== cap);
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_CAPACITIES, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

// Helper to normalize any existing brand string to pure English
export function cleanBrandToEnglish(brandName: string): string {
  if (!brandName) return 'Other';
  const match = brandName.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  // Check if starts or contains Thai and maps to common English
  const mapping: Record<string, string> = {
    'เอกรัฐ': 'Ekarat',
    'ถิรไทย': 'Tirathai',
    'เจริญชัย': 'Charoenchai',
    'พรีไซซ': 'Precise',
    'คิวทีซี': 'QTC',
    'เอเชีย แทรฟโฟ': 'Asia Trafo',
    'หม้อแปลงไทย': 'Thai Trafo',
    'บางกอกเทรโฟ': 'Bangkok Trafo',
    'เอบีบี': 'ABB',
    'ชไนเดอร์': 'Schneider',
    'ซีเมนส์': 'Siemens',
    'อื่นๆ': 'Other',
  };
  for (const [thai, eng] of Object.entries(mapping)) {
    if (brandName.includes(thai)) {
      return eng;
    }
  }
  // Remove any remaining Thai characters
  const stripped = brandName.replace(/[\u0E00-\u0E7F]+/g, '').trim();
  return stripped || brandName;
}

export function getStoredBrands(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_BRANDS);
    if (!raw) return DEFAULT_BRANDS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleaned = parsed.map(s => cleanBrandToEnglish(String(s).trim())).filter(Boolean);
      const set = new Set([...DEFAULT_BRANDS, ...cleaned]);
      return Array.from(set);
    }
  } catch {
    // ignore
  }
  return DEFAULT_BRANDS;
}

export function addCustomBrand(newBrand: string): string[] {
  const trimmed = newBrand.trim();
  if (!trimmed) return getStoredBrands();
  const current = getStoredBrands();
  if (!current.some((b) => b.toLowerCase() === trimmed.toLowerCase())) {
    const updated = [...current, trimmed];
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_BRANDS, JSON.stringify(updated));
    } catch {
      // ignore
    }
    return updated;
  }
  return current;
}

export function removeCustomBrand(brand: string): string[] {
  const current = getStoredBrands();
  const updated = current.filter((b) => b !== brand);
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_BRANDS, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}
