import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * shadcn/ui で利用する className マージユーティリティ
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 金額表示（日本円、整数のみ）
 */
export function formatJPY(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * 距離km × 30円/km の交通費計算（Q009: 小数点切り上げ）
 *
 * @param oneWayKm 片道距離 (km)
 * @returns 往復・切り上げ済み運賃（円）
 */
export function calcCarFare(oneWayKm: number): number {
  const roundTripKm = oneWayKm * 2;
  return Math.ceil(roundTripKm) * 30;
}
