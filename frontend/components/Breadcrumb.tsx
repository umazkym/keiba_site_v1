'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { isValidRaceDate, parseRaceNumberParam, venueSlugToName } from '@/lib/race-url';
import {
  RACE_BREADCRUMB_CHANGE_EVENT,
  type RaceBreadcrumbChangeDetail,
} from '@/lib/race-breadcrumb-event';

interface BreadcrumbItem {
  label: string;
  href: string;
}

type BreadcrumbProps = {
  items?: BreadcrumbItem[];
};

const STATIC_LABEL_MAP: Record<string, string> = {
  // メイン機能・データベース
  'keiba-data': '競馬データベース',
  'courses': 'コース別データ',
  'horses': '競走馬データ',
  'jockeys': '騎手別データ',
  'trainers': '調教師別データ',
  'compare': '競走馬比較',
  'my-data': 'マイデータ',
  'search': 'サイト内検索',
  'results': 'AI予想成績',
  'accuracy': '成績・検証',
  'races': 'レース分析',
  'today': '本日のレース',
  'articles': '記事',

  // 記事カテゴリ・特集
  'grade-races': '重賞データ',
  'horse-weight': '馬体重増減',
  'site-selection': 'サイトの選び方',
  'track-condition': '馬場状態',

  // サイト情報・ポリシー
  'about': '運営者情報',
  'about-ai': 'AI予想の仕組み',
  'faq': 'よくある質問',
  'contact': 'お問い合わせ',
  'privacy': 'プライバシーポリシー',
  'terms': '利用規約',
  'advertising': '広告について',
  'sitemap': 'サイトマップ',

  // 主要重賞スラッグ
  'nihon-derby': '日本ダービー',
  'yasuda-kinen': '安田記念',
  'takarazuka-kinen': '宝塚記念',
  'sprinters-stakes': 'スプリンターズS',
  'tenno-sho-autumn': '天皇賞（秋）',
  'japan-cup': 'ジャパンカップ',
  'mile-championship': 'マイルCS',
  'arima-kinen': '有馬記念',
  '2026-nihon-derby': '日本ダービー',
  '2026-yasuda-kinen': '安田記念',
  '2026-takarazuka-kinen': '宝塚記念',
  '2026-sprinters-stakes': 'スプリンターズS',
  '2026-tenno-sho-autumn': '天皇賞（秋）',
  '2026-japan-cup': 'ジャパンカップ',
  '2026-mile-championship': 'マイルCS',
  '2026-arima-kinen': '有馬記念',
};

