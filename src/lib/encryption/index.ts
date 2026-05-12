/**
 * AES-256-GCM 暗号化ユーティリティ
 *
 * 用途: Google OAuth refresh_token、LINE トークン等の機微情報の DB 保存
 *
 * 設計書: 05_API_非機能 SEC006「OAuth refresh_token等は暗号化保存」
 *
 * 鍵: 環境変数 ENCRYPTION_KEY (base64 32byte)
 *   生成: openssl rand -base64 32
 *
 * フォーマット: base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('[encryption] ENCRYPTION_KEY 環境変数が未設定です');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `[encryption] ENCRYPTION_KEY は base64 で 32byte である必要があります (現在: ${key.length}byte)`,
    );
  }
  return key;
}

/**
 * 平文文字列を暗号化
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * 暗号化された文字列を復号
 */
export function decrypt(payload: string): string {
  const key = getKey();
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('[encryption] 不正な暗号化フォーマット');
  }
  const [ivB64, tagB64, dataB64] = parts;
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('[encryption] 不正な暗号化フォーマット');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('[encryption] authTag長が不正');
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}
