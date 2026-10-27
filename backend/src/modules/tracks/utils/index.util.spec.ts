import { handlePositionBetween } from './index.util';

describe('Fractional Indexing - handlePositionBetween', () => {
  describe('Empty bounds (initialization)', () => {
    it('check middle character returned when both before and after are null', () => {
      const pos = handlePositionBetween(null, null);
      expect(pos).toBe('n');
    });
  });

  describe('Single bound provided', () => {
    it('check position before "m" when only after is provided (null, "m")', () => {
      const pos = handlePositionBetween(null, 'm');
      expect(pos > '').toBe(true);
      expect(pos < 'm').toBe(true);
    });

    it('check position after "m" when only before is provided ("m", null)', () => {
      const pos = handlePositionBetween('m', null);
      expect(pos > 'm').toBe(true);
    });
  });

  describe('Standard midpoint calculations', () => {
    it('check exact midpoint between "a" and "c"', () => {
      const pos = handlePositionBetween('a', 'c');
      expect(pos).toBe('b');
    });

    it('check midpoint between "a" and "z"', () => {
      const pos = handlePositionBetween('a', 'z');
      expect(pos > 'a').toBe(true);
      expect(pos < 'z').toBe(true);
    });
  });

  describe('Tight adjacent characters (string extension)', () => {
    it('check adjacent characters like "a" and "b" by extending the string', () => {
      const pos = handlePositionBetween('a', 'b');
      expect(pos > 'a').toBe(true);
      expect(pos < 'b').toBe(true);
      expect(pos.startsWith('a')).toBe(true);
    });

    it('check consecutive tight insertions correctly', () => {
      const first = handlePositionBetween('a', 'b');
      const second = handlePositionBetween('a', first);

      expect(second > 'a').toBe(true);
      expect(second < first).toBe(true);
    });
  });

  describe('Sorting & Ordering Invariants', () => {
    it('check generated position strictly sits between before and after', () => {
      const before = 'h';
      const after = 'q';
      const pos = handlePositionBetween(before, after);

      expect(pos > before).toBe(true);
      expect(pos < after).toBe(true);
    });
  });
});