function parseSegmentLabel(segment: string, isLast: boolean, pageTitle: string | null): string {
  // 1. 静的マッピング
  if (STATIC_LABEL_MAP[segment]) {
    return STATIC_LABEL_MAP[segment];
  }

  // 2. 競馬場スラッグ（tokyo -> 東京, hanshin -> 阪神 など）
  const venueName = venueSlugToName(segment);
  if (venueName) {
    return venueName;
  }

  // 3. コース条件スラッグ（turf-1600m -> 芝1600m, dirt-1800m -> ダート1800m）
  const courseMatch = segment.match(/^(turf|dirt|obstacle)-(\d+m)$/i);
  if (courseMatch) {
    const surfaceMap: Record<string, string> = {
      turf: '芝',
      dirt: 'ダート',
      obstacle: '障害',
    };
    const surface = surfaceMap[courseMatch[1].toLowerCase()] || courseMatch[1];
    return `${surface}${courseMatch[2]}`;
  }

  // 4. 最後のセグメントで DOM (h1) からタイトルが取れている場合
  if (isLast && pageTitle) {
    const cleaned = pageTitle
      .split(/[｜|]/)[0]
      .trim();
    if (cleaned && cleaned.length < 40) {
      return cleaned;
    }
  }

  // 5. 日付フォーマット（YYYY-MM-DD）
  if (/^\d{4}-\d{2}-\d{2}$/.test(segment)) {
    return formatDate(segment);
  }

  // 6. デフォルトフォールバック（ハイフン区切りを単語化）
  return decodeURIComponent(segment)
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function Breadcrumb({ items }: BreadcrumbProps = {}) {
  const pathname = usePathname();
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [liveItems, setLiveItems] = useState<BreadcrumbItem[] | null>(null);

  // ページタイトルを DOM から取得（記事・詳細ページ用）
  useEffect(() => {
    try {
      const h1 = document.querySelector('h1');
      if (h1 && h1.textContent) {
        setPageTitle(h1.textContent.trim());
      } else {
        setPageTitle(null);
      }
    } catch {
      setPageTitle(null);
    }
  }, [pathname]);

  useEffect(() => {
    setLiveItems(null);
  }, [pathname, items]);

  useEffect(() => {
    const handleRaceBreadcrumbChange = (event: Event) => {
      const detail = (event as CustomEvent<RaceBreadcrumbChangeDetail>).detail;
      if (!detail || !Array.isArray(detail.items) || detail.items.length === 0) return;

      const nextItems = detail.items
        .filter((item) => typeof item.label === 'string' && typeof item.href === 'string')
        .map((item) => ({
          label: item.label,
          href: item.href,
        }));
      if (nextItems.length > 0) {
        setLiveItems(nextItems);
      }
    };

    window.addEventListener(RACE_BREADCRUMB_CHANGE_EVENT, handleRaceBreadcrumbChange);
    return () => {
      window.removeEventListener(RACE_BREADCRUMB_CHANGE_EVENT, handleRaceBreadcrumbChange);
    };
  }, []);

  const generateRaceBreadcrumbs = (segments: string[]): BreadcrumbItem[] | null => {
    if (segments[0] !== 'races') return null;

    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'ホーム', href: '/' },
      { label: 'レース分析', href: '/races/today' },
    ];
    const dateSegment = segments[1];

    if (!dateSegment) {
      return [
        { label: 'ホーム', href: '/' },
        { label: 'レース分析', href: '' },
      ];
    }

    if (dateSegment === 'today') {
      breadcrumbs.push({ label: '本日のレース分析', href: '' });
      return breadcrumbs;
    }

    if (!isValidRaceDate(dateSegment)) return null;

    const dateLabel = `${formatDate(dateSegment)}のレース分析`;
    const venueName = segments[2] ? venueSlugToName(segments[2]) : null;
    const raceNumber = parseRaceNumberParam(segments[3]);

    if (venueName && raceNumber) {
      breadcrumbs.push({ label: dateLabel, href: `/races/${dateSegment}` });
      breadcrumbs.push({ label: `${venueName}${raceNumber}R`, href: '' });
      return breadcrumbs;
    }

    breadcrumbs.push({ label: dateLabel, href: '' });
    return breadcrumbs;
  };

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const segments = pathname.split('/').filter(Boolean);
    const raceBreadcrumbs = generateRaceBreadcrumbs(segments);
    if (raceBreadcrumbs) return raceBreadcrumbs;

    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'ホーム', href: '/' },
    ];

    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;
      const label = parseSegmentLabel(segment, isLast, pageTitle);

      if (isLast) {
        breadcrumbs.push({ label, href: '' });
      } else {
        breadcrumbs.push({ label, href: currentPath });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = liveItems ?? (items && items.length > 0 ? items : generateBreadcrumbs());

  // ホームページのみの場合は表示しない
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav
      className="breadcrumb-nav"
      aria-label="Breadcrumb"
    >
      <ol className="flex min-w-0 items-center text-xs sm:flex-wrap">
        {breadcrumbs.map((item, index) => (
          <li key={index} className="breadcrumb-item flex min-w-0 items-center">
            {item.href ? (
              <>
                <Link
                  href={item.href}
                  className="whitespace-nowrap font-semibold text-slate-600 transition-colors hover:text-blue-600"
                >
                  {item.label}
                </Link>
                <span className="mx-1 text-slate-300" aria-hidden="true">/</span>
              </>
            ) : (
              <span className="breadcrumb-current font-semibold text-slate-900">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
