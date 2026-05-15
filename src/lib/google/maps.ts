/**
 * Google Maps Routes API ラッパー
 *
 * 設計書 F038 / Q008 / Q009:
 *  - 車: Routes API で driving 距離を取得 → 往復 × 30円/km、小数点切り上げ
 *  - 電車: Routes API で transit fare を取得（地域により利用不可なケース多数）
 *          取得不可時は manual 入力フォールバック
 *
 * API: https://routes.googleapis.com/directions/v2:computeRoutes
 *  - POST + X-Goog-Api-Key + X-Goog-FieldMask ヘッダー
 *  - fields は最小限のみリクエスト（コスト最適化）
 */
import { calcCarFare } from '@/lib/utils';
import { logger } from '@/lib/logger';

const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

export type TransportationMode = 'train' | 'car';

export interface TravelFareResult {
  mode: TransportationMode;
  distanceKm?: number;
  roundTripKm?: number;
  amount: number;
  manual: boolean;
  manualReason?: string;
  rawSummary?: Record<string, unknown>;
}

interface RoutesApiResponse {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    travelAdvisory?: {
      transitFare?: { currencyCode: string; units?: string; nanos?: number };
    };
  }>;
  error?: { code: number; message: string; status: string };
}

export interface MapsAddressInput {
  postal_code?: string | null;
  prefecture?: string | null;
  city?: string | null;
  address_line: string;
  building?: string | null;
}

function formatAddressForApi(addr: MapsAddressInput): string {
  return [
    addr.postal_code ? `〒${addr.postal_code}` : null,
    addr.prefecture,
    addr.city,
    addr.address_line,
    addr.building,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * 車での距離を Routes API で取得
 *  - 片道 driving 距離 (m) を取得 → km 変換 → 往復切り上げ × 30円/km (Q009)
 */
async function fetchCarDistance(
  fromAddress: string,
  toAddress: string,
): Promise<{ distanceKm: number; rawSummary: Record<string, unknown> } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    logger.error('GOOGLE_MAPS_API_KEY 未設定');
    return null;
  }

  const body = {
    origin: { address: fromAddress },
    destination: { address: toAddress },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
    units: 'METRIC',
    languageCode: 'ja',
    regionCode: 'JP',
  };

  const res = await fetch(ROUTES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn('maps routes (car) failed', {
      code: String(res.status),
      detail: text.slice(0, 200),
    });
    return null;
  }

  const data = (await res.json()) as RoutesApiResponse;
  const route = data.routes?.[0];
  if (!route || typeof route.distanceMeters !== 'number') {
    return null;
  }
  const distanceKm = route.distanceMeters / 1000;
  return {
    distanceKm,
    rawSummary: {
      mode: 'DRIVE',
      distance_meters: route.distanceMeters,
      duration: route.duration,
    },
  };
}

/**
 * 電車運賃を Routes API (TRANSIT) で取得
 *  - 日本国内では travelAdvisory.transitFare が返ることがあるが、地域・経路によっては取得不可
 *  - 取得できれば units から円を計算
 *  - 取得不可時は null
 */
async function fetchTrainFare(
  fromAddress: string,
  toAddress: string,
): Promise<{ fareJpy: number; rawSummary: Record<string, unknown> } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const body = {
    origin: { address: fromAddress },
    destination: { address: toAddress },
    travelMode: 'TRANSIT',
    languageCode: 'ja',
    regionCode: 'JP',
    transitPreferences: {
      allowedTravelModes: ['TRAIN', 'SUBWAY', 'LIGHT_RAIL'],
    },
  };

  const res = await fetch(ROUTES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.travelAdvisory.transitFare',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn('maps routes (transit) failed', {
      code: String(res.status),
      detail: text.slice(0, 200),
    });
    return null;
  }

  const data = (await res.json()) as RoutesApiResponse;
  const route = data.routes?.[0];
  const fare = route?.travelAdvisory?.transitFare;
  if (!fare || !fare.units) return null;

  const fareJpy = parseInt(fare.units, 10);
  if (!Number.isFinite(fareJpy)) return null;

  if (fare.currencyCode && fare.currencyCode !== 'JPY') {
    logger.warn('transit fare not in JPY', { code: fare.currencyCode });
    return null;
  }

  return {
    fareJpy,
    rawSummary: {
      mode: 'TRANSIT',
      distance_meters: route?.distanceMeters,
      duration: route?.duration,
      fare_currency: fare.currencyCode,
    },
  };
}

export interface CalculateTravelFareInput {
  fromAddress: MapsAddressInput;
  toAddress: MapsAddressInput;
  mode: TransportationMode;
}

/**
 * 交通費自動計算
 *
 * 戻り値:
 *  - mode='car': 往復 × 30円/km、切り上げ。失敗時は manual=true
 *  - mode='train': transit fare。地域により取得不可、その場合は manual=true
 */
export async function calculateTravelFare(
  input: CalculateTravelFareInput,
): Promise<TravelFareResult> {
  const from = formatAddressForApi(input.fromAddress);
  const to = formatAddressForApi(input.toAddress);

  if (input.mode === 'car') {
    const r = await fetchCarDistance(from, to);
    if (!r) {
      return {
        mode: 'car',
        amount: 0,
        manual: true,
        manualReason: 'Google Maps から距離を取得できませんでした。手動で入力してください。',
      };
    }
    const amount = calcCarFare(r.distanceKm); // 往復 × 30円/km、切り上げ (Q009)
    return {
      mode: 'car',
      distanceKm: r.distanceKm,
      roundTripKm: Math.ceil(r.distanceKm * 2),
      amount,
      manual: false,
      rawSummary: r.rawSummary,
    };
  }

  // train
  const r = await fetchTrainFare(from, to);
  if (!r) {
    return {
      mode: 'train',
      amount: 0,
      manual: true,
      manualReason:
        '電車運賃が Google Maps から取得できませんでした。管理者または講師が手動で入力してください (Q008)',
    };
  }
  return {
    mode: 'train',
    amount: r.fareJpy,
    manual: false,
    rawSummary: r.rawSummary,
  };
}
