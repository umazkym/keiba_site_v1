import type { ArticleRacePreviewResponse } from '@/lib/types';

export type ArticleRaceBridgeMetadata = {
  eligible: boolean;
  entityType?: string;
  raceName?: string;
  scheduledRaceDate?: string;
  seasonYear?: number | string;
  raceId?: string;
  raceUrl?: string;
};

const EXACT_RACE_URL = /^\/races\/\d{4}-\d{2}-\d{2}\/[a-z0-9%.-]+\/\d{1,2}$/;

export function hasValidArticleRaceBridgeMetadata(metadata: ArticleRaceBridgeMetadata): boolean {
  return Boolean(
    metadata.eligible
    && metadata.entityType === 'grade_race'
    && metadata.raceName
    && metadata.scheduledRaceDate
    && metadata.raceId
    && metadata.raceUrl
    && EXACT_RACE_URL.test(metadata.raceUrl)
    && (!metadata.seasonYear || metadata.scheduledRaceDate.startsWith(`${metadata.seasonYear}-`)),
  );
}

export function shouldRenderArticleRaceBridge(
  metadata: ArticleRaceBridgeMetadata,
  preview: ArticleRacePreviewResponse | null,
): boolean {
  if (!hasValidArticleRaceBridgeMetadata(metadata)) return false;

  // 公開時に一度検証済みでも、表示時点でAPIを確認できない場合はDOMも予約高も出さない。
  if (preview === null) return false;

  const race = preview.race;
  return Boolean(
    preview.status === 'available'
    && race
    && race.id === metadata.raceId
    && race.race_url === metadata.raceUrl
    && race.race_date === metadata.scheduledRaceDate
    && preview.top_predictions.length > 0,
  );
}
