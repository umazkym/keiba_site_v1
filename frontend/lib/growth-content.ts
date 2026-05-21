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
  {
    slug: "keita-tosaki",
    name: "戸崎圭太",
    searchTitle: "戸崎圭太の得意コースと買い時",
    metaDescription:
      "戸崎圭太騎手の得意条件を東京、中山、ダート中距離、好位差しから整理。人気馬を信頼する場面と相手候補に抑える場面をまとめます。",
    lead:
      "戸崎圭太騎手は、好位で流れに乗れる馬や、直線でしっかり進路を作れる馬で評価しやすい騎手です。",
    summary:
      "東京・中山の中距離、ダートの好位差し、人気馬で無理に動かないレースでは確認優先。差し一辺倒で展開待ちになる馬は評価を上げすぎません。",
    strengths: ["東京芝中距離", "中山ダート1800m", "好位差し", "上位人気馬の安定騎乗"],
    checkpoints: [
      "外を回される差し馬は、直線だけで届く展開かを確認する。",
      "短距離の内枠で包まれそうな馬は、人気でも相手までに抑える。",
      "乗り替わりで先行できる馬は、位置取り改善を評価する。",
    ],
    relatedArticles: [
      { label: "戸崎圭太データ分析", href: "/articles/2025-10-20-tosakikeita-jockey-analysis" },
      { label: "東京芝2000mのコースデータ", href: "/courses/tokyo/turf-2000m" },
    ],
    courseLinks: [
      { label: "東京芝2000m", href: "/courses/tokyo/turf-2000m" },
      { label: "中山ダート1800m", href: "/courses/nakayama/dirt-1800m" },
    ],
  },
  {
    slug: "rusei-sakai",
    name: "坂井瑠星",
    searchTitle: "坂井瑠星の得意コースと買い時",
    metaDescription:
      "坂井瑠星騎手の得意条件を先行力、ダート短距離、積極策から整理。買い時と過剰人気を疑う条件を解説します。",
    lead:
      "坂井瑠星騎手は、序盤から主張できる馬や、ペースを落とさず運べる馬で持ち味が出やすい騎手です。",
    summary:
      "逃げ・先行馬、ダート短距離、内外どちらでも位置を取れる馬は評価しやすい一方、差し待ちの馬では展開依存を強めに見ます。",
    strengths: ["ダート短距離", "逃げ・先行馬", "中京ダート", "海外帰りや遠征でも崩れにくい積極策"],
    checkpoints: [
      "同型の逃げ馬が多い時は、前半で脚を使いすぎないかを見る。",
      "差し馬への騎乗では、直線の進路より道中の位置取りを確認する。",
      "人気薄の先行馬は、馬場が前残りかどうかを合わせて判断する。",
    ],
    relatedArticles: [
      { label: "坂井瑠星データ分析", href: "/articles/2025-11-05-rusei-sakai-jockey-analysis" },
      { label: "阪神ダート1400m", href: "/courses/hanshin/dirt-1400m" },
    ],
    courseLinks: [
      { label: "阪神ダート1400m", href: "/courses/hanshin/dirt-1400m" },
      { label: "中京ダート1200m", href: "/courses/chukyo/dirt-1200m" },
    ],
  },
  {
    slug: "hiroaki-matsuyama",
    name: "松山弘平",
    searchTitle: "松山弘平の得意コースと買い時",
    metaDescription:
      "松山弘平騎手の得意条件を関西圏、先行馬、ダート、芝中距離から整理。軸にしやすい条件と割引条件をまとめます。",
    lead:
      "松山弘平騎手は、早めに位置を取って粘り込む形や、ダートでスピードを持続させる形で評価しやすい騎手です。",
    summary:
      "阪神・京都・中京の先行馬、ダート1400mから1800m、芝中距離の好位差しでは確認優先。後方一気だけに頼る馬は展開を見ます。",
    strengths: ["関西圏の先行馬", "阪神ダート1400m", "中京芝2000m", "好位から長く脚を使う競馬"],
    checkpoints: [
      "逃げ馬が多いレースでは、無理に競らない形を取れるかを見る。",
      "外枠の先行馬は、1コーナーまでの距離ロスを確認する。",
      "重賞では相手関係が上がっても同じ位置を取れるかを重視する。",
    ],
    relatedArticles: [
      { label: "松山弘平データ分析", href: "/articles/2025-11-06-hiroaki-matsuyama-jockey-analysis" },
      { label: "中京芝2000mデータ分析", href: "/articles/2025-11-01-chukyo-turf-2000m-data-analysis" },
    ],
    courseLinks: [
      { label: "中京芝2000m", href: "/courses/chukyo/turf-2000m" },
      { label: "阪神ダート1400m", href: "/courses/hanshin/dirt-1400m" },
    ],
  },
  {
    slug: "kosei-miura",
    name: "三浦皇成",
    searchTitle: "三浦皇成の得意コースと買い時",
    metaDescription:
      "三浦皇成騎手の得意条件を中山、東京、ダート短距離、人気薄の好走パターンから整理します。",
    lead:
      "三浦皇成騎手は、関東圏の平場やダート短距離で、人気ほど評価されていない馬を拾う時に確認したい騎手です。",
    summary:
      "中山ダート1200m、東京ダート1600m、前に行ける馬、外枠からスムーズに運べる馬では相手候補に残しやすくなります。",
    strengths: ["中山ダート1200m", "東京ダート1600m", "関東平場", "人気薄の好位差し"],
    checkpoints: [
      "上位人気の差し馬では、展開待ちになりすぎないかを見る。",
      "短距離はスタートと枠順を先に確認する。",
      "人気薄なら、馬場と脚質が噛み合う時だけ拾う。",
    ],
    relatedArticles: [
      { label: "三浦皇成データ分析", href: "/articles/2025-10-08-kosei-miura-data-analysis" },
      { label: "中山ダート1200m", href: "/courses/nakayama/dirt-1200m" },
    ],
    courseLinks: [
      { label: "中山ダート1200m", href: "/courses/nakayama/dirt-1200m" },
      { label: "東京ダート1600m", href: "/courses/tokyo/dirt-1600m" },
    ],
  },
  {
    slug: "akira-sugawara",
    name: "菅原明良",
    searchTitle: "菅原明良の得意コースと買い時",
    metaDescription:
      "菅原明良騎手の得意条件を関東圏、差し馬、ローカル開催、人気とのズレから整理します。",
    lead:
      "菅原明良騎手は、馬のリズムを崩さず運ぶ形で評価しやすく、人気が控えめな差し馬でも注意したい騎手です。",
    summary:
      "東京・中山の差し馬、福島や新潟のローカル開催、馬場が外差しに寄る日は確認優先。内で詰まりやすい馬は割り引きます。",
    strengths: ["東京芝マイル", "福島芝1800m", "新潟外回り", "人気薄の差し馬"],
    checkpoints: [
      "内枠の差し馬は進路を取れるかを見る。",
      "直線勝負になりすぎる馬は、ペースが流れるかを確認する。",
      "ローカルでは馬場の内外差を当日傾向から見る。",
    ],
    relatedArticles: [
      { label: "福島芝1800m完全ガイド", href: "/articles/2025-10-19-fukushima-turf-1800m-complete-guide" },
      { label: "馬場状態の見方", href: "/keiba-data/track-condition" },
    ],
    courseLinks: [
      { label: "福島芝1800m", href: "/courses/fukushima/turf-1800m" },
      { label: "東京芝1600m", href: "/courses/tokyo/turf-1600m" },
    ],
  },
  {
    slug: "mirai-iwata",
    name: "岩田望来",
    searchTitle: "岩田望来の得意コースと買い時",
    metaDescription:
      "岩田望来騎手の得意条件を関西圏、先行馬、芝マイル、ダート中距離から整理。安定感を評価する場面をまとめます。",
    lead:
      "岩田望来騎手は、好位を取れる馬や、直線でしぶとく脚を使う馬で評価しやすい騎手です。",
    summary:
      "京都・阪神の芝マイルから中距離、ダート1800m、人気馬の安定騎乗では確認優先。外を回すだけになる差し馬は展開を見ます。",
    strengths: ["京都芝1600m", "阪神芝1600m", "関西ダート1800m", "好位差し"],
    checkpoints: [
      "人気馬でも後ろからになる場合は、展開待ちを考える。",
      "先行馬では、同型の数と枠順を合わせて確認する。",
      "馬場が重い日は、瞬発力型より持続型を評価する。",
    ],
    relatedArticles: [
      { label: "阪神芝1600m枠順データ", href: "/articles/2026-04-22-hanshinturf1600m-waku-data" },
      { label: "京都芝1800m完全ガイド", href: "/articles/2025-10-15-kyoto-turf-1800m-complete-guide" },
    ],
    courseLinks: [
      { label: "阪神芝1600m", href: "/courses/hanshin/turf-1600m" },
      { label: "京都ダート1800m", href: "/courses/kyoto/dirt-1800m" },
    ],
  },
  {
    slug: "atsuki-nishimura",
    name: "西村淳也",
    searchTitle: "西村淳也の得意コースと買い時",
    metaDescription:
      "西村淳也騎手の得意条件をローカル開催、小倉、中京、先行馬から整理。人気薄で拾う条件をまとめます。",
    lead:
      "西村淳也騎手は、小倉や中京などで先行力を活かす馬と組んだ時に注意したい騎手です。",
    summary:
      "小倉芝1200m、中京芝2000m、前に行ける馬、ローカル開催の人気薄では確認優先。差し一辺倒では馬場傾向を見ます。",
    strengths: ["小倉芝1200m", "中京芝2000m", "ローカル先行馬", "人気薄の粘り込み"],
    checkpoints: [
      "内が荒れている開催後半は、枠順だけで決めない。",
      "短距離ではスタートの安定感を確認する。",
      "重賞で相手が強くなる場合は、平場成績を過信しない。",
    ],
    relatedArticles: [
      { label: "小倉芝1200m分析", href: "/articles/2025-10-17-kokura-turf-1200m-summer-analysis" },
      { label: "中京芝2000mデータ分析", href: "/articles/2025-11-01-chukyo-turf-2000m-data-analysis" },
    ],
    courseLinks: [
      { label: "小倉芝1200m", href: "/courses/kokura/turf-1200m" },
      { label: "中京芝2000m", href: "/courses/chukyo/turf-2000m" },
    ],
  },
  {
    slug: "yuji-tannai",
    name: "丹内祐次",
    searchTitle: "丹内祐次の得意コースと買い時",
    metaDescription:
      "丹内祐次騎手の得意条件を札幌、函館、福島、小回り、先行馬から整理。ローカル開催で確認したい買い時をまとめます。",
    lead:
      "丹内祐次騎手は、ローカル小回りで前に行ける馬や、洋芝でしぶとく脚を使う馬との相性を確認したい騎手です。",
    summary:
      "札幌・函館の芝中距離、福島の小回り、先行力のある馬では相手候補に残しやすくなります。中央場所の瞬発力勝負では評価を抑えます。",
    strengths: ["札幌芝2000m", "函館芝1200m", "福島小回り", "ローカル先行馬"],
    checkpoints: [
      "洋芝実績がない馬は、人気でも馬場適性を確認する。",
      "外枠で距離ロスが大きくなりそうな時は割り引く。",
      "人気薄は馬場と位置取りが合う時だけ拾う。",
    ],
    relatedArticles: [
      { label: "札幌芝2000mデータ分析", href: "/articles/2025-10-18-sapporo-turf-2000m-data-analysis" },
      { label: "福島芝1800m完全ガイド", href: "/articles/2025-10-19-fukushima-turf-1800m-complete-guide" },
    ],
    courseLinks: [
      { label: "札幌芝2000m", href: "/courses/sapporo/turf-2000m" },
      { label: "函館芝1200m", href: "/courses/hakodate/turf-1200m" },
    ],
  },
  {
    slug: "kazuo-yokoyama",
    name: "横山和生",
    searchTitle: "横山和生の得意コースと買い時",
    metaDescription:
      "横山和生騎手の得意条件を逃げ先行、小回り、長距離、馬のリズム重視の騎乗から整理します。",
    lead:
      "横山和生騎手は、馬のリズムを重視して運べるレースで評価しやすく、逃げ・先行馬の粘り込みにも注意したい騎手です。",
    summary:
      "中山芝2500m、札幌芝2000m、逃げ先行馬、距離延長で折り合える馬では確認優先。展開が速くなりすぎる短距離では慎重に見ます。",
    strengths: ["中山芝2500m", "札幌芝2000m", "逃げ・先行馬", "長距離の折り合い"],
    checkpoints: [
      "単騎で行けるか、同型が多いかを先に確認する。",
      "人気馬でも展開が速すぎる場合は取りこぼしを見る。",
      "長距離では前走の折り合いと距離延長の負荷を確認する。",
    ],
    relatedArticles: [
      { label: "有馬記念データ分析", href: "/articles/2025-10-31-arima-kinen-nakayama-turf-2500m-analysis" },
      { label: "札幌芝2000mデータ分析", href: "/articles/2025-10-18-sapporo-turf-2000m-data-analysis" },
    ],
    courseLinks: [
      { label: "中山芝2500m", href: "/courses/nakayama/turf-2500m" },
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
  {
    venue: "tokyo",
    venueName: "東京",
    course: "turf-1600m",
    courseName: "芝1600m",
    title: "東京芝1600mの枠順・脚質データ",
    metaDescription:
      "東京芝1600mの長い直線、マイル適性、差し脚質、安田記念やNHKマイルCで確認したい条件を整理します。",
    lead:
      "東京芝1600mは直線の長さと序盤の追走力が両方問われるマイル条件です。上がりだけでなく、道中で置かれないかを確認します。",
    stats: [
      { label: "直線", value: "長い直線", note: "末脚の質と進路取りが結果に影響しやすい。" },
      { label: "距離", value: "マイル", note: "スピードだけでなく、最後まで脚を使える持続力も必要。" },
      { label: "脚質", value: "好位差し", note: "後方一気より、中団から脚を使える馬を確認する。" },
    ],
    checkpoints: [
      "逃げ馬が多い時は、差し馬の進路と上がり性能を見る。",
      "距離延長馬は折り合い、距離短縮馬は追走力を確認する。",
      "G1では前走レベルと直線での進路取りを重視する。",
    ],
    caution: "東京の長い直線だけで差し有利と決めず、前半の位置取りを合わせて判断します。",
    relatedArticles: [
      { label: "東京芝1600m秋分析", href: "/articles/2025-11-03-tokyo-turf-1600m-autumn-analysis" },
      { label: "ペース分析ガイド", href: "/articles/2025-11-10-pace-analysis-guide" },
    ],
  },
  {
    venue: "nakayama",
    venueName: "中山",
    course: "dirt-1800m",
    courseName: "ダート1800m",
    title: "中山ダート1800mの枠順・脚質データ",
    metaDescription:
      "中山ダート1800mの先行力、コーナー4回、外枠の距離ロス、パワー型の見方を無料データで整理します。",
    lead:
      "中山ダート1800mはコーナー4回で、序盤の位置取りと向正面からの動き方が重要です。",
    stats: [
      { label: "形態", value: "コーナー4回", note: "外を回り続ける馬は距離ロスが大きくなる。" },
      { label: "脚質", value: "先行・好位", note: "早めに位置を取れる馬を優先して確認する。" },
      { label: "適性", value: "パワー型", note: "時計よりも持続力と砂を被る耐性を見る。" },
    ],
    checkpoints: [
      "内枠でも砂を被って嫌がる馬は過信しない。",
      "外枠先行馬は1コーナーまでに無理なく位置を取れるかを見る。",
      "馬場が軽い日はスピード型、重い日はパワー型を確認する。",
    ],
    caution: "前に行けるだけでなく、最後の坂で止まらないかを見ます。",
    relatedArticles: [
      { label: "中山ダート1200mデータ分析", href: "/articles/2025-10-04-nakayama-dirt-1200m-data-analysis" },
      { label: "馬体重増減の見方", href: "/keiba-data/horse-weight" },
    ],
  },
  {
    venue: "nakayama",
    venueName: "中山",
    course: "turf-1200m",
    courseName: "芝1200m",
    title: "中山芝1200mの枠順・脚質データ",
    metaDescription:
      "中山芝1200mのスタート、坂、先行争い、内外の馬場差を整理。スプリンターズS前にも確認したい無料データページです。",
    lead:
      "中山芝1200mは短距離のスピードに加え、最後の坂で踏ん張れるかが問われます。枠順と脚質、馬場の内外差を合わせて見ます。",
    stats: [
      { label: "距離", value: "1200m", note: "スタートと二の脚を優先して確認する。" },
      { label: "直線", value: "坂あり", note: "前半だけでなく最後の踏ん張りも必要。" },
      { label: "脚質", value: "先行・好位", note: "後方一気は展開と馬場の助けが必要。" },
    ],
    checkpoints: [
      "逃げ馬が多い時は差し馬の浮上を考える。",
      "開催後半は内外どちらが伸びるかを当日傾向で確認する。",
      "人気馬でもスタートに不安がある場合は軸にしすぎない。",
    ],
    caution: "短距離でも坂があるため、スピードだけで評価を決めません。",
    relatedArticles: [
      { label: "スプリンターズSページ", href: "/grade-races/2026-sprinters-stakes" },
      { label: "馬場状態の見方", href: "/keiba-data/track-condition" },
    ],
  },
  {
    venue: "chukyo",
    venueName: "中京",
    course: "turf-2000m",
    courseName: "芝2000m",
    title: "中京芝2000mの枠順・脚質データ",
    metaDescription:
      "中京芝2000mの坂、持続力、差し脚質、ロングスパートの見方を整理した無料データページです。",
    lead:
      "中京芝2000mは直線の坂と持続力が問われる条件です。瞬発力だけでなく、長く脚を使えるかを見ます。",
    stats: [
      { label: "直線", value: "坂あり", note: "最後の坂で止まらない持続力を確認する。" },
      { label: "脚質", value: "差し・好位差し", note: "前が速くなると差しが届きやすい。" },
      { label: "距離", value: "2000m", note: "マイル寄りの馬は折り合いを確認する。" },
    ],
    checkpoints: [
      "前走で上がりを使えていても、坂への対応歴を確認する。",
      "先行馬はペースが速くなりすぎないかを見る。",
      "馬場が重い日はパワー型の血統や馬体重を合わせる。",
    ],
    caution: "同じ芝2000mでも東京より持続力と坂への対応を重視します。",
    relatedArticles: [
      { label: "中京芝2000mデータ分析", href: "/articles/2025-11-01-chukyo-turf-2000m-data-analysis" },
      { label: "松山弘平の得意コース", href: "/jockeys/hiroaki-matsuyama" },
    ],
  },
  {
    venue: "chukyo",
    venueName: "中京",
    course: "dirt-1200m",
    courseName: "ダート1200m",
    title: "中京ダート1200mの枠順・脚質データ",
    metaDescription:
      "中京ダート1200mのスタート、坂、先行力、差し馬の届き方を整理。短距離戦の確認材料をまとめます。",
    lead:
      "中京ダート1200mは短距離のスピードに加え、直線坂への対応が必要です。前半だけでなく最後の踏ん張りを確認します。",
    stats: [
      { label: "距離", value: "1200m", note: "スタートと二の脚を最初に見る。" },
      { label: "直線", value: "坂あり", note: "逃げ切りだけでなく好位差しも確認する。" },
      { label: "脚質", value: "先行重視", note: "位置を取れない馬は展開待ちになりやすい。" },
    ],
    checkpoints: [
      "前走で出遅れた馬は軸にしすぎない。",
      "外枠の先行馬は砂を被らず運べるかを見る。",
      "坂で止まりやすいスピード型は相手までに抑える。",
    ],
    caution: "短距離でも直線坂があるため、前半スピードだけで判断しません。",
    relatedArticles: [
      { label: "坂井瑠星の得意コース", href: "/jockeys/rusei-sakai" },
      { label: "馬場状態の見方", href: "/keiba-data/track-condition" },
    ],
  },
  {
    venue: "fukushima",
    venueName: "福島",
    course: "turf-1800m",
    courseName: "芝1800m",
    title: "福島芝1800mの枠順・脚質データ",
    metaDescription:
      "福島芝1800mの小回り、先行力、まくり、ローカル開催で見るべき条件を無料データで整理します。",
    lead:
      "福島芝1800mは小回りで、コーナーで動ける機動力とロスの少ない立ち回りが重要になります。",
    stats: [
      { label: "形態", value: "小回り", note: "外を回しすぎる差し馬は届きにくい。" },
      { label: "脚質", value: "先行・まくり", note: "早めに位置を上げられる馬を確認する。" },
      { label: "開催", value: "ローカル", note: "馬場の内外差が結果に影響しやすい。" },
    ],
    checkpoints: [
      "内で立ち回れる馬を先に見る。",
      "開催後半は外差しが届く馬場かを当日傾向で確認する。",
      "東京向きの瞬発力型は人気でも割り引く場合がある。",
    ],
    caution: "小回り適性と馬場の使われ方を合わせて見ます。",
    relatedArticles: [
      { label: "福島芝1800m完全ガイド", href: "/articles/2025-10-19-fukushima-turf-1800m-complete-guide" },
      { label: "菅原明良の得意コース", href: "/jockeys/akira-sugawara" },
    ],
  },
  {
    venue: "hanshin",
    venueName: "阪神",
    course: "turf-1600m",
    courseName: "芝1600m",
    title: "阪神芝1600mの枠順・脚質データ",
    metaDescription:
      "阪神芝1600m外回りの直線、坂、差し脚質、桜花賞やマイル重賞で確認したい条件を整理します。",
    lead:
      "阪神芝1600mは外回りで直線が長く、最後に坂もあります。末脚の質と持続力の両方を見たい条件です。",
    stats: [
      { label: "形態", value: "外回り", note: "3コーナーから無理なく加速できる馬を確認する。" },
      { label: "直線", value: "坂あり", note: "上がりだけでなく坂で止まらないかを見る。" },
      { label: "脚質", value: "差し・好位差し", note: "直線で進路を取れる位置が重要。" },
    ],
    checkpoints: [
      "内枠の差し馬は直線で詰まらないかを見る。",
      "逃げ馬は単騎で運べる時だけ評価を上げる。",
      "桜花賞などG1では前走レベルと馬体重を合わせる。",
    ],
    caution: "瞬発力だけでなく、坂を含めた持続力を確認します。",
    relatedArticles: [
      { label: "阪神芝1600m枠順データ", href: "/articles/2026-04-22-hanshinturf1600m-waku-data" },
      { label: "岩田望来の得意コース", href: "/jockeys/mirai-iwata" },
    ],
  },
  {
    venue: "kyoto",
    venueName: "京都",
    course: "dirt-1800m",
    courseName: "ダート1800m",
    title: "京都ダート1800mの枠順・脚質データ",
    metaDescription:
      "京都ダート1800mの先行力、平坦コース、ペース判断、好位差しの見方を無料データで整理します。",
    lead:
      "京都ダート1800mは平坦コースで、前半から位置を取れる馬と、向正面でスムーズに動ける馬を確認します。",
    stats: [
      { label: "直線", value: "平坦", note: "坂で止まる心配は少ないが、前が残る展開に注意する。" },
      { label: "脚質", value: "先行・好位", note: "位置取りの差がそのまま結果に出やすい。" },
      { label: "距離", value: "1800m", note: "短距離寄りの馬は最後の持続力を確認する。" },
    ],
    checkpoints: [
      "逃げ馬の数とペースを先に確認する。",
      "差し馬は4コーナーでどこまで押し上げられるかを見る。",
      "馬場が軽い日は前残り、重い日はパワー型を意識する。",
    ],
    caution: "平坦だから前有利と決めず、ペースと頭数を合わせて判断します。",
    relatedArticles: [
      { label: "京都ダート1900m分析", href: "/articles/2026-04-19-kyotodirt1900m" },
      { label: "岩田望来の得意コース", href: "/jockeys/mirai-iwata" },
    ],
  },
  {
    venue: "kokura",
    venueName: "小倉",
    course: "turf-1200m",
    courseName: "芝1200m",
    title: "小倉芝1200mの枠順・脚質データ",
    metaDescription:
      "小倉芝1200mのスピード、内外馬場、先行力、夏開催で確認したい条件を無料データで整理します。",
    lead:
      "小倉芝1200mはスピードが問われる短距離条件です。スタート、枠順、開催後半の馬場差を合わせて見ます。",
    stats: [
      { label: "距離", value: "1200m", note: "スタートと二の脚を優先して確認する。" },
      { label: "馬場", value: "内外差", note: "開催が進むと伸びる場所が変わることがある。" },
      { label: "脚質", value: "先行重視", note: "後方一気は展開と馬場の助けが必要。" },
    ],
    checkpoints: [
      "外差し馬場か内前残りかを当日傾向で確認する。",
      "逃げ馬が多い時は差し馬の浮上を考える。",
      "斤量増や馬体重減がスピード維持に影響しないかを見る。",
    ],
    caution: "短距離戦は小さな出遅れが大きく響くため、スタート面を重視します。",
    relatedArticles: [
      { label: "小倉芝1200m分析", href: "/articles/2025-10-17-kokura-turf-1200m-summer-analysis" },
      { label: "西村淳也の得意コース", href: "/jockeys/atsuki-nishimura" },
    ],
  },
  {
    venue: "hakodate",
    venueName: "函館",
    course: "turf-1200m",
    courseName: "芝1200m",
    title: "函館芝1200mの枠順・脚質データ",
    metaDescription:
      "函館芝1200mの洋芝、先行力、ローカル短距離、馬場悪化時の見方を整理した無料データページです。",
    lead:
      "函館芝1200mは洋芝と小回りが特徴です。軽いスピードだけでなく、馬場に対応できるパワーを確認します。",
    stats: [
      { label: "馬場", value: "洋芝", note: "パワーと持続力を持つ馬を確認する。" },
      { label: "形態", value: "小回り", note: "序盤で位置を取れない馬は厳しくなりやすい。" },
      { label: "脚質", value: "先行", note: "前で流れに乗れるかを最初に見る。" },
    ],
    checkpoints: [
      "札幌・函館の好走歴を優先して確認する。",
      "馬場が重い日は大幅な馬体重減を割り引く。",
      "差し馬は前が速くなるか、外が伸びる馬場かを見る。",
    ],
    caution: "同じ芝1200mでも小倉や中京とは必要な適性が変わります。",
    relatedArticles: [
      { label: "馬場状態の見方", href: "/keiba-data/track-condition" },
      { label: "丹内祐次の得意コース", href: "/jockeys/yuji-tannai" },
    ],
  },
  {
    venue: "nakayama",
    venueName: "中山",
    course: "turf-2500m",
    courseName: "芝2500m",
    title: "中山芝2500mの枠順・脚質データ",
    metaDescription:
      "中山芝2500mの有馬記念条件、スタミナ、コーナー6回、先行力とまくりの見方を整理します。",
    lead:
      "中山芝2500mはコーナーを多く回る長距離条件で、折り合い、スタミナ、早めに動ける機動力が重要です。",
    stats: [
      { label: "形態", value: "コーナー6回", note: "外を回り続けると距離ロスが大きい。" },
      { label: "距離", value: "2500m", note: "折り合いとスタミナを優先して確認する。" },
      { label: "脚質", value: "好位・まくり", note: "直線だけでなく3コーナーからの動きが重要。" },
    ],
    checkpoints: [
      "距離延長馬は前走の折り合いを確認する。",
      "内枠で脚をためられる馬は評価を上げやすい。",
      "人気の差し馬は、仕掛け遅れのリスクを見ておく。",
    ],
    caution: "長距離適性だけでなく、中山の小回りで動けるかを見ます。",
    relatedArticles: [
      { label: "有馬記念データ分析", href: "/articles/2025-10-31-arima-kinen-nakayama-turf-2500m-analysis" },
      { label: "横山和生の得意コース", href: "/jockeys/kazuo-yokoyama" },
    ],
  },
];

export function getJockeyProfile(slug: string) {
  return jockeyProfiles.find((profile) => profile.slug === slug);
}

export function getCourseProfile(venue: string, course: string) {
  return courseProfiles.find((profile) => profile.venue === venue && profile.course === course);
}
