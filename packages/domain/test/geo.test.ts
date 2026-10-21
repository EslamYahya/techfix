import { describe, expect, it } from 'vitest';
import { isInSupportedArea } from '../src/index';

describe('supported area', () => {
  it('accepts Cairo and Alexandria', () => {
    expect(isInSupportedArea(30.0444, 31.2357)).toBe(true);
    expect(isInSupportedArea(31.2, 29.92)).toBe(true);
  });
  it('rejects points outside Egypt and non-finite input', () => {
    expect(isInSupportedArea(51.5, -0.12)).toBe(false);
    expect(isInSupportedArea(Number.NaN, 31)).toBe(false);
  });
});
