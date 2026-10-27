import { calculateDistanceMeters } from './haversine.util';

const CITIES = {
  Paris: { lat: 48.8566, lon: 2.3522 },
  Tokyo: { lat: 35.6762, lon: 139.6503 },
  NewYork: { lat: 40.7128, lon: -74.006 },
  Bangkok: { lat: 13.7563, lon: 100.5018 },
  Samyan: { lat: 13.7333, lon: 100.5317 },
  LatPhrao: { lat: 13.8278, lon: 100.6067 },
} as const;

describe('Haversine Formula - calculateDistanceMeters', () => {
  it('check identical coordinates', () => {
    const { lat, lon } = CITIES.Bangkok;
    expect(calculateDistanceMeters(lat, lon, lat, lon)).toBeCloseTo(0, 5);
  });

  it('check very close coordinates', () => {
    const distance = calculateDistanceMeters(
      CITIES.Bangkok.lat,
      CITIES.Bangkok.lon,
      CITIES.Bangkok.lat + 0.0001,
      CITIES.Bangkok.lon + 0.0001,
    );
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(20);
  });

  it('check short distances', () => {
    const distance = calculateDistanceMeters(
      CITIES.Samyan.lat,
      CITIES.Samyan.lon,
      CITIES.LatPhrao.lat,
      CITIES.LatPhrao.lon,
    );
    expect(distance).toBeGreaterThan(9000);
    expect(distance).toBeLessThan(14000);
  });

  it('check distance Bangkok-Paris (~9500km)', () => {
    const distance = calculateDistanceMeters(
      CITIES.Bangkok.lat,
      CITIES.Bangkok.lon,
      CITIES.Paris.lat,
      CITIES.Paris.lon,
    );
    expect(distance).toBeGreaterThan(9400000);
    expect(distance).toBeLessThan(9600000);
  });

  it('check distance Bangkok-Tokyo (~4600km)', () => {
    const distance = calculateDistanceMeters(
      CITIES.Bangkok.lat,
      CITIES.Bangkok.lon,
      CITIES.Tokyo.lat,
      CITIES.Tokyo.lon,
    );
    expect(distance).toBeGreaterThan(4400000);
    expect(distance).toBeLessThan(4800000);

    // const distanceKm = (distance / 1000).toFixed(2);
    // console.log(`Bangkok to Tokyo distance: ${distanceKm} km`);
  });

  it('check distance Bangkok-New York (~14000km)', () => {
    const distance = calculateDistanceMeters(
      CITIES.Bangkok.lat,
      CITIES.Bangkok.lon,
      CITIES.NewYork.lat,
      CITIES.NewYork.lon,
    );
    expect(distance).toBeGreaterThan(13500000);
    expect(distance).toBeLessThan(14500000);
  });

  it('check opposite latitude (poles)', () => {
    const distance = calculateDistanceMeters(90, 0, -90, 0);
    expect(distance).toBeCloseTo(Math.PI * 6371000, -2);
  });

  it('check opposite longtitude', () => {
    const distance = calculateDistanceMeters(0, 0, 0, 180);
    expect(distance).toBeCloseTo(Math.PI * 6371000, -2);
  });

  it('check opposite latitude and longtitude', () => {
    const distance = calculateDistanceMeters(15, 25, -15, -155);
    expect(distance).toBeCloseTo(Math.PI * 6371000, -2);
  });

  it('check symmetry', () => {
    const a = calculateDistanceMeters(
      CITIES.Bangkok.lat,
      CITIES.Bangkok.lon,
      CITIES.NewYork.lat,
      CITIES.NewYork.lon,
    );
    const b = calculateDistanceMeters(
      CITIES.NewYork.lat,
      CITIES.NewYork.lon,
      CITIES.Bangkok.lat,
      CITIES.Bangkok.lon,
    );
    expect(a).toBeCloseTo(b, 5);
  });

  it('check out-of-bound coordinates', () => {
    const distance = calculateDistanceMeters(
      150,
      200,
      CITIES.Paris.lat,
      CITIES.Paris.lon,
    );
    expect(typeof distance).toBe('number');
  });

  it('check NaN parameters', () => {
    const distance = calculateDistanceMeters(
      NaN,
      CITIES.Paris.lon,
      CITIES.Paris.lat,
      CITIES.Paris.lon,
    );
    expect(isNaN(distance)).toBe(true);
  });
});
