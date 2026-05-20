export type LinkItem = {
  label: string;
  href: string;
};

export type JockeyProfile = {
  slug: string;
  name: string;
  lead: string;
  searchTitle: string;
  metaDescription: string;
  summary: string;
  strengths: string[];
  checkpoints: string[];
  relatedArticles: LinkItem[];
  courseLinks: LinkItem[];
};

export type CourseProfile = {
  venue: string;
  venueName: string;
  course: string;
  courseName: string;
  title: string;
  metaDescription: string;
  lead: string;
  stats: Array<{ label: string; value: string; note: string }>;
  checkpoints: string[];
  caution: string;
  relatedArticles: LinkItem[];
};

export const dataHubLinks: Array<LinkItem & { description: string }> = [
  {
    label: "馬場状態の見方",
    href: "/keiba-data/track-condition",
    description: "良・稍重・重・不良で変わる時計、脚質、評価の順番を整理します。",
  },
  {
    label: "馬体重増減の見方",
    href: "/keiba-data/horse-weight",
    description: "増減幅、成長分、休み明けを分けて直前評価に使うための基準です。",
  },
  {
    label: "競馬データ分析サイトの選び方",
    href: "/keiba-data/site-selection",
    description: "無料データ、指数、検証公開、地方対応など比較時に見る項目です。",
  },
  {
    label: "AI偏差値の検証",
    href: "/results/accuracy",
    description: "UMA-FREEの予測を、的中だけでなく条件別に見直すためのページです。",
  },
];

