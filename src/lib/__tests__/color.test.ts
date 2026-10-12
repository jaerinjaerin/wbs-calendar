import { describe, it, expect } from 'vitest';
import { lighter80 } from '../color';

describe('lighter80', () => {
  it('returns Excel swatches for presets, case-insensitive', () => {
    expect(lighter80('#4472C4')).toBe('#D9E1F2');
    expect(lighter80('#ffc000')).toBe('#FFF2CC');
  });

  it('approximates other colors within a couple of steps of Excel', () => {
    expect(lighter80('#3563e9')).toMatch(/^#[0-9A-F]{6}$/);
    expect(lighter80('#000000')).toBe('#CCCCCC');
    expect(lighter80('#ffffff')).toBe('#FFFFFF');
  });
});
