'use client';

import { Adsense } from './Adsense';

export const AnchorAd = () => {
  // 本番環境以外では広告を表示しない
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-sm z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
      <div className="container mx-auto p-1 flex justify-center">
        {/* このスタイルはGoogle AdSenseのアンカー広告の一般的なサイズです */}
        <Adsense
          client="ca-pub-xxxxxxxxxxxxxxxx" // ご自身のAdSenseクライアントIDに置き換えてください
          slot="xxxxxxxxxx"             // アンカー広告用の広告ユニットIDに置き換えてください
          style={{ width: '320px', height: '50px' }}
          className="adsbygoogle"
          isResponsive={false} // ★★★ この行を追加 ★★★
        />
      </div>
    </div>
  );
};