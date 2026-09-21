/**
 * 手動枠とページレベル広告で共有する AdSense スクリプトの読込窓口。
 *
 * page-level が有効な実行では、先にマウントした側も Google 推奨の
 * client 付き URL を使う。すでに存在するスクリプトは再読込しない。
 */
export const ADSENSE_SCRIPT_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
export const ADSENSE_CLIENT = 'ca-pub-4411270831448240';
const ADSENSE_SHARED_SCRIPT_ID = 'uma-adsense-shared-script';

export type AdsenseScriptOptions = {
  /** 自動広告またはオファーウォールを有効にしたページか */
  pageLevelEnabled: boolean;
  /** 呼出元の広告機能自体が有効か。無効時は DOM を変更しない。 */
  enabled?: boolean;
};

export const getAdsenseScriptUrl = (pageLevelEnabled: boolean) =>
  pageLevelEnabled ? `${ADSENSE_SCRIPT_SRC}?client=${ADSENSE_CLIENT}` : ADSENSE_SCRIPT_SRC;

const getExistingAdsenseScript = () =>
  document.getElementById(ADSENSE_SHARED_SCRIPT_ID) ||
  document.querySelector<HTMLScriptElement>(`script[src^="${ADSENSE_SCRIPT_SRC}"]`);

/**
 * 既存 queue を維持したまま、一度だけスクリプト要素を追加する。
 * push や再試行は広告枠コンポーネントの責務なのでここでは行わない。
 */
export const ensureAdsenseScript = ({
  pageLevelEnabled,
  enabled = true,
}: AdsenseScriptOptions): boolean => {
  if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') return false;

  if (!(window as Window & { adsbygoogle?: unknown }).adsbygoogle) {
    (window as Window & { adsbygoogle?: unknown }).adsbygoogle = [];
  }

  if (getExistingAdsenseScript()) return true;

  const script = document.createElement('script');
  script.id = ADSENSE_SHARED_SCRIPT_ID;
  script.async = true;
  script.src = getAdsenseScriptUrl(pageLevelEnabled);
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
  return true;
};
