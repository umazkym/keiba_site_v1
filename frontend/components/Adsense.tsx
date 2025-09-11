'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

type AdsenseProps = {
  client: string;
  slot: string;
  className?: string;
  style?: React.CSSProperties;
  isResponsive?: boolean; // ★★★ この行を追加 ★★★
};

export const Adsense = ({ client, slot, className, style, isResponsive = true }: AdsenseProps) => { // ★★★ isResponsive props を追加 ★★★
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    containerRef.current.innerHTML = '';

    const ins = document.createElement('ins');
    ins.className = `adsbygoogle ${className || ''}`;

    ins.style.display = 'block';
    if(style) {
        Object.assign(ins.style, style);
    }

    ins.setAttribute('data-ad-client', client);
    ins.setAttribute('data-ad-slot', slot);
    
    // ▼▼▼▼▼ ここを修正 ▼▼▼▼▼
    // isResponsiveがtrueの場合のみ、レスポンシブ用の属性を設定する
    if (isResponsive) {
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
    }
    // ▲▲▲▲▲ ここまで修正 ▲▲▲▲▲

    containerRef.current.appendChild(ins);

    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch (err) {
      console.error('adsbygoogle.push() error:', err);
    }

  }, [pathname, client, slot, className, style, isResponsive]); // ★★★ isResponsive を依存配列に追加 ★★★

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

  return <div ref={containerRef} key={pathname + slot} />;
};