export type GradeRaceStage = {
  label: string;
  timing: string;
  body: string;
};

export type GradeRaceProfile = {
  slug: string;
  name: string;
  grade: string;
  date: string;
  venue: string;
  course: string;
  qualification: string;
  summary: string;
  focusPoints: string[];
  updateStages: GradeRaceStage[];
  relatedLinks: { label: string; href: string }[];
  xPostThemes: string[];
};

export const gradeRaceProfiles: GradeRaceProfile[] = [
  {
    slug: "2026-nihon-derby",
    name: "東京優駿（日本ダービー）",
    grade: "G1",
    date: "2026-05-31",
    venue: "東京",
    course: "芝2400m",
    qualification: "3歳牡馬・牝馬",
    summary:
      "東京芝2400mで行われる3歳世代の頂点を決める一戦。長い直線、直線入口までの位置取り、上がり性能、折り合い、内外の進路取りを分けて確認したいレースです。",
    focusPoints: [
      "東京芝2400mは直線が長く、早めに動ける持続力と上がり性能の両方を確認する",
      "人気馬でも外を回り続ける形になると距離ロスが大きく、枠順と脚質の組み合わせを見る",
      "皐月賞組、青葉賞組、プリンシパルS組でレース質が違うため、前走内容を同列に扱わない",
      "当日の馬場が高速寄りか、時計のかかる状態かで差し届く範囲を調整する",
    ],
    updateStages: [
      {
        label: "7日前",
        timing: "登録馬・前走内容の整理",
        body: "出走予定馬の前走、距離経験、東京コース経験を確認し、人気になりそうな馬と条件替わりで評価を上げたい馬を分けます。",
      },
      {
        label: "枠順確定後",
        timing: "枠順・展開の確認",
        body: "内で脚をためたい馬、外から長く脚を使いたい馬、先行して粘りたい馬を分け、東京芝2400mの進路取りと照らします。",
      },
      {
        label: "レース後",
        timing: "回顧・次走メモ",
        body: "着順だけでなく、通ったコース、直線での進路、前半の位置取りを残し、菊花賞や秋の中距離路線で再評価する材料にします。",
      },
    ],
    relatedLinks: [
      { label: "東京芝2400mデータ", href: "/courses/tokyo/turf-2400m" },
      { label: "距離適性の見方", href: "/articles/2025-10-26-distance-suitability-data" },
      { label: "今日のAI予想", href: "/races/today" },
    ],
    xPostThemes: [
      "東京芝2400mで評価を上げたい枠順と脚質",
      "皐月賞組と別路線組を同じ物差しで見ない理由",
      "枠順確定後に確認したい日本ダービーの進路取り",
    ],
  },
  {
    slug: "2026-yasuda-kinen",
    name: "安田記念",
    grade: "G1",
    date: "2026-06-07",
    venue: "東京",
    course: "芝1600m",
    qualification: "3歳以上",
    summary:
      "東京芝1600mで行われる春のマイルG1。前半の流れ、直線の進路、速い上がりへの対応、海外・短距離・中距離路線から来る馬の適性差を整理します。",
    focusPoints: [
      "東京芝1600mは直線での加速力だけでなく、前半の追走力も必要になる",
      "外差しが届く馬場か、内で脚をためた馬が残る馬場かを当日まで確認する",
      "前走G1組とその他ローテでは相手関係が異なるため、着順よりレースレベルを見る",
      "距離短縮馬は追走、距離延長馬は末脚の持続を確認する",
    ],
    updateStages: [
      {
        label: "7日前",
        timing: "ローテと相手関係の整理",
        body: "前走G1組、マイル重賞組、短距離路線組を分け、東京マイルで評価を上げる材料を探します。",
      },
      {
        label: "枠順確定後",
        timing: "内外と脚質の確認",
        body: "逃げ・先行馬の並び、差し馬の進路、馬場の内外差を合わせて、直線で詰まりにくい馬を確認します。",
      },
      {
        label: "レース後",
        timing: "マイル路線の再評価",
        body: "前半の位置取り、上がり、直線の進路を残し、秋のマイル路線で再評価する候補を分けます。",
      },
    ],
    relatedLinks: [
      { label: "東京芝1600m分析記事", href: "/articles/2025-11-03-tokyo-turf-1600m-autumn-analysis" },
      { label: "ペース分析ガイド", href: "/articles/2025-11-10-pace-analysis-guide" },
      { label: "今日のAI予想", href: "/races/today" },
    ],
    xPostThemes: [
      "安田記念で前走G1組をどう扱うか",
      "東京芝1600mの内外差を当日に見る順番",
      "距離短縮馬と距離延長馬の評価ポイント",
    ],
  },
  {
    slug: "2026-takarazuka-kinen",
    name: "宝塚記念",
    grade: "G1",
    date: "2026-06-14",
    venue: "阪神",
    course: "芝2200m",
    qualification: "3歳以上",
    summary:
      "春の中距離路線を締めるG1。阪神芝2200mは持続力、コーナーでの機動力、馬場悪化への対応が問われやすく、人気順だけで判断しにくい条件です。",
    focusPoints: [
      "阪神内回りは直線だけで差し切るより、コーナーで動けるかが重要になる",
      "梅雨時期の馬場状態を前提に、良馬場専用の末脚タイプを過信しない",
      "天皇賞春組、大阪杯組、海外帰りで疲労や距離適性の見方を分ける",
      "上位人気馬でも位置取りが後ろすぎる場合は取りこぼし条件として見る",
    ],
    updateStages: [
      {
        label: "7日前",
        timing: "路線別の比較",
        body: "大阪杯、天皇賞春、海外帰り、マイル寄りの馬を分け、阪神芝2200mで評価できる材料を確認します。",
      },
      {
        label: "枠順確定後",
        timing: "機動力と馬場の確認",
        body: "内で立ち回る馬、外から早めに動く馬、後方で脚をためる馬を分け、馬場状態と合わせて評価します。",
      },
      {
        label: "レース後",
        timing: "秋への接続",
        body: "消耗戦だったか瞬発力戦だったかを残し、秋の天皇賞、ジャパンカップ、有馬記念で評価を引き継ぐか判断します。",
      },
    ],
    relatedLinks: [
      { label: "馬場状態の見方", href: "/keiba-data/track-condition" },
      { label: "距離適性の見方", href: "/articles/2025-10-26-distance-suitability-data" },
      { label: "今日のAI予想", href: "/races/today" },
    ],
    xPostThemes: [
      "宝塚記念で馬場状態を先に見る理由",
      "阪神芝2200mで評価を上げたい脚質",
      "大阪杯組と天皇賞春組の扱い方",
    ],
  },
];

export function getGradeRaceProfile(slug: string): GradeRaceProfile | undefined {
  return gradeRaceProfiles.find((profile) => profile.slug === slug);
}
