import type { Article } from './articles';

export type GradeRaceUpdateStageKey =
  | 'one_week_before'
  | 'draw_confirmed'
  | 'eve_update'
  | 'race_morning';

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
    key: 'one_week_before',
    label: '1週間前の展望',
    timing: '登録馬・想定段階',
    focus: 'コース傾向、ローテーション、出走予定馬の適性を整理',
  },
  {
    key: 'draw_confirmed',
    label: '枠順発表後',
    timing: '枠順発表後',
    focus: '枠順、脚質、隊列、内外の有利不利を更新',
  },
  {
    key: 'eve_update',
    label: '前日更新',
    timing: '前日オッズ確認後',
    focus: '人気とのズレ、買い足す条件、見送る条件を整理',
  },
  {
    key: 'race_morning',
    label: '当日朝更新',
    timing: '当日馬場・気配確認後',
    focus: '馬場状態、馬体重発表前の最終確認、出馬表への導線を調整',
  },
];

const stageOrder = gradeRaceUpdateStages.map((stage) => stage.key);

function inferCurrentStage(article: Article): GradeRaceUpdateStageKey {
  const explicitStage = article.updateStage as GradeRaceUpdateStageKey | undefined;
  if (explicitStage && stageOrder.includes(explicitStage)) {
    return explicitStage;
  }

  const text = `${article.title} ${article.description} ${article.targetKeyword || ''}`;
  if (/当日朝|当日更新|直前更新|最終確認/.test(text)) return 'race_morning';
  if (/前日|前夜|オッズ/.test(text)) return 'eve_update';
  if (/枠順確定|枠順が確定|枠順発表後|枠順が発表された|枠順を発表|馬番確定|馬番が確定|出馬表発表後|出馬表が発表された|出馬表が公開された|出馬表を発表/.test(text)) {
    return 'draw_confirmed';
  }
  return 'one_week_before';
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
