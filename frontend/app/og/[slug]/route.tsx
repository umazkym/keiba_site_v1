// 記事のOG画像（1200×630）。リンクを貼ったときに出る画像。
// 以前は sharp＋SVG で描いていたが、本番のコンテナに日本語の書体が無く、英字も含めて全文字が四角になっていた。
// 見出しと同じ M PLUS Rounded 1c ExtraBold を同梱し（assets/fonts）、next/og で描く。
// 形はポートフォリオの「記事のOG画像」：白地・左に紺の帯・ロゴ・カテゴリ・題名・日付と読了時間。
import fs from 'fs/promises';
import path from 'path';
import { ImageResponse } from 'next/og';
import { getArticleBySlug } from '@/lib/articles';
import { estimateReadingMinutes, getArticleCategoryStyle } from '@/lib/article-visual';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WIDTH = 1200;
const HEIGHT = 630;
const INK = '#151A3D';
const INK2 = '#3A4063';
const MUTED = '#5A6183';
const NAVY = '#1C2787';

type OgMeta = {
  title: string;
  category: string | null;
  date: string | null;
  readingMinutes: number | null;
};

let fontPromise: Promise<Buffer> | null = null;
let markPromise: Promise<string> | null = null;

const loadFont = () => {
  fontPromise ??= fs.readFile(path.join(process.cwd(), 'assets', 'fonts', 'MPLUSRounded1c-ExtraBold.ttf'));
  return fontPromise;
};

const loadMark = () => {
  markPromise ??= fs
    .readFile(path.join(process.cwd(), 'public', 'brand', 'uma-free-mark.svg'))
    .then((svg) => `data:image/svg+xml;base64,${svg.toString('base64')}`);
  return markPromise;
};

function normalizeSlug(rawSlug: string): string {
  const decoded = decodeURIComponent(rawSlug).replace(/\.png$/i, '');
  return path.basename(decoded).replace(/\.md$/i, '');
}

async function readArticleMeta(slug: string): Promise<OgMeta> {
  try {
    const article = await getArticleBySlug(slug);
    return {
      title: article.title,
      category: article.category || null,
      date: article.date || null,
      readingMinutes: estimateReadingMinutes(article.content),
    };
  } catch {
    return { title: 'UMA-FREE｜競馬データ分析', category: null, date: null, readingMinutes: null };
  }
}

const formatDate = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' }).format(date);
};

// 「本題｜副題」の形は2段に分ける（副題は小さく）
function splitTitle(title: string): [string, string] {
  const index = title.search(/[｜|]/);
  if (index <= 0) return [title.trim(), ''];
  return [title.slice(0, index).trim(), title.slice(index + 1).trim()];
}

// 題名の長さで文字の大きさを決める（3行に収める）
function mainTitleSize(main: string, hasSub: boolean) {
  const length = Array.from(main).length;
  if (length <= 14) return hasSub ? 62 : 66;
  if (length <= 22) return hasSub ? 54 : 58;
  if (length <= 32) return 48;
  return 42;
}

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  const slug = normalizeSlug(params.slug);
  const [meta, font, mark] = await Promise.all([readArticleMeta(slug), loadFont(), loadMark()]);
  const [main, sub] = splitTitle(meta.title);
  const titleSize = mainTitleSize(main, Boolean(sub));
  const categoryColor = meta.category ? getArticleCategoryStyle(meta.category).hex : NAVY;
  const footer = [formatDate(meta.date), meta.readingMinutes ? `約${meta.readingMinutes}分` : ''].filter(Boolean).join(' · ');

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: 'flex',
          position: 'relative',
          background: '#FFFFFF',
          fontFamily: 'MPLUSRounded',
          color: INK,
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 18, background: NAVY, display: 'flex' }} />

        <div style={{ position: 'absolute', left: 70, right: 70, top: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- next/og の描画用 */}
            <img src={mark} width={56} height={56} alt="" />
            <span style={{ fontSize: 32, color: NAVY, letterSpacing: 1 }}>UMA-FREE</span>
          </div>
          {meta.category && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                height: 46,
                padding: '0 18px',
                borderRadius: 10,
                background: categoryColor,
                color: '#FFFFFF',
                fontSize: 23,
              }}
            >
              {meta.category}
            </span>
          )}
        </div>

        <div style={{ position: 'absolute', left: 70, right: 70, top: 160, bottom: 118, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
          <div style={{ display: 'flex', fontSize: titleSize, lineHeight: 1.36, color: INK }}>{main}</div>
          {sub && <div style={{ display: 'flex', fontSize: 34, lineHeight: 1.4, color: INK2 }}>{sub}</div>}
        </div>

        <div
          style={{
            position: 'absolute',
            left: 70,
            right: 70,
            bottom: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 22,
            borderTop: '2px solid #E2E5EF',
          }}
        >
          <span style={{ fontSize: 23, color: MUTED }}>{footer || '中央・地方の全レースを毎日無料で分析'}</span>
          <span style={{ fontSize: 26, color: NAVY }}>uma-free.com</span>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [{ name: 'MPLUSRounded', data: font, weight: 800, style: 'normal' }],
      // 小文字の 'cache-control' で渡すと next/og の既定（1年・immutable）を置き換える。大文字だと両方が並ぶ。
      // 題名を直したとき（検索向けの改稿など）に1日で入れ替わるようにする。
      headers: {
        'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
