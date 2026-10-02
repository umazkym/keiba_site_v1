import fs from 'fs';
import path from 'path';

// 記事本文の <img> に、画像の実際の幅・高さを足す（サーバーだけで使う。クライアントの部品から import しない）。
// 幅・高さが無いと、画像が届いた時に下の文が下へ動く（CLS）。届く前から縦横比で場所を取らせる。
// 見た目は変えない：Tailwind の preflight（img { max-width: 100%; height: auto }）が効くので、
// 属性の数字は縦横比の計算にだけ使われる。

type ImageSize = { width: number; height: number };

const publicDirectory = path.join(process.cwd(), 'public');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// PNG は 署名8 + 長さ4 + "IHDR"4 + 幅4 + 高さ4。先頭の24バイトだけで寸法が分かる。
const PNG_HEADER_BYTES = 24;

// 同じ画像を何度も開かない。読めなかった物も null で覚える。
const sizeCache = new Map<string, ImageSize | null>();

// 属性の値（引用符の中）に > があっても、タグの終わりを取り違えない。
const IMG_TAG_PATTERN = /<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const SRC_PATTERN = /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const QUOTED_VALUE_PATTERN = /"[^"]*"|'[^']*'/g;

function resolvePublicPngPath(src: string): string | null {
  if (!src.startsWith('/images/')) {
    return null;
  }
  const withoutQuery = src.split(/[?#]/)[0];
  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    return null;
  }
  if (!decoded.toLowerCase().endsWith('.png')) {
    return null;
  }
  const resolved = path.resolve(publicDirectory, `.${decoded}`);
  // "../" で public の外へ出る src は読まない。
  if (!resolved.startsWith(publicDirectory + path.sep)) {
    return null;
  }
  return resolved;
}

function readPngSize(filePath: string): ImageSize | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(PNG_HEADER_BYTES);
    const bytesRead = fs.readSync(fd, header, 0, PNG_HEADER_BYTES, 0);
    if (bytesRead < PNG_HEADER_BYTES) {
      return null;
    }
    if (!header.subarray(0, 8).equals(PNG_SIGNATURE)) {
      return null;
    }
    if (header.toString('ascii', 12, 16) !== 'IHDR') {
      return null;
    }
    const width = header.readUInt32BE(16);
    const height = header.readUInt32BE(20);
    if (width <= 0 || height <= 0) {
      return null;
    }
    return { width, height };
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // 閉じられなくても、寸法が取れなかった扱いにするだけ。
      }
    }
  }
}

// public の下の PNG の寸法を返す。外部の URL・無いファイル・PNG でない物・読めない物は null。
export function getPublicImageSize(src: string): ImageSize | null {
  const cached = sizeCache.get(src);
  if (cached !== undefined) {
    return cached;
  }
  const filePath = resolvePublicPngPath(src);
  const size = filePath ? readPngSize(filePath) : null;
  sizeCache.set(src, size);
  return size;
}

// 本文の HTML の <img> に width・height・loading="lazy"・decoding="async" を足す。
// 寸法が分からない画像と、すでに width か height がある画像は、1文字も変えない。
export function addArticleImageDimensions(contentHtml: string): string {
  if (!contentHtml.includes('<img')) {
    return contentHtml;
  }
  return contentHtml.replace(IMG_TAG_PATTERN, (tag) => {
    const srcMatch = tag.match(SRC_PATTERN);
    const src = srcMatch ? (srcMatch[1] ?? srcMatch[2] ?? '') : '';
    if (!src) {
      return tag;
    }
    // 属性の名前だけを見る（alt の文中の "width=" を取り違えない）。
    const attributeNames = tag.replace(QUOTED_VALUE_PATTERN, '""');
    if (/\s(?:width|height)\s*=/i.test(attributeNames)) {
      return tag;
    }
    const size = getPublicImageSize(src);
    if (!size) {
      return tag;
    }
    const additions = [`width="${size.width}"`, `height="${size.height}"`];
    // 本文の画像は表紙より下にある。近づくまで取りに行かない。
    if (!/\sloading\s*=/i.test(attributeNames)) {
      additions.push('loading="lazy"');
    }
    if (!/\sdecoding\s*=/i.test(attributeNames)) {
      additions.push('decoding="async"');
    }
    const selfClosing = tag.endsWith('/>');
    const body = tag.slice(0, selfClosing ? -2 : -1).replace(/\s+$/, '');
    return `${body} ${additions.join(' ')}${selfClosing ? ' />' : '>'}`;
  });
}
