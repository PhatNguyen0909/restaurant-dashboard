const STORAGE_KEY = 'restaurant-dashboard:merchant-coordinates';

const isFiniteNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return false;
    const parsed = Number(normalized.replace(',', '.'));
    return Number.isFinite(parsed);
  }
  return false;
};

const pickCoordinate = (source, fallbackKeys = []) => {
  if (source == null) return null;
  if (isFiniteNumber(source)) return Number(String(source).replace(',', '.'));
  for (const key of fallbackKeys) {
    const candidate = source[key];
    if (isFiniteNumber(candidate)) {
      return Number(String(candidate).replace(',', '.'));
    }
  }
  return null;
};

export const saveMerchantCoordinates = (coords) => {
  if (typeof window === 'undefined' || !coords) return;
  const latitude = pickCoordinate(coords, ['latitude', 'lat']);
  const longitude = pickCoordinate(coords, ['longitude', 'lng', 'long']);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  const payload = JSON.stringify({ latitude, longitude, updatedAt: Date.now() });
  window.localStorage.setItem(STORAGE_KEY, payload);
};

export const loadMerchantCoordinates = () => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.latitude) || !Number.isFinite(parsed?.longitude)) {
      return null;
    }
    return {
      latitude: Number(parsed.latitude),
      longitude: Number(parsed.longitude),
      lat: Number(parsed.latitude),
      lng: Number(parsed.longitude),
      updatedAt: parsed?.updatedAt ?? null,
    };
  } catch {
    return null;
  }
};
