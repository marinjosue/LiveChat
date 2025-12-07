const generatePIN = require('../../utils/pinGenerator');

describe('generatePIN', () => {
  it('should generate a 6-digit PIN', () => {
    const pin = generatePIN([]);
    expect(pin).toHaveLength(6);
    expect(parseInt(pin)).toBeGreaterThanOrEqual(100000);
    expect(parseInt(pin)).toBeLessThanOrEqual(999999);
  });

  it('should avoid existing PINs', () => {
    const existing = ['123456', '234567'];
    const pin = generatePIN(existing);
    expect(existing).not.toContain(pin);
  });

  it('should generate unique PINs', () => {
    const pins = new Set();
    for (let i = 0; i < 100; i++) {
      pins.add(generatePIN([]));
    }
    expect(pins.size).toBeGreaterThan(90); // Al menos 90% únicos
  });

  it('should handle large existing PIN lists', () => {
    const existing = Array.from({ length: 1000 }, (_, i) => (100000 + i).toString());
    const pin = generatePIN(existing);
    expect(pin).toBeDefined();
    expect(existing).not.toContain(pin);
  });

  it('should return string type', () => {
    const pin = generatePIN([]);
    expect(typeof pin).toBe('string');
  });

  it('should work with empty array', () => {
    const pin = generatePIN([]);
    expect(pin).toBeTruthy();
  });
});