export const jockeyProfiles: JockeyProfile[] = [
  {
    slug: "yutaka-take",
    name: "武豊",
    searchTitle: "武豊の得意コースと買い時",
    metaDescription:
      "武豊騎手の得意コースを、芝中距離、京都、東京、差し脚質との相性から整理。人気時に信頼する条件と評価を下げる場面をまとめます。",
    lead:
      "武豊騎手は、コース取りと仕掛けのタイミングでロスを抑える騎乗が目立ちます。単純な勝率だけではなく、どの条件で能力を引き出しやすいかを見ると判断しやすくなります。",
    summary:
      "先に見るのは、京都・東京の芝中距離、折り合いが問われるレース、直線で進路を作れる頭数です。内枠で包まれるリスクがある短距離戦では、人気との釣り合いを確認します。",
    strengths: ["京都芝の中距離", "東京芝の差し・追込", "少頭数から中頭数の位置取り", "経験馬の折り合い重視のレース"],
    checkpoints: [
      "前走で折り合いを欠いた馬は、距離短縮より騎手替わりの効果を先に確認する。",
      "内枠で人気を集める短距離馬は、包まれるリスクを予想表の展開欄で確認する。",
      "重賞では枠順と脚質が噛み合った時だけ、頭固定まで評価を上げる。",
    ],
    relatedArticles: [
      { label: "武豊データ分析", href: "/articles/2025-10-07-yutaka-take-data-analysis" },
      { label: "東京芝2400mデータ分析", href: "/articles/2025-10-05-tokyo-turf-2400m-data-analysis" },
    ],
    courseLinks: [
      { label: "東京芝2400m", href: "/courses/tokyo/turf-2400m" },
      { label: "京都芝1800m", href: "/courses/kyoto/turf-1800m" },
    ],
  },
  {
    slug: "christophe-lemaire",
    name: "クリストフ・ルメール",
    searchTitle: "ルメールの得意コースと買い時",
    metaDescription:
      "ルメール騎手の得意コースを東京・中距離・上位人気時の安定感から整理。人気馬を信頼する条件と過剰人気を疑う場面を解説します。",
    lead:
      "ルメール騎手は、折り合いと直線での加速を重視するレースで評価しやすい騎手です。上位人気時の安定感が目立つ一方、短距離の外差し待ちでは過剰人気になる場面もあります。",
    summary:
      "東京芝の中距離、京都外回り、能力差が出やすい少頭数では評価を上げます。逃げ馬が多い混戦短距離では、展開が向くかを先に確認します。",
    strengths: ["東京芝1600mから2400m", "京都芝外回り", "上位人気馬の折り合い", "瞬発力勝負の直線"],
    checkpoints: [
      "1番人気でも、逃げ先行が多すぎる短距離では差し遅れを考える。",
      "乗り替わりで距離延長になる場合は、折り合い改善の余地を見る。",
      "東京芝では枠よりも直線で進路を取れる脚質かを重視する。",
    ],
    relatedArticles: [
      { label: "ルメールデータ分析", href: "/articles/2025-10-06-christophe-lemaire-data-analysis" },
      { label: "東京ダート1600m分析", href: "/articles/2025-10-17-tokyo-dirt-1600m-february-stakes" },
    ],
    courseLinks: [
      { label: "東京芝2000m", href: "/courses/tokyo/turf-2000m" },
      { label: "東京ダート1600m", href: "/courses/tokyo/dirt-1600m" },
    ],
  },
  {
    slug: "yuga-kawada",
    name: "川田将雅",
    searchTitle: "川田将雅の得意コースと買い時",
    metaDescription:
      "川田将雅騎手の得意コースを先行力、人気馬の安定感、短距離から中距離の位置取りで整理。買い時と見送り条件をまとめます。",
    lead:
      "川田将雅騎手は、序盤から好位を取れる馬との相性が高く、人気馬の能力を崩さず走らせる場面で評価しやすい騎手です。",
    summary:
      "先行力のある馬、内外どちらでも位置を取れる馬、ダートや短距離でスピードを活かせる条件では軸候補にしやすくなります。",
    strengths: ["短距離から中距離の先行馬", "ダートの好位差し", "人気馬の安定騎乗", "スタート後の位置取り"],
    checkpoints: [
      "差し一辺倒の馬では、人気ほど上げすぎない。",
      "外枠先行が有利なコースでは、枠順発表後に評価を上げる余地がある。",
      "馬体重が大きく減っている人気馬は、騎手評価だけで補正しない。",
    ],
    relatedArticles: [
      { label: "川田将雅データ分析", href: "/articles/2025-10-13-yuga-kawada-jockey-analysis" },
      { label: "馬体重増減の見方", href: "/keiba-data/horse-weight" },
    ],
    courseLinks: [
      { label: "中山ダート1200m", href: "/courses/nakayama/dirt-1200m" },
      { label: "阪神ダート1400m", href: "/courses/hanshin/dirt-1400m" },
    ],
  },
  {
    slug: "takeshi-yokoyama",
    name: "横山武史",
    searchTitle: "横山武史の得意コースと買い時",
    metaDescription:
      "横山武史騎手の得意条件を中山、札幌、先行馬、展開判断から整理。人気時の信頼条件と評価を下げる場面を解説します。",
    lead:
      "横山武史騎手は、早めに形を作れる馬や小回りで機動力を活かす馬で評価しやすい騎手です。コース形態と脚質が噛み合うかを先に見ます。",
    summary:
      "中山・札幌の芝中距離、ダートの先行馬、コーナーで押し上げられる馬は確認優先。直線一気待ちの馬では過信しません。",
    strengths: ["中山の小回り", "札幌芝2000m", "好位から早めに動く競馬", "スタミナ型の先行馬"],
    checkpoints: [
      "直線だけの末脚勝負になりそうな東京芝では評価を一段抑える。",
      "外枠から先行できる脚があるかを出馬表で確認する。",
      "馬場が重い日は、早めに動く形が残るかを馬場状態ページで確認する。",
    ],
    relatedArticles: [
      { label: "横山武史データ分析", href: "/articles/2025-11-04-takeshi-yokoyama-jockey-analysis" },
      { label: "馬場状態の見方", href: "/keiba-data/track-condition" },
    ],
    courseLinks: [
      { label: "中山芝2000m", href: "/courses/nakayama/turf-2000m" },
      { label: "札幌芝2000m", href: "/courses/sapporo/turf-2000m" },
    ],
  },
];

