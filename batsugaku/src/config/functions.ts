export const FUNCTIONS_REGION = 'asia-northeast1';

/**
 * Functions の Base URL を固定したい場合に設定します。
 * - 末尾スラッシュは不要
 * - 例: https://asia-northeast1-batsugaku.cloudfunctions.net
 *
 * 空文字の場合は projectId から自動生成します。
 */
export const FUNCTIONS_BASE_URL_OVERRIDE = '';

export function getFunctionsBaseUrl(projectId?: string): string {
  const override = String(FUNCTIONS_BASE_URL_OVERRIDE || '').trim();
  if (override) return override.replace(/\/+$/, '');
  const pid = String(projectId || '').trim();
  if (!pid) return '';
  return `https://${FUNCTIONS_REGION}-${pid}.cloudfunctions.net`;
}


