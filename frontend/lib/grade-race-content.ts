import { normalizeGradeRaceSlug } from "./grade-race-hubs";

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
    slug: "nihon-derby",
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
      { label: "日本ダービーデータ分析", href: "/articles/2025-10-30-japan-cup-tokyo-turf-2400m-analysis" },
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
    slug: "yasuda-kinen",
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
    slug: "takarazuka-kinen",
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
      { label: "距離適性の見方", href: "/articles/2025-10-26-distance-suitability-data" },
      { label: "今日のAI予想", href: "/races/today" },
    ],
    xPostThemes: [
      "宝塚記念で馬場状態を先に見る理由",
      "阪神芝2200mで評価を上げたい脚質",
      "大阪杯組と天皇賞春組の扱い方",
    ],
  },
  {
    slug: "sprinters-stakes",
    name: "スプリンターズステークス",
    grade: "G1",
    date: "2026-10-04",
    venue: "中山",
    course: "芝1200m",
    qualification: "3歳以上",
    summary:
      "秋の短距離王決定戦。中山芝1200mはスタート、枠順、馬場の内外差、先行争いの厳しさで結果が大きく動きます。",
    focusPoints: [
      "逃げ・先行馬の数を確認し、前半が速くなりすぎるかを見る",
      "中山の坂で最後まで脚を残せる馬を重視する",
      "開催後半の馬場で内前が残るか、外差しが届くかを当日確認する",
      "高松宮記念や夏の短距離重賞組を、馬場とペースで分けて見る",
    ],
    updateStages: [
      {
        label: "7日前",
        timing: "短距離路線の整理",
        body: "春の短距離G1組、夏重賞組、上がり馬を分け、前走のペースと位置取りを確認します。",
      },
      {
        label: "枠順確定後",
        timing: "内外と先行争いの確認",
        body: "逃げ馬の並び、内で詰まりそうな人気馬、外から先行できる馬を分けます。",
      },
      {
        label: "レース後",
        timing: "短距離路線の再評価",
        body: "前半の速さ、通った進路、坂での止まり方を残し、香港や来春の高松宮記念へつなげます。",
      },
    ],
    relatedLinks: [
      { label: "中山芝1200m分析記事", href: "/articles/2025-10-04-nakayama-dirt-1200m-data-analysis" },
      { label: "短距離レースの見方", href: "/articles/2025-10-26-distance-suitability-data" },
      { label: "今日のAI予想", href: "/races/today" },
    ],
    xPostThemes: [
      "スプリンターズSで先行争いを先に見る理由",
      "中山芝1200mで内枠をどう扱うか",
      "夏の短距離重賞組を評価する順番",
    ],
  },
  {
    slug: "tenno-sho-autumn",
    name: "天皇賞（秋）",
    grade: "G1",
    date: "2026-11-01",
    venue: "東京",
    course: "芝2000m",
    qualification: "3歳以上",
    summary:
      "東京芝2000mで行われる秋の中距離G1。スタート直後のコーナー、内外の距離ロス、直線での瞬発力を分けて確認します。",
    focusPoints: [
      "東京芝2000mは序盤の位置取りと直線の進路が重要になる",
      "内枠の人気馬は包まれリスク、外枠の実力馬は距離ロスを確認する",
      "毎日王冠組、宝塚記念組、札幌記念組でレース質を分ける",
      "上がり性能だけでなく、前半で脚を使いすぎないかを見る",
    ],
    updateStages: [
      {
        label: "7日前",
        timing: "ローテーション整理",
        body: "前走の距離、ペース、仕上がり段階を分け、東京芝2000mで評価を上げる材料を探します。",
      },
      {
        label: "枠順確定後",
        timing: "1コーナーまでの進路確認",
        body: "内で脚をためる馬、外から無理なく位置を取る馬、後方から直線勝負の馬を分けます。",
      },
      {
        label: "レース後",
        timing: "ジャパンCへの接続",
        body: "直線の進路と上がりの質を残し、東京芝2400mへ延長してよい馬を整理します。",
      },
    ],
    relatedLinks: [
      { label: "天皇賞秋データ分析", href: "/articles/2025-10-27-tennosho-autumn-tokyo-turf-2000m-analysis" },
      { label: "今日のAI予想", href: "/races/today" },
    ],
    xPostThemes: [
      "天皇賞秋で内枠人気馬を見る順番",
      "毎日王冠組と宝塚記念組を分ける理由",
      "東京芝2000mで外枠を嫌いすぎない条件",
    ],
  },
  {
    slug: "japan-cup",
    name: "ジャパンカップ",
    grade: "G1",
    date: "2026-11-29",
    venue: "東京",
    course: "芝2400m",
    qualification: "3歳以上",
    summary:
      "東京芝2400mで行われる国際G1。長い直線、折り合い、スタミナ、海外馬や秋G1組の比較が重要になります。",
    focusPoints: [
      "東京芝2400mは直線の加速と最後まで脚を維持する力を分けて見る",
      "天皇賞秋組、京都大賞典組、海外馬で前走内容を同列に扱わない",
      "内枠でロスなく運べる馬と、外から長く脚を使える馬を分ける",
      "高速馬場か時計のかかる馬場かで評価する血統と脚質を変える",
    ],
    updateStages: [
      {
        label: "7日前",
        timing: "路線別の比較",
        body: "秋G1組、ステップ重賞組、海外馬を分け、東京芝2400mで強調できる要素を整理します。",
      },
      {
        label: "枠順確定後",
        timing: "距離ロスと折り合い",
        body: "内で脚をためる馬、外から動く馬、逃げ馬のペースを分け、直線入口の位置を想定します。",
      },
      {
        label: "レース後",
        timing: "有馬記念への接続",
        body: "東京向きだった馬と中山でも引き続き評価できる馬を分けて、有馬記念の材料にします。",
      },
    ],
    relatedLinks: [
      { label: "ジャパンカップ分析", href: "/articles/2025-10-30-japan-cup-tokyo-turf-2400m-analysis" },
      { label: "今日のAI予想", href: "/races/today" },
    ],
    xPostThemes: [
      "ジャパンCで海外馬を見る時の注意点",
      "天皇賞秋組を距離延長で評価する順番",
      "東京芝2400mで枠より先に見る材料",
    ],
  },
  {
    slug: "mile-championship",
    name: "マイルチャンピオンシップ",
    grade: "G1",
    date: "2026-11-22",
    venue: "京都",
    course: "芝1600m",
    qualification: "3歳以上",
    summary:
      "秋のマイル王決定戦。京都芝1600mは折り合い、下り坂での加速、直線での進路取りを確認したい条件です。",
    focusPoints: [
      "京都外回りは下りでスムーズに加速できるかを見る",
      "差し馬は直線だけでなく、4コーナーでの位置取りを確認する",
      "スプリント寄りの馬は追走、2000m寄りの馬は切れ味を分ける",
      "馬場が重い場合は瞬発力型を過信しない",
    ],
    updateStages: [
      {
        label: "7日前",
        timing: "マイル路線の整理",
        body: "富士S、スワンS、安田記念組を分け、京都外回りで評価できる材料を確認します。",
      },
      {
        label: "枠順確定後",
        timing: "進路と脚質",
        body: "内で脚をためる馬、外から差す馬、先行して粘る馬を分け、馬場の内外差と合わせます。",
      },
      {
        label: "レース後",
        timing: "香港マイルへの接続",
        body: "前半の追走、直線の進路、上がりの質を残し、次走で再評価する馬を分けます。",
      },
    ],
    relatedLinks: [
      { label: "マイルCS分析", href: "/articles/2025-10-28-mile-championship-kyoto-turf-1600m-analysis" },
      { label: "今日のAI予想", href: "/races/today" },
    ],
    xPostThemes: [
      "マイルCSで距離短縮馬を見る順番",
      "京都外回りの下りで評価したい脚質",
      "富士S組とスワンS組を分ける理由",
    ],
  },
  {
    slug: "arima-kinen",
    name: "有馬記念",
    grade: "G1",
    date: "2026-12-27",
    venue: "中山",
    course: "芝2500m",
    qualification: "3歳以上",
    summary:
      "一年を締めくくる中山芝2500mのG1。小回り、コーナー6回、スタミナ、折り合い、秋G1からの疲労を分けて確認します。",
    focusPoints: [
      "中山芝2500mは長距離適性だけでなく小回りで動けるかを見る",
      "秋に激走した馬は疲労と馬体重を確認する",
      "内で脚をためる馬と早めに動ける馬を分ける",
      "東京向きの瞬発力型は人気でも評価を調整する",
    ],
    updateStages: [
      {
        label: "7日前",
        timing: "秋G1組の疲労確認",
        body: "天皇賞秋、ジャパンC、菊花賞、エリザベス女王杯組を分け、前走の負荷を確認します。",
      },
      {
        label: "枠順確定後",
        timing: "小回りと進路",
        body: "内でロスなく運ぶ馬、外から早めに動く馬、後方で仕掛け遅れそうな馬を分けます。",
      },
      {
        label: "レース後",
        timing: "年度末の回顧",
        body: "馬場、ペース、通ったコースを残し、翌年の中距離路線で評価を引き継ぐ馬を整理します。",
      },
    ],
    relatedLinks: [
      { label: "有馬記念データ分析", href: "/articles/2025-10-31-arima-kinen-nakayama-turf-2500m-analysis" },
      { label: "今日のAI予想", href: "/races/today" },
    ],
    xPostThemes: [
      "有馬記念で東京向きの馬をどう扱うか",
      "中山芝2500mで内枠を評価する条件",
      "秋G1組の疲労を馬体重で見る順番",
    ],
  },
];

export function getGradeRaceProfile(slug: string): GradeRaceProfile | undefined {
  const canonicalSlug = normalizeGradeRaceSlug(slug);
  return gradeRaceProfiles.find((profile) => profile.slug === canonicalSlug);
}
