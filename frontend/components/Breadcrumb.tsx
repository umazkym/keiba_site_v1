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

export function Breadcrumb({ items }: BreadcrumbProps = {}) {
  const pathname = usePathname();
  const [articleTitle, setArticleTitle] = useState<string | null>(null);
  const [liveItems, setLiveItems] = useState<BreadcrumbItem[] | null>(null);

  // 記事ページの場合は、記事タイトルを取得
  useEffect(() => {
    if (pathname.startsWith('/articles/')) {
      const slug = pathname.split('/').pop();
      if (slug) {
        try {
          // window.articleTitleという方法もありますが、代わりにdom内から取得
          const h1 = document.querySelector('h1');
          if (h1) {
            setArticleTitle(h1.textContent || null);
          }
        } catch (error) {
          console.error('Failed to get article title:', error);
        }
      }
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
      { label: 'ホーム', href: '/' }
    ];

    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;

      // URLスラッグを日本語ラベルに変換
      const labelMap: { [key: string]: string } = {
        'articles': '記事',
        'races': 'レース分析',
        'courses': 'コース別データ',
        'grade-races': '重賞データ',
        'jockeys': '騎手別データ',
        'trainers': '調教師別データ',
        'horses': '競走馬データ',
        'keiba-data': '競馬データベース',
        'results': 'AI予想成績',
        'accuracy': 'AI予想の成績',
        'horse-weight': '馬体重増減',
        'site-selection': 'サイトの選び方',
        'track-condition': '馬場状態',
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
        'about': '運営者情報',
        'faq': 'よくある質問',
        'contact': 'お問い合わせ',
        'privacy': 'プライバシーポリシー',
        'terms': '利用規約',
        'advertising': '広告について',
      };

      let label = labelMap[segment];

      if (!label) {
        // 記事ページで最後のセグメントの場合、記事タイトルを使用
        if (pathname.startsWith('/articles/') && index === segments.length - 1 && articleTitle) {
          label = articleTitle;
        } else {
          // 日付またはスラッグの場合は、デコードして表示
          label = decodeURIComponent(segment)
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
      }

      // 最後のセグメント（現在のページ）の場合、リンクにしない
      if (index === segments.length - 1) {
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
                  className="whitespace-nowrap text-slate-600 hover:text-primary font-semibold transition-colors"
                >
                  {item.label}
                </Link>
                <span className="mx-1 text-slate-300" aria-hidden="true">/</span>
              </>
            ) : (
              <span className="breadcrumb-current font-semibold text-text-primary">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
