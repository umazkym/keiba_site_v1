import type { ArticleRacePreviewResponse } from '@/lib/types';

export type ArticleRaceBridgeMetadata = {
  enabled: boolean;
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
    metadata.enabled
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

  // nullは、公開時に検証済みだったAPIが一時的に取得できない場合だけ到達する。
  // その場合は保存済みの正確な情報とリンクだけを表示する。
  if (preview === null) return true;

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
