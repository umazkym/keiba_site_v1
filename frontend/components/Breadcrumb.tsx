'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface BreadcrumbItem {
  label: string;
  href: string;
}

export function Breadcrumb() {
  const pathname = usePathname();
  const [articleTitle, setArticleTitle] = useState<string | null>(null);

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

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const segments = pathname.split('/').filter(Boolean);
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
        'keiba-data': 'データの見方',
        'results': 'AI予想成績',
        'accuracy': 'AI予想の成績',
        'horse-weight': '馬体重増減',
        'site-selection': 'サイトの選び方',
        'track-condition': '馬場状態',
        '2026-nihon-derby': '2026年日本ダービー',
        '2026-yasuda-kinen': '2026年安田記念',
        '2026-takarazuka-kinen': '2026年宝塚記念',
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

  const breadcrumbs = generateBreadcrumbs();

  // ホームページのみの場合は表示しない
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav
      className="overflow-hidden px-4 py-3"
      aria-label="Breadcrumb"
    >
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {breadcrumbs.map((item, index) => (
          <li key={index} className="flex min-w-0 items-center gap-2">
            {item.href ? (
              <>
                <Link
                  href={item.href}
                  className="text-primary hover:text-primary-dark font-semibold transition-colors"
                >
                  {item.label}
                </Link>
                <span className="text-slate-400 mx-1">/</span>
              </>
            ) : (
              <span className="breadcrumb-current font-semibold text-text-primary">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>

      {/* Schema.org構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            'itemListElement': breadcrumbs
              .filter(b => b.href || b === breadcrumbs[breadcrumbs.length - 1])
              .map((item, index) => ({
                '@type': 'ListItem',
                'position': index + 1,
                'name': item.label,
                'item': item.href ? `https://uma-free.com${item.href}` : undefined,
              }))
              .filter(item => item.item !== undefined),
          }),
        }}
      />
    </nav>
  );
}
