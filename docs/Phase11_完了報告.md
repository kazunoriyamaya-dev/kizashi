# Phase 11 完了報告 - 交通費計算

実装日: 2026-05-12
担当: Claude（Cowork mode）

## 1. 実装した内容

### 1.1 Google Maps Routes API ラッパー (`lib/google/maps.ts` 本実装)

**Routes API v2** (`https://routes.googleapis.com/directions/v2:computeRoutes`) を採用:

- HTTP POST + `X-Goog-Api-Key` ヘッダー + `X-Goog-FieldMask` で取得列を最小化（コスト最適化）
- ロケールは `ja` / リージョン `JP`

**`fetchCarDistance(from, to)`**:

- `travelMode: 'DRIVE'`、`routingPreference: 'TRAFFIC_UNAWARE'`
- `routes.distanceMeters` を取得 → km 変換
- 失敗時は null

**`fetchTrainFare(from, to)`**:

- `travelMode: 'TRANSIT'`、`transitPreferences.allowedTravelModes: [TRAIN, SUBWAY, LIGHT_RAIL]`
- `routes.travelAdvisory.transitFare.units` を取得 → 円換算
- currencyCode が JPY 以外 / null は失敗扱い

**`calculateTravelFare(input)`** (公開関数):

- mode='car': `calcCarFare(km)` で **往復 × 30円/km、小数点切り上げ (Q009)**
- mode='train': 取得不可時 `manual=true, manualReason='Q008で手動入力'`

### 1.2 交通費計算ドメイン (`lib/reservations/travel-fee.ts`)

**`recordTravelFeeForReservation(reservationId)`**:

- 予約 + 講師 base_address + 予約 location_address を取得
- 講師の `transportation_mode` で `train|car` 自動判定
- `calculateTravelFare` 呼び出し
- `travel_fees` を upsert（reservation_id UNIQUE）
- 自動計算失敗時は `is_manual=true, requires_admin_review=true, manual_reason=...`
- raw レスポンスを最小限の summary で `maps_response_summary` に保存

**`setManualTravelFee(input)`**:

- 管理者/講師による手動上書き
- `requires_admin_review=false` に解除
- `audit_logs.action='travel_fee.manual_update'` 記録

### 1.3 予約作成への統合

- `lib/reservations/create.ts` (通常予約): RPC 成功後、`delivery_type='onsite'` の場合のみ `recordTravelFeeForReservation` 実行
- `lib/reservations/create-trial.ts` (体験予約): 同様に onsite で自動計算
- Maps API 失敗は予約自体には影響しない（warn ログ + manual=true で保存）

### 1.4 API + Server Action

- **`POST /api/maps/travel-fee`** (API022): 単発見積り。customer/admin/instructor が呼び出し可
- **`PATCH /api/admin/reservations/:id/travel-fee`**: 管理者の手動上書き
- Server Actions:
  - `setTravelFeeManualAction` — 管理者手動入力
  - `recalcTravelFeeAction` — Maps から再計算

### 1.5 A004 管理者予約詳細への統合

- 対面予約のとき新規「交通費 (Q008/Q009)」カードを表示:
  - 現在の交通費（モード / 金額 / 往復距離 / 手動入力フラグ / レビュー必要フラグ）
  - **手動入力フォーム**: mode / amount / distance_km / reason 入力 → 保存
  - **「Maps から再計算」ボタン** で `recalcTravelFeeAction` 実行
- フラッシュメッセージ `?travel_fee_updated=1` を追加

## 2. 変更したファイル一覧

### 新規（5）

**lib（2）**

- `src/lib/reservations/travel-fee.ts`
- `src/lib/admin/travel-fee-actions.ts`

**API Route（2）**

- `src/app/api/maps/travel-fee/route.ts`
- `src/app/api/admin/reservations/[id]/travel-fee/route.ts`

**完全書き換え（1）**

- `src/lib/google/maps.ts` — Phase 0 のスケルトンから Routes API v2 本実装に置換

### 更新（3）

- `src/lib/reservations/create.ts` — `delivery_type='onsite'` で `recordTravelFeeForReservation` 実行
- `src/lib/reservations/create-trial.ts` — 体験予約 onsite で同様
- `src/app/(admin)/admin/reservations/[id]/page.tsx` — 交通費カード + 手動入力フォーム追加

### 統計

- 全 TS/TSX: **162 ファイル**（Phase 10 の 158 から +4）

## 3. 検証結果

| 項目                         | 結果         |
| ---------------------------- | ------------ |
| TS/TSX 厳密括弧バランス      | ✅ 0件不整合 |
| `@/` alias 解決              | ✅ 0件失敗   |
| 必須ファイル存在チェック     | ✅ 5/5       |
| use server / use client 違反 | ✅ 0件       |

## 4. QA 反映

