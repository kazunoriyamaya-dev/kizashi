import { describe, it, expect } from 'vitest';
import { issueInviteToken, verifyInviteToken } from '@/lib/auth/invite-token';

const INSTRUCTOR_ID = '11111111-1111-1111-1111-111111111111';

describe('講師招待トークン (HMAC + 期限付き)', () => {
  it('発行 → 検証で instructorId が一致', () => {
    const token = issueInviteToken(INSTRUCTOR_ID, 72);
    const verified = verifyInviteToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.instructorId).toBe(INSTRUCTOR_ID);
  });

  it('期限内: expiresAt が future', () => {
    const before = Date.now();
    const token = issueInviteToken(INSTRUCTOR_ID, 1);
    const verified = verifyInviteToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.expiresAt.getTime()).toBeGreaterThan(before);
    expect(verified!.expiresAt.getTime()).toBeLessThanOrEqual(before + 1 * 3600_000 + 1000);
  });

  it('改ざん検知: ペイロード書き換え → 検証失敗', () => {
    const token = issueInviteToken(INSTRUCTOR_ID, 72);
    const [payload, sig] = token.split('.');
    const wrong = payload!.slice(0, -1) + 'A' + '.' + sig;
    expect(verifyInviteToken(wrong)).toBeNull();
  });

  it('改ざん検知: 署名書き換え → 検証失敗', () => {
    const token = issueInviteToken(INSTRUCTOR_ID, 72);
    const [payload, sig] = token.split('.');
    const wrong = payload + '.' + sig!.slice(0, -1) + 'A';
    expect(verifyInviteToken(wrong)).toBeNull();
  });

  it('期限切れトークンは null', () => {
    const token = issueInviteToken(INSTRUCTOR_ID, -1); // 過去 1 時間
    expect(verifyInviteToken(token)).toBeNull();
  });

  it('不正フォーマットは null', () => {
    expect(verifyInviteToken('garbage')).toBeNull();
    expect(verifyInviteToken('only-one-segment')).toBeNull();
    expect(verifyInviteToken('a.b.c')).toBeNull();
  });
});
