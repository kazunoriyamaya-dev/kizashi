import { describe, it, expect } from 'vitest';
import { calcCarFare, formatJPY } from '@/lib/utils';

describe('calcCarFare (Q009 往復 × 30円/km, 小数点切り上げ)', () => {
  it('1km 片道 → 60円', () => {
    // 往復2km × 30円 = 60円
    expect(calcCarFare(1)).toBe(60);
  });
  it('1.5km 片道 → 90円 (往復3km)', () => {
    expect(calcCarFare(1.5)).toBe(90);
  });
  it('1.4km 片道 → 90円 (往復2.8km → 切り上げ3km × 30)', () => {
    expect(calcCarFare(1.4)).toBe(90);
  });
  it('0.5km 片道 → 30円 (往復1km × 30)', () => {
    expect(calcCarFare(0.5)).toBe(30);
  });
  it('0km → 0円', () => {
    expect(calcCarFare(0)).toBe(0);
  });
  it('10km 片道 → 600円 (往復20km × 30)', () => {
    expect(calcCarFare(10)).toBe(600);
  });
  it('小数点切り上げで往復距離を整数化', () => {
    // 7.4km × 2 = 14.8 → 15 × 30 = 450
    expect(calcCarFare(7.4)).toBe(450);
    // 7.5km × 2 = 15 → 15 × 30 = 450
    expect(calcCarFare(7.5)).toBe(450);
    // 7.6km × 2 = 15.2 → 16 × 30 = 480
    expect(calcCarFare(7.6)).toBe(480);
  });
});

describe('formatJPY', () => {
  it('整数を ¥xxx 形式で返す', () => {
    expect(formatJPY(1500)).toBe('¥1,500');
    expect(formatJPY(0)).toBe('¥0');
    expect(formatJPY(1000000)).toBe('¥1,000,000');
  });
});
