import type { Article } from './articles';

export type GradeRaceUpdateStageKey =
  | 'field_building'
  | 'race_week'
  | 'draw_confirmed'
  | 'final_48h'
  | 'race_morning'
  | 'post_race';

export type GradeRaceUpdateStage = {
  key: GradeRaceUpdateStageKey;
  label: string;
  timing: string;
  focus: string;
};

export type GradeRaceUpdatePlan = {
  currentStageKey: GradeRaceUpdateStageKey;
  stages: GradeRaceUpdateStage[];
};

export const gradeRaceUpdateStages: GradeRaceUpdateStage[] = [
  {
    key: 'field_building',
    label: '出走予定の整理',
    timing: '開催3〜21日前',
    focus: '開催概要、コース傾向、出走予定馬を確認',
  },
  {
    key: 'race_week',
    label: 'レース週の更新',
    timing: '開催7日前以降',
    focus: '登録馬、距離適性、ローテーションを比較',
  },
  {
    key: 'draw_confirmed',
    label: '枠順発表後',
    timing: '枠順発表後',
    focus: '枠順、脚質、隊列、内外の有利不利を更新',
  },
  {
    key: 'final_48h',
    label: '直前48時間',
    timing: '枠順発表後〜前日',
    focus: '脚質構成、展開、慎重に見る条件を整理',
  },
  {
    key: 'race_morning',
    label: '当日朝更新',
    timing: '当日馬場・気配確認後',
    focus: '馬場状態、馬体重発表前の最終確認、出馬表への導線を調整',
  },
  {
    key: 'post_race',
    label: '結果確認後',
    timing: '確定着順の反映後',
    focus: '確定結果と事前評価の差を振り返る',
  },
];

const stageOrder = gradeRaceUpdateStages.map((stage) => stage.key);

function inferCurrentStage(article: Article): GradeRaceUpdateStageKey {
  const legacyStageMap: Record<string, GradeRaceUpdateStageKey> = {
    one_week_before: 'race_week',
    eve_update: 'final_48h',
    result_review: 'post_race',
  };
  const rawStage = String(article.updateStage || '');
  const explicitStage = (legacyStageMap[rawStage] || rawStage) as GradeRaceUpdateStageKey | undefined;
  if (explicitStage && stageOrder.includes(explicitStage)) {
    return explicitStage;
  }

  const text = `${article.title} ${article.description} ${article.targetKeyword || ''}`;
  if (/結果|回顧/.test(text)) return 'post_race';
  if (/当日朝|当日更新/.test(text)) return 'race_morning';
  if (/前日|前夜|直前更新|最終確認/.test(text)) return 'final_48h';
  if (/枠順確定|枠順が確定|枠順発表後|枠順が発表された|枠順を発表|馬番確定|馬番が確定|出馬表発表後|出馬表が発表された|出馬表が公開された|出馬表を発表/.test(text)) {
    return 'draw_confirmed';
  }
  if (/出走予定|開催概要|コース傾向/.test(text)) return 'field_building';
  return 'race_week';
}

export function getGradeRaceUpdatePlan(article: Article): GradeRaceUpdatePlan | null {
  const isGradeRaceArticle =
    article.themeCluster === 'grade_race_preview' ||
    article.category.includes('重賞') ||
    /G[123]|Ｇ[１２３]|重賞|ダービー|オークス|記念|ステークス|S\d{4}|カップ/.test(article.title);

  if (!isGradeRaceArticle) return null;

  return {
    currentStageKey: inferCurrentStage(article),
    stages: gradeRaceUpdateStages,
  };
}
