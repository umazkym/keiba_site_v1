import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  ADSENSE_CLIENT,
  ADSENSE_SCRIPT_SRC,
  ensureAdsenseScript,
  getAdsenseScriptUrl,
} from '../lib/adsense-script';

type FakeScript = {
  id: string;
  async: boolean;
  src: string;
  crossOrigin: string | null;
};

const globals = globalThis as unknown as { window?: unknown; document?: unknown; MutationObserver?: unknown };
const originalWindow = globals.window;
const originalDocument = globals.document;
const originalMutationObserver = globals.MutationObserver;

const installDom = ({ existingScript, queue }: { existingScript?: FakeScript; queue?: unknown } = {}) => {
  const scripts = existingScript ? [existingScript] : [];
  const window: Record<string, unknown> = {
    ...(queue === undefined ? {} : { adsbygoogle: queue }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => undefined,
    clearTimeout: () => undefined,
  };
  const document = {
    body: { style: { overflow: '' } },
    documentElement: { style: { overflow: '' } },
    getElementById: (id: string) => scripts.find((script) => script.id === id) ?? null,
    querySelector: (selector: string) => {
      if (!selector.startsWith('script[src^=')) return null;
      return scripts.find((script) => script.src.startsWith(ADSENSE_SCRIPT_SRC)) ?? null;
    },
    createElement: (tag: string) => {
      assert.equal(tag, 'script');
      return { id: '', async: false, src: '', crossOrigin: null } as FakeScript;
    },
    head: {
      appendChild: (script: FakeScript) => {
        scripts.push(script);
        return script;
      },
    },
  };
  globals.window = window;
  globals.document = document;
  return { scripts, window };
};

// 実コンポーネントのeffectを実行し、共通loaderへの配線も検証する。
// Googleの通信や広告DOMは生成せず、Reactの再描画と可視位置判定は対象外にする。
function runComponentEffects(manualEnabled: boolean, pageLevelEnabled: boolean, manualFirst: boolean) {
  const dom = installDom();
  const effects: Array<() => void | (() => void)> = [];
  globals.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  const dependencies: Record<string, unknown> = {
    react: {
      useEffect: (effect: () => void | (() => void)) => effects.push(effect),
      useRef: (current: unknown) => ({ current }),
      useState: (initial: unknown) => [initial, () => undefined],
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/navigation': { usePathname: () => '/' },
    '@/lib/ad-config': {
      isManualAdsEnabled: manualEnabled,
      isProductionRuntime: true,
      shouldLoadAdsensePageLevelScript: pageLevelEnabled,
      shouldShowDevAdPlaceholders: false,
      shouldSuppressAdsInDevelopment: false,
    },
    '@/lib/adsense-script': { ensureAdsenseScript },
    '@/lib/page-scroll-lock': { hasSiteScrollLock: () => false, hasVisibleGoogleDialog: () => false },
    '@/lib/analytics': { sendAdsenseOfferwallViewEvent: () => undefined },
    '@/lib/google-ad-overlay': { publishGoogleAdOverlaySnapshot: () => undefined },
  };
  const loadComponent = (filename: string) => {
    const source = fs.readFileSync(path.join(__dirname, '../components', filename), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: filename,
    }).outputText;
    const module = { exports: {} as Record<string, (props: Record<string, unknown>) => unknown> };
    const resolveDependency = (name: string) => {
      assert.ok(name in dependencies, `未定義のテスト依存: ${name}`);
      return dependencies[name];
    };
    Function('require', 'module', 'exports', compiled)(resolveDependency, module, module.exports);
    return module.exports;
  };
  const manual = loadComponent('Adsense.tsx').Adsense;
  const pageLevel = loadComponent('AdSensePageLevelScript.tsx').AdSensePageLevelScript;
  const mountManual = () => manual({ client: ADSENSE_CLIENT, slot: '1234567890' });
  const mountPageLevel = () => pageLevel({ enabled: pageLevelEnabled });
  for (const mount of manualFirst ? [mountManual, mountPageLevel] : [mountPageLevel, mountManual]) mount();
  const cleanups = effects.map(effect => effect());
  for (const cleanup of cleanups.reverse()) cleanup?.();
  return dom;
}

try {
  // SSR では DOM と queue を作らない。
  delete globals.window;
  delete globals.document;
  assert.equal(ensureAdsenseScript({ pageLevelEnabled: true }), false);

  // 両方無効なら loader を呼び出しても副作用を持たない。
  const disabled = installDom();
  assert.equal(ensureAdsenseScript({ pageLevelEnabled: false, enabled: false }), false);
  assert.equal(disabled.scripts.length, 0);
  assert.equal('adsbygoogle' in disabled.window, false);

  // 手動広告のみは、従来どおり client を URL に付けない。
  const manualOnly = installDom();
  assert.equal(ensureAdsenseScript({ pageLevelEnabled: false }), true);
  assert.equal(manualOnly.scripts.length, 1);
  assert.equal(manualOnly.scripts[0].src, ADSENSE_SCRIPT_SRC);
  const manualQueue = (manualOnly.window as { adsbygoogle: unknown }).adsbygoogle;
  assert.ok(Array.isArray(manualQueue));
  assert.equal(ensureAdsenseScript({ pageLevelEnabled: false }), true);
  assert.equal(manualOnly.scripts.length, 1);
  assert.equal((manualOnly.window as { adsbygoogle: unknown }).adsbygoogle, manualQueue);

  // 手動枠が先でも page-level 有効なら client 付きスクリプトを一度だけ作る。
  const manualFirst = runComponentEffects(true, true, true);
  assert.equal(manualFirst.scripts.length, 1);
  assert.equal(manualFirst.scripts[0].src, getAdsenseScriptUrl(true));

  // page-level が先でも、後から手動枠が来て二重追加しない。
  const pageLevelFirst = runComponentEffects(true, true, false);
  assert.equal(pageLevelFirst.scripts.length, 1);
  assert.equal(pageLevelFirst.scripts[0].src, `${ADSENSE_SCRIPT_SRC}?client=${ADSENSE_CLIENT}`);

  const manualComponents = runComponentEffects(true, false, true);
  assert.equal(manualComponents.scripts.length, 1);
  assert.equal(manualComponents.scripts[0].src, ADSENSE_SCRIPT_SRC);
  const pageLevelComponents = runComponentEffects(false, true, true);
  assert.equal(pageLevelComponents.scripts.length, 1);
  assert.equal(pageLevelComponents.scripts[0].src, getAdsenseScriptUrl(true));
  const disabledComponents = runComponentEffects(false, false, true);
  assert.equal(disabledComponents.scripts.length, 0);
  assert.equal('adsbygoogle' in disabledComponents.window, false);

  // 既存 script/queue は再読込も push もせず、そのまま再利用する。
  const existingScript: FakeScript = {
    id: 'external-adsense-script',
    async: true,
    src: ADSENSE_SCRIPT_SRC,
    crossOrigin: 'anonymous',
  };
  const existingQueue: unknown[] = [];
  const existing = installDom({ existingScript, queue: existingQueue });
  ensureAdsenseScript({ pageLevelEnabled: true });
  assert.equal(existing.scripts.length, 1);
  assert.equal(existing.scripts[0], existingScript);
  assert.equal(existing.scripts[0].src, ADSENSE_SCRIPT_SRC);
  assert.equal((existing.window as { adsbygoogle: unknown }).adsbygoogle, existingQueue);
  assert.equal(existingQueue.length, 0);

  console.log('AdSense shared script loader tests passed.');
} finally {
  if (originalWindow === undefined) delete globals.window;
  else globals.window = originalWindow;
  if (originalDocument === undefined) delete globals.document;
  else globals.document = originalDocument;
  if (originalMutationObserver === undefined) delete globals.MutationObserver;
  else globals.MutationObserver = originalMutationObserver;
}
