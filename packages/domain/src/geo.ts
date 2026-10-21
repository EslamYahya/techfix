/** Launch area: Egypt (rough bounding box). Server-side check for engineer bases and request locations. */
const BOX = { minLat: 21.9, maxLat: 31.7, minLng: 24.6, maxLng: 36.9 };

export const isInSupportedArea = (latitude: number, longitude: number): boolean =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= BOX.minLat &&
  latitude <= BOX.maxLat &&
  longitude >= BOX.minLng &&
  longitude <= BOX.maxLng;
