import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/lib/encryption';

describe('AES-256-GCM encryption', () => {
  it('encrypt → decrypt で元に戻る', () => {
    const plain = 'hello kizashi';
    const enc = encrypt(plain);
    expect(enc).not.toBe(plain);
    expect(decrypt(enc)).toBe(plain);
  });
  it('UTF-8 日本語も正しく往復', () => {
    const plain = 'こんにちは、世界🌏';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });
  it('OAuth refresh_token 想定の長い文字列も往復', () => {
    const plain = '1//04abc'.repeat(50);
    expect(decrypt(encrypt(plain))).toBe(plain);
  });
  it('暗号化結果は毎回異なる (IV ランダム)', () => {
    const plain = 'same plain';
    const a = encrypt(plain);
    const b = encrypt(plain);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plain);
    expect(decrypt(b)).toBe(plain);
  });
  it('改ざんされた暗号文は復号失敗', () => {
    const enc = encrypt('payload');
    const tampered = enc.slice(0, -1) + 'X';
    expect(() => decrypt(tampered)).toThrow();
  });
  it('フォーマット不正は例外', () => {
    expect(() => decrypt('not-a-valid-token')).toThrow();
  });
});