export const courseProfiles: CourseProfile[] = [
  {
    venue: "nakayama",
    venueName: "中山",
    course: "dirt-1200m",
    courseName: "ダート1200m",
    title: "中山ダート1200mの枠順・脚質データ",
    metaDescription:
      "中山ダート1200mの枠順、芝スタート、逃げ先行有利、外枠評価を整理。8枠や先行馬をどう扱うかを無料データで確認できます。",
    lead:
      "中山ダート1200mは芝スタートとコーナー1つの構造により、最初の位置取りが結果に直結しやすいコースです。",
    stats: [
      { label: "外枠", value: "8枠複勝率28.6%", note: "芝スタートで加速しやすく、序盤の位置取りを取りやすい。" },
      { label: "内枠", value: "2枠複勝率21.0%", note: "砂を被るリスクがあり、人気馬でも取りこぼしを考える。" },
      { label: "脚質", value: "逃げ馬勝率10.2%", note: "前半で位置を取れる馬を先に確認する。" },
    ],
    checkpoints: [
      "外枠の逃げ・先行馬は、馬体重や騎手の得意条件と合わせて評価する。",
      "内枠の差し馬は、展開待ちになりやすいため軸より相手候補に置く。",
      "雨で時計がかかる日は、先行力だけでなくパワー型の好走歴を確認する。",
    ],
    caution: "外枠有利だけで買うのではなく、スタート力と脚質が揃っているかを見ます。",
    relatedArticles: [
      { label: "中山ダート1200mデータ分析", href: "/articles/2025-10-04-nakayama-dirt-1200m-data-analysis" },
      { label: "馬場状態の見方", href: "/keiba-data/track-condition" },
    ],
  },
  {
    venue: "tokyo",
    venueName: "東京",
    course: "turf-2000m",
    courseName: "芝2000m",
    title: "東京芝2000mの枠順・脚質データ",
    metaDescription:
      "東京芝2000mの内枠、差し馬、毎日王冠組の見方を整理。天皇賞秋など重賞前の確認にも使える無料データページです。",
    lead:
      "東京芝2000mはスタート直後にコーナーを迎えるため、枠順のロスと直線での瞬発力を同時に見たいコースです。",
    stats: [
      { label: "枠順", value: "1〜2枠複勝率31.2%", note: "序盤の距離ロスを抑えやすく、内枠の評価を上げやすい。" },
      { label: "脚質", value: "差し馬勝率40%", note: "長い直線で末脚の質が問われる。" },
      { label: "ローテ", value: "毎日王冠組複勝率38.5%", note: "同じ東京コースの経験を評価材料にしやすい。" },
    ],
    checkpoints: [
      "内枠でも包まれる馬は、騎手と脚質の組み合わせを確認する。",
      "外枠の実力馬は、序盤で脚を使いすぎない展開なら軽視しすぎない。",
      "重賞では前走ローテと馬体重の増減を合わせて見る。",
    ],
    caution: "内枠有利が出やすい一方、上位馬の能力差が大きいレースでは枠だけで評価を落としすぎないようにします。",
    relatedArticles: [
      { label: "天皇賞秋データ分析", href: "/articles/2025-10-27-tennosho-autumn-tokyo-turf-2000m-analysis" },
      { label: "横山武史データ分析", href: "/articles/2025-11-04-takeshi-yokoyama-jockey-analysis" },
    ],
  },
  {
    venue: "tokyo",
    venueName: "東京",
    course: "turf-2400m",
    courseName: "芝2400m",
    title: "東京芝2400mの枠順・脚質データ",
    metaDescription:
      "東京芝2400mの長い直線、差し脚質、スタミナ適性を整理。日本ダービーやジャパンカップ前に確認したい無料データページです。",
    lead:
      "東京芝2400mは、直線の長さと坂で能力差が出やすい王道条件です。枠順よりも折り合い、持続力、直線での加速を重視します。",
    stats: [
      { label: "直線", value: "約525m", note: "瞬発力だけでなく、最後まで脚を維持する力が必要。" },
      { label: "距離", value: "2400m", note: "折り合いを欠く馬は人気でも評価を下げる。" },
      { label: "脚質", value: "好位差しを重視", note: "後方一気よりも中団で脚を溜められる馬を確認する。" },
    ],
    checkpoints: [
      "前走で掛かった馬は距離延長で評価を上げすぎない。",
      "東京実績がある騎手と、直線で進路を作れる脚質を合わせて見る。",
      "重馬場では上がりだけでなくスタミナ型の血統を確認する。",
    ],
    caution: "直線が長いから差し有利と決めつけず、道中の位置取りとペースを合わせて判断します。",
    relatedArticles: [
      { label: "東京芝2400mデータ分析", href: "/articles/2025-10-05-tokyo-turf-2400m-data-analysis" },
      { label: "ジャパンカップ分析", href: "/articles/2025-10-30-japan-cup-tokyo-turf-2400m-analysis" },
    ],
  },
  {
    venue: "kyoto",
    venueName: "京都",
    course: "turf-1800m",
    courseName: "芝1800m",
    title: "京都芝1800mの枠順・脚質データ",
    metaDescription:
      "京都芝1800mの外回り、直線平坦、瞬発力勝負の見方を整理。差し馬と先行馬の評価順を無料データで確認できます。",
    lead:
      "京都芝1800mは外回りで直線が平坦なため、折り合いと瞬発力の両方を見たいコースです。",
    stats: [
      { label: "コース", value: "外回り", note: "3コーナーから下りを使って加速しやすい。" },
      { label: "脚質", value: "好位差し", note: "直線だけでなく、下りでスムーズに動ける馬を評価する。" },
      { label: "距離", value: "1800m", note: "マイル寄りのスピードと中距離の折り合いが両方必要。" },
    ],
    checkpoints: [
      "外回りで長く脚を使える馬を先に見る。",
      "逃げ馬は単騎で運べるかを確認する。",
      "直線平坦で切れ味勝負になる時は、上がり実績を重視する。",
    ],
    caution: "京都実績のある馬でも、馬場が重くなると瞬発力型は評価を下げる場合があります。",
    relatedArticles: [
      { label: "京都芝1800m完全ガイド", href: "/articles/2025-10-15-kyoto-turf-1800m-complete-guide" },
      { label: "馬場状態の見方", href: "/keiba-data/track-condition" },
    ],
  },
  {
    venue: "niigata",
    venueName: "新潟",
    course: "turf-1000m",
    courseName: "芝1000m",
    title: "新潟芝1000m直線の枠順・脚質データ",
    metaDescription:
      "新潟芝1000m直線の外枠有利、スタート力、スピード持続力を整理。直線競馬で見るべき条件を無料データで確認できます。",
    lead:
      "新潟芝1000mは国内でも特殊な直線コースです。コーナーがないぶん、枠順とスタート直後のスピードが大きく結果に影響します。",
    stats: [
      { label: "形態", value: "直線1000m", note: "コーナーによる位置取りの修正ができない。" },
      { label: "枠順", value: "外枠を確認", note: "馬場の使われ方により外側が伸びやすい日がある。" },
      { label: "脚質", value: "先行力", note: "一瞬の加速よりスピードを維持できる馬を重視する。" },
    ],
    checkpoints: [
      "外枠でもスタートが遅い馬は過信しない。",
      "開催後半は馬場の伸びる場所を当日傾向で確認する。",
      "リピーターが走りやすい条件なので、同コース実績を優先する。",
    ],
    caution: "新潟芝1000mは特殊条件のため、他場の短距離成績をそのまま当てはめないようにします。",
    relatedArticles: [
      { label: "新潟芝1000m直線分析", href: "/articles/2025-10-14-niigata-turf-1000m-straight-analysis" },
      { label: "新潟2026 AI分析", href: "/articles/2026-05-14-niigata2026-ai" },
    ],
  },
  {
    venue: "hanshin",
    venueName: "阪神",
    course: "dirt-1400m",
    courseName: "ダート1400m",
    title: "阪神ダート1400mの枠順・脚質データ",
    metaDescription:
      "阪神ダート1400mの先行力、坂、距離短縮馬の見方を整理。騎手データと合わせて確認したい無料データページです。",
    lead:
      "阪神ダート1400mは短距離のスピードと直線坂への対応を同時に問われます。先行力だけでなく、最後に止まらないかを確認します。",
    stats: [
      { label: "距離", value: "1400m", note: "1200mより折り合いと持続力が必要。" },
      { label: "脚質", value: "先行・好位差し", note: "前に行くだけでなく、坂で踏ん張れる馬を評価する。" },
      { label: "騎手", value: "位置取り重視", note: "序盤で無理なく好位を取れる騎手を確認する。" },
    ],
    checkpoints: [
      "短距離からの延長馬は最後の坂で止まらないかを見る。",
      "外枠先行馬はスムーズに運べるなら評価しやすい。",
      "馬体重が大幅増の馬は、坂での持続力に注意する。",
    ],
    caution: "ダート短距離の実績だけでなく、1400mへの距離適性を分けて確認します。",
    relatedArticles: [
      { label: "阪神ダート1400m騎手データ", href: "/articles/2026-04-12-hanshindirt1400m-jockey-data" },
      { label: "川田将雅の得意コース", href: "/jockeys/yuga-kawada" },
    ],
  },
  {
    venue: "sapporo",
    venueName: "札幌",
    course: "turf-2000m",
    courseName: "芝2000m",
    title: "札幌芝2000mの枠順・脚質データ",
    metaDescription:
      "札幌芝2000mの小回り、先行力、洋芝適性を整理。札幌記念などで確認したい無料データページです。",
    lead:
      "札幌芝2000mは小回りと洋芝が特徴です。直線の長さよりも、早めに動ける機動力と馬場への適性を確認します。",
    stats: [
      { label: "馬場", value: "洋芝", note: "軽いスピードよりパワーと持続力を重視する。" },
      { label: "形態", value: "小回り", note: "外を回しすぎるとロスが大きい。" },
      { label: "脚質", value: "先行・まくり", note: "早めに位置を上げられる馬を確認する。" },
    ],
    checkpoints: [
      "札幌・函館の洋芝実績を優先して確認する。",
      "東京向きの瞬発力型は人気でも割り引く場面がある。",
      "馬場が重い日は、馬体重とパワー型血統を合わせて見る。",
    ],
    caution: "同じ芝2000mでも東京や中山とは必要な能力が変わります。",
    relatedArticles: [
      { label: "札幌芝2000mデータ分析", href: "/articles/2025-10-18-sapporo-turf-2000m-data-analysis" },
      { label: "馬場状態の見方", href: "/keiba-data/track-condition" },
    ],
  },
  {
    venue: "tokyo",
    venueName: "東京",
    course: "dirt-1600m",
    courseName: "ダート1600m",
    title: "東京ダート1600mの枠順・脚質データ",
    metaDescription:
      "東京ダート1600mの芝スタート、外枠、差し脚質、フェブラリーステークスの見方を整理した無料データページです。",
    lead:
      "東京ダート1600mは芝スタートと長い直線が特徴です。序盤の加速と直線での持続力を分けて確認します。",
    stats: [
      { label: "スタート", value: "芝スタート", note: "外枠の加速力を確認する。" },
      { label: "直線", value: "長い直線", note: "先行だけで押し切れない展開も多い。" },
      { label: "脚質", value: "好位差し", note: "前を見ながら脚を使える馬を評価する。" },
    ],
    checkpoints: [
      "外枠でも砂を被らず運べるかを確認する。",
      "逃げ馬が多い時は差し馬の浮上を考える。",
      "フェブラリーSなど重賞では、距離短縮馬のスピードも見る。",
    ],
    caution: "芝スタート適性とダートでの持続力を分けて評価します。",
    relatedArticles: [
      { label: "東京ダート1600m分析", href: "/articles/2025-10-17-tokyo-dirt-1600m-february-stakes" },
      { label: "ルメールの得意コース", href: "/jockeys/christophe-lemaire" },
    ],
  },
];

export function getJockeyProfile(slug: string) {
  return jockeyProfiles.find((profile) => profile.slug === slug);
}

export function getCourseProfile(venue: string, course: string) {
  return courseProfiles.find((profile) => profile.venue === venue && profile.course === course);
}
