// same formula as in Matcha, in meters
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;

  const lat1Rad = (lat1 * Math.PI) / 180.0;
  const lat2Rad = (lat2 * Math.PI) / 180.0;

  const a =
    Math.pow(Math.sin(dLat / 2), 2) +
    Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);

  const R = 6371000;
  const c = 2 * Math.asin(Math.sqrt(a));

  return R * c;
}
