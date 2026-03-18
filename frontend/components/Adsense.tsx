'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

type AdsenseProps = {
  client: string;
  slot: string;
  /** レース切替等で広告をリフレッシュしたい場合に変更する一意キー */
  refreshKey?: string;
  className?: string;
  style?: React.CSSProperties;
  isResponsive?: boolean;
};

export const Adsense = ({ client, slot, refreshKey = '', className, style, isResponsive = true }: AdsenseProps) => {
  const pathname = usePathname();
  const adRef = useRef<HTMLDivElement>(null);
  const adLoaded = useRef(false);
  const [scriptReady, setScriptReady] = useState(false);
  const prevRefreshKey = useRef(refreshKey);
  const prevPathname = useRef(pathname);
  const isFirstLoad = useRef(true); // 初回読み込みフラグ（lazy load用）

  // GoogleAdSenseスクリプトの初期化を確認
  useEffect(() => {
    const checkScriptReady = () => {
      const ads = (window as any).adsbygoogle;
      // Array.isArray() に加え、スクリプトが即座に読み込まれた場合(オブジェクト化済)の判定も追加
      if (ads && (Array.isArray(ads) || typeof ads.push === 'function' || ads.loaded)) {
        setScriptReady(true);
      } else {
        const timer = setTimeout(checkScriptReady, 100);
        return () => clearTimeout(timer);
      }
    };

    checkScriptReady();
  }, []);

  // refreshKey または pathname が変わったら広告をリフレッシュ準備
  // ★ CLS防止: リフレッシュ前にコンテナの高さをロックし、画面ジャンプを防ぐ
  useEffect(() => {
    const keyChanged = prevRefreshKey.current !== refreshKey;
    const pathChanged = prevPathname.current !== pathname;

    if (keyChanged || pathChanged) {
      const container = adRef.current;
      if (container && adLoaded.current) {
        // ★ 現在の高さを固定し、広告消去時のレイアウトシフトを防止
        const currentHeight = container.offsetHeight;
        if (currentHeight > 0) {
          container.style.minHeight = `${currentHeight}px`;
        }
      }
      adLoaded.current = false;
      isFirstLoad.current = false;
      prevRefreshKey.current = refreshKey;
      prevPathname.current = pathname;
    }
  }, [refreshKey, pathname]);

  // メイン広告読み込みエフェクト
  useEffect(() => {
    const adContainer = adRef.current;
    if (!adContainer || adLoaded.current || !scriptReady) {
      return;
    }

    const loadAd = () => {
      if (adLoaded.current) return;
      if (!(window as any).adsbygoogle) {
        console.warn('adsbygoogle not ready');
        return;
      }

      // 既存の内容をクリア
      adContainer.innerHTML = '';

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
        ((window as any).adsbygoogle).push({});
        adLoaded.current = true;

        // ★ CLS防止: 新しい広告がレンダリングされたら高さロックを解除
        //   data-ad-status="filled" or "unfilled" を監視
        const adStatusObserver = new MutationObserver(() => {
          const status = ins.getAttribute('data-ad-status');
          if (status === 'filled' || status === 'unfilled') {
            // 新しい広告が描画完了 → 高さロック解除
            adContainer.style.minHeight = '';
            adStatusObserver.disconnect();
          }
        });
        adStatusObserver.observe(ins, {
          attributes: true,
          attributeFilter: ['data-ad-status'],
        });

        // フォールバック: 3秒経っても応答がなければロック解除
        // また、localhostやAdBlock等の環境で、AdSenseが何もステータスを返さずに沈黙した場合のフォールバックとして、
        // 強制的に unfilled を付与し、親コンポーネント(AdUnit等)の枠消去ロジックを非同期発火させる。
        setTimeout(() => {
          adContainer.style.minHeight = '';
          adStatusObserver.disconnect();
          
          if (ins && !ins.getAttribute('data-ad-status')) {
            ins.setAttribute('data-ad-status', 'unfilled');
          }
        }, 3000);
      } catch (err) {
        console.error('adsbygoogle.push() error:', err);
        // エラー時もロック解除
        adContainer.style.minHeight = '';
      }
    };

    // ★ リフレッシュ時（isFirstLoad=false）は画面内判定を待たずに即座に読み込み
    //   IntersectionObserver待ちをスキップし、広告の表示遅延を大幅に短縮
    if (!isFirstLoad.current) {
      loadAd();
      return; // クリーンアップ不要（observerなし）
    }

    // 初回読み込み: IntersectionObserverで遅延読み込み（パフォーマンス最適化）
    const observer = new IntersectionObserver(
      ([entry]) => {
        // ★ 安全策: 親の幅が0のままロードするとAdSenseがクラッシュし、unfilled判定すら出なくなるため、
        // 必ず clientWidth > 0 を確認してからロードする。
        if (entry.isIntersecting && entry.target.clientWidth > 0) {
          loadAd();
          observer.disconnect();
        }
      },
      {
        // 猛スピードのスクロールに対応するため、1200px（約スマホ2画面分）前から読み込み開始
        rootMargin: '1200px 0px 1200px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(adContainer);

    return () => {
      observer.disconnect();
    };
  }, [pathname, refreshKey, client, slot, className, style, isResponsive, scriptReady]);

  // 開発環境ではプレースホルダーを表示
  if (process.env.NODE_ENV !== 'production') {
    return (
      <div
        className={`bg-gray-200 border-2 border-dashed border-gray-400 text-gray-500 flex items-center justify-center ${className || ''}`}
        style={style}
      >
        広告エリア (Slot: {slot}{refreshKey ? ` | Key: ${refreshKey}` : ''})
      </div>
    );
  }

  // ★ 本番: key プロップを使わない（DOM破棄→再作成による画面ジャンプを防止）
  //   同一DOMノードの innerHTML を差し替えることで、スムーズなリフレッシュを実現
  // 幅ゼロでのクラッシュを防ぐため、w-full とスタイル(minHeight等)を明示的に外枠へ適用
  return <div ref={adRef} className={`w-full ${className || ''}`} style={style} />;
};
