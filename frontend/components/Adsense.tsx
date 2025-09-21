'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

type AdsenseProps = {
  client: string;
  slot: string;
  className?: string;
  style?: React.CSSProperties;
  isResponsive?: boolean;
};

export const Adsense = ({ client, slot, className, style, isResponsive = true }: AdsenseProps) => {
  const pathname = usePathname();
  const adRef = useRef<HTMLDivElement>(null);
  const adLoaded = useRef(false); // 広告が一度読み込まれたかを追跡するフラグ

  useEffect(() => {
    const adContainer = adRef.current;
    // コンテナが存在しない、または既に広告が読み込まれている場合は何もしない
    if (!adContainer || adLoaded.current) {
      return;
    }

    // 広告を実際に読み込む関数
    const loadAd = () => {
      // 二重読み込みを防止
      if (adLoaded.current) return;

      adContainer.innerHTML = ''; // 既存の内容をクリア
      const ins = document.createElement('ins');
      ins.className = `adsbygoogle ${className || ''}`;

      ins.style.display = 'block';
      if (style) {
        Object.assign(ins.style, style);
      }

      ins.setAttribute('data-ad-client', client);
      ins.setAttribute('data-ad-slot', slot);

      if (isResponsive) {
        ins.setAttribute('data-ad-format', 'auto');
        ins.setAttribute('data-full-width-responsive', 'true');
      }

      adContainer.appendChild(ins);

      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        adLoaded.current = true; // 読み込み成功フラグを立てる
      } catch (err) {
        console.error('adsbygoogle.push() error:', err);
      }
    };

    // IntersectionObserverをセットアップ
    const observer = new IntersectionObserver(
      ([entry]) => {
        // 要素がビューポート内に入り、かつ幅が0でない場合に広告を読み込む
        if (entry.isIntersecting && entry.target.clientWidth > 0) {
            loadAd();
            observer.disconnect(); // 目的を果たしたので監視を停止
        }
      },
      {
        rootMargin: '0px',
        threshold: 0.1, // 要素が10%見えたらトリガー
      }
    );

    observer.observe(adContainer);

    // クリーンアップ関数
    return () => {
      observer.disconnect();
    };
    // pathnameが変わるたびに再監視するように設定
  }, [pathname, client, slot, className, style, isResponsive]);

  // 開発環境ではプレースホルダーを表示
  if (process.env.NODE_ENV !== 'production') {
    return (
        <div
          className={`bg-gray-200 border-2 border-dashed border-gray-400 text-gray-500 flex items-center justify-center ${className || ''}`}
          style={style}
        >
          広告エリア (Slot: {slot})
        </div>
    );
  }

  // keyをpathnameとslotの組み合わせにすることで、ページ遷移時に広告コンポーネントを確実に再生成させる
  return <div ref={adRef} key={`${pathname}-${slot}`} />;
};