import type { Article } from './articles';

export interface ArticleTocItem {
  id: string;
  title: string;
}

export interface ArticleIntent {
  eyebrow: string;
  title: string;
  summary: string;
  checkpoints: string[];
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  nextLinks: ArticleNextLink[];
}

export interface ArticleNextLink {
  href: string;
  label: string;
  description: string;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function enhanceArticleHtml(html: string): { html: string; toc: ArticleTocItem[] } {
  const toc: ArticleTocItem[] = [];
  let index = 0;

  const enhancedHtml = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_match, innerHtml: string) => {
    index += 1;
    const id = `section-${index}`;
    const title = decodeHtmlEntities(stripHtml(innerHtml));
    if (title) {
      toc.push({ id, title });
    }
    return `<h2 id="${id}">${innerHtml}</h2>`;
  });

  return { html: enhancedHtml, toc };
}

function getFeaturedRaceLink(article: Article): ArticleNextLink | null {
  const text = `${article.title} ${article.description} ${article.targetKeyword || ''}`;

  if (text.includes('日本ダービー')) {
    return {
      href: '/races/2026-05-31/tokyo/11',
      label: '日本ダービーの出馬表を見る',
      description: '東京11RのAI偏差値、展開予測、枠順傾向を確認',
    };
  }

  if (text.includes('目黒記念')) {
    return {
      href: '/races/2026-05-31/tokyo/12',
      label: '目黒記念の出馬表を見る',
      description: '東京12RのAI分析とコース傾向を確認',
    };
  }

  if (text.includes('オークス')) {
    return {
      href: '/races/2026-05-24/tokyo/11',
      label: 'オークスの出馬表を見る',
      description: '東京11RのAI偏差値と直前データを確認',
    };
  }

  if (text.includes('新潟大賞典')) {
    return {
      href: '/races/2026-05-17/niigata/11',
      label: '新潟大賞典の出馬表を見る',
      description: '新潟11RのAI分析と展開材料を確認',
    };
  }

  return null;
}

function buildNextLinks(article: Article, categoryHref: string): ArticleNextLink[] {
  const featuredRace = getFeaturedRaceLink(article);
  const links: ArticleNextLink[] = [];

  if (featuredRace) {
    links.push(featuredRace);
  }

  links.push({
    href: '/races/today',
    label: '今日のAI予想を見る',
    description: '当日の出馬表で、記事の見方をそのまま試す',
  });

  if (article.category.includes('入門')) {
    links.push({
      href: '/keiba-data',
      label: 'データの見方を確認する',
      description: '馬場、馬体重、予想サイト選びの基礎を整理',
    });
  } else {
    links.push({
      href: '/results/accuracy?days=90',
      label: 'AI予想成績を見る',
      description: '直近90日の成績から、得意条件と弱い条件を確認',
    });
  }

  links.push({
    href: categoryHref,
    label: '同じテーマの記事を読む',
    description: '関連する分析記事で、判断材料を補強する',
  });

  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  }).slice(0, 3);
}

export function getArticleIntent(article: Article): ArticleIntent {
  const category = article.category || '';
  const theme = article.themeCluster || '';
  const encodedCategory = encodeURIComponent(category);
  const categoryHref = `/articles?category=${encodedCategory}`;
  const featuredRace = getFeaturedRaceLink(article);
  const nextLinks = buildNextLinks(article, categoryHref);

  if (category.includes('重賞') || theme === 'grade_race_preview' || article.title.includes('AI予想')) {
    return {
      eyebrow: '重賞前の確認',
      title: '情報が多いレースほど、先に見る順番を決める',
      summary: '重賞は調教、枠順、騎手コメント、オッズが一気に流れてきます。この記事では、直前に迷いやすい材料をコース傾向と数値から整理します。',
      checkpoints: [
        '人気馬を軸にする前に、枠順と脚質が噛み合っているかを見る',
        '穴馬は能力より先に、展開で浮上できる位置を取れるかを見る',
        '枠順確定後は、出馬表のAI偏差値と合わせて最終確認する',
      ],
      primaryHref: featuredRace?.href || '/races/today',
      primaryLabel: featuredRace?.label || '今日のAI予想を見る',
      secondaryHref: categoryHref,
      secondaryLabel: '重賞攻略を続けて読む',
      nextLinks,
    };
  }

  if (category.includes('騎手')) {
    return {
      eyebrow: '騎手データの使いどころ',
      title: '騎手名だけで買わず、人気と条件のズレを見る',
      summary: '騎手データは「うまいから買う」ではなく、得意条件がオッズに織り込まれすぎていないかを確認するために使います。',
      checkpoints: [
        '勝率が高くても回収率が低い騎手は軸向き、単勝妙味は薄い',
        'コース替わりで成績が跳ねる騎手は、平場の相手候補に残す',
        '人気薄で複勝率が落ちにくい条件は、ワイドや三連複の材料にする',
      ],
      primaryHref: '/races/today',
      primaryLabel: '今日の騎乗馬を確認する',
      secondaryHref: categoryHref,
      secondaryLabel: '騎手分析をもっと読む',
      nextLinks,
    };
  }

  if (category.includes('コース') || category.includes('枠順')) {
    return {
      eyebrow: '平場予想の下準備',
      title: '短時間で何レースも見る日は、コースの初期値が効く',
      summary: '平場は全頭を深く見きれないことが多いので、先にコースの有利不利を押さえると、買うレースと見送るレースを分けやすくなります。',
      checkpoints: [
        '枠順の差が大きいコースでは、人気馬でも不利枠なら評価を下げる',
        '脚質傾向が強いコースでは、展開に逆らう穴馬を深追いしない',
        '同じ競馬場の記事を続けて読むと、開催日の馬場傾向も掴みやすい',
      ],
      primaryHref: '/races/today',
      primaryLabel: '今日の出馬表で使う',
      secondaryHref: categoryHref,
      secondaryLabel: 'コース分析を続けて読む',
      nextLinks,
    };
  }

  if (category.includes('入門')) {
    return {
      eyebrow: '予想前の基礎確認',
      title: '迷う材料を増やすより、判断基準を少なくする',
      summary: '初心者ほど全情報を同じ重さで見てしまいがちです。まずは馬券種、オッズ、馬場、馬体重のどれを優先するかを決めます。',
      checkpoints: [
        '買う馬券種を先に決め、点数を増やしすぎない',
        '直前情報は「買う理由」より「見送る理由」として使う',
        '迷ったレースは予想ページで数値を確認し、無理に参加しない',
      ],
      primaryHref: '/races/today',
      primaryLabel: '今日の予想で試す',
      secondaryHref: categoryHref,
      secondaryLabel: '入門ガイドを読む',
      nextLinks,
    };
  }

  return {
    eyebrow: '馬券検討の整理',
    title: 'オッズを見る前に、買う理由と見送る理由を分ける',
    summary: 'データ記事は結論を暗記するためではなく、レースごとの判断材料を減らすために使います。人気、枠、脚質、馬場のズレを順に確認します。',
    checkpoints: [
      '人気馬の不安材料を先に探し、過剰人気を避ける',
      '穴馬は数字の良さだけでなく、展開に乗れる条件まで確認する',
      '最終判断は当日の出馬表とオッズを合わせて行う',
    ],
    primaryHref: '/races/today',
    primaryLabel: '今日のAI予想を見る',
    secondaryHref: '/articles',
    secondaryLabel: '記事一覧へ戻る',
    nextLinks,
  };
}
