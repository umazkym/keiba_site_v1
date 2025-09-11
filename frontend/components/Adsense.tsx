'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

type AdsenseProps = {
  client: string;
  slot: string;
  className?: string;
  style?: React.CSSProperties;
};

export const Adsense = ({ client, slot, className, style }: AdsenseProps) => {
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
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');

    containerRef.current.appendChild(ins);

    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch (err) {
      console.error('adsbygoogle.push() error:', err);
    }

  }, [pathname, client, slot, className, style]);

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