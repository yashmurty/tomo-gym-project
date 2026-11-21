import { normalizeEmail } from './normalize-email';

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Aiko@Example.COM ')).toBe('aiko@example.com');
  });
});