| QA       | 反映箇所                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| **Q008** | 電車運賃取得不可時に `manual=true, manualReason='管理者/講師手動入力'`、`requires_admin_review=true` で表示 |
| **Q009** | 車は **往復 × 30円/km、小数点切り上げ** (`calcCarFare` ＝ Phase 0 から `Math.ceil(km*2)*30`)                |
| **F038** | 対面予約成立時の `recordTravelFeeForReservation` で自動計算、travel_fees に保存                             |

## 5. セキュリティ・運用面

### 5.1 API キー保護

- `GOOGLE_MAPS_API_KEY` は server-side のみで使用、ESLint で client から import 禁止
- `.env.example` に「API 制限・請求上限を設定」の注意書きあり

### 5.2 FieldMask によるコスト抑制

- 必要な列のみリクエスト（distanceMeters / duration / transitFare）
- 1 リクエスト ≈ 1単位の課金

### 5.3 失敗時のフォールバック

- Maps API 失敗 → 予約自体は成立、travel_fees は `is_manual=true, amount=0` で保存
- 管理者画面で「⚠ 自動取得失敗のため管理者確認が必要です」表示
- 月次精算前に必ず手動入力で確定する運用

### 5.4 raw レスポンスの保存量

- `maps_response_summary` は最小限の field のみ JSONB に保存
- API レスポンス全体は保存しない（容量・個人情報両面）

## 6. 動作確認手順

```bash
# 前提: .env.local の GOOGLE_MAPS_API_KEY を設定
#       Google Cloud Console で Routes API を有効化
cd kizashi
pnpm dev
```

### シナリオ

1. **車予約**:
   - 講師 `transportation_mode='car'` を seed で設定
   - 顧客が対面・住所入力で予約 → 確定
   - DB の `travel_fees` に `mode='car', amount=Math.ceil(km*2)*30, is_manual=false`
2. **電車予約（取得成功）**:
   - 講師 `transportation_mode='train'`
   - 主要駅同士 → `transitFare` 取得 → `mode='train', amount=取得運賃, is_manual=false`
3. **電車予約（取得失敗）**:
   - 地方間 → `mode='train', amount=0, is_manual=true, manual_reason='Q008…'`
   - `requires_admin_review=true` で管理者画面に警告
4. **管理者手動入力**:
   - `/admin/reservations/[id]` の交通費カード
   - 「電車・¥420・新宿→吉祥寺の片道」など入力 → 保存
   - `audit_logs.action='travel_fee.manual_update'` 記録
5. **Maps 再計算**:
   - 「Maps から再計算」ボタンで `recalcTravelFeeAction`
   - 自動 / 手動の上書き戦略は最後に保存したもの優先

## 7. 未実装の内容（後続フェーズ）

- **電車運賃用の外部 API 連携**（駅すぱあと、ジョルダン等）: 国内最適化が必要ならフェーズ後追加
- **講師画面での交通費プレビュー**: I003 への travel_fees 表示は Phase 4 で既に対応済み（読み取り）
- **顧客画面での交通費表示**: 通常予約フォーム内のプレビューは Phase 6 で実装済み（簡易版）
- **月次精算と組み合わせた交通費集計**: Phase 12 で `payouts.travel_fee_amount` に集計

## 8. リスク・注意事項

### 8.1 Routes API の利用料金

- 通常リクエスト 1回 = $0.005〜$0.020
- 月次精算前に再計算を多用すると料金増
- 本番では cache レイヤー（同じ from/to の住所結果を 30 日キャッシュ等）を Phase 14 で検討

### 8.2 住所文字列の表記揺れ

- API は住所を文字列で受け取るため、表記揺れで距離が変動する可能性
- 講師の base_address / 顧客の location_address を統一フォーマットで保存（Phase 5 のフォームで「町域・番地」必須化済み）

### 8.3 行政区画変更

- 住所変更があると再計算が必要
- `addresses.updated_at` を見て古い travel_fees を invalidate するバッチが将来必要

### 8.4 transitFare の精度

- Routes API の TRANSIT mode は日本国内全駅対応ではない
- 大都市圏（東京・大阪等）は概ね取得可能、地方は手動入力が前提

## 9. 次のフェーズ（Phase 12: 精算 / 月次処理）

Phase 12 で実装:

1. **月次集計バッチ** — payouts テーブルに講師別の (チケット消化売上 − Stripe手数料) × 50% + 指名料 + 交通費を集計
2. **Stripe Connect Express** — 講師のオンボーディング、charges/payouts_enabled 同期
3. **管理者 A017 精算管理画面** — 月次一覧 + CSV エクスポート
4. **インボイス情報の表示** — invoice_settings との結合
5. **Stripe Transfer / Payout** API 連携で実支払い

Phase 12 を進めますか？「Phase 12 進めて」とお伝えください。
