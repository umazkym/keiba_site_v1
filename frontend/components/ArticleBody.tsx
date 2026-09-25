import { AdUnit } from '@/components/AdUnit';

type ArticleBodyProps = {
    html: string;
    analyticsPrefix: 'article' | 'entity_article';
};

// 記事本文の文字（2026-09-25 段階5）：本文はスマホ15.5px・PC17px、H2は紺の丸い書体でスマホ20px・PC25px、H3はスマホ17px・PC19px。
// 見出しの上の空き（2026-09-25 スマホの見直し）：スマホは H2 28px（見本 12+16）・H3 20px。段落の間16px・行間1.9は変えない。PCは従来のまま。
// リンクはインディゴの文字に下線（紺の文字だけでは本文と見分けにくい）。表の数字は Barlow で桁をそろえる（globals.css）。
export const ARTICLE_PROSE_CLASS = [
    'article-page-prose prose prose-slate w-full max-w-none',
    '[overflow-wrap:anywhere]',
    'prose-headings:tracking-normal prose-headings:text-slate-900',
    'prose-h2:font-display prose-h2:font-extrabold prose-h2:text-navy prose-h2:text-[20px] prose-h2:leading-[1.45] prose-h2:border-b-2 prose-h2:border-slate-200 prose-h2:pb-2.5 prose-h2:mt-7 prose-h2:mb-4 sm:prose-h2:text-[25px] sm:prose-h2:mt-12 sm:prose-h2:mb-5',
    'prose-h3:font-bold prose-h3:text-[17px] prose-h3:leading-[1.5] prose-h3:mt-5 prose-h3:mb-2 sm:prose-h3:text-[19px] sm:prose-h3:mt-8 sm:prose-h3:mb-2.5',
    'prose-p:text-[15.5px] prose-p:leading-[1.9] prose-p:my-4 prose-p:text-slate-900 sm:prose-p:text-[17px] sm:prose-p:leading-[1.95] sm:prose-p:my-5',
    'prose-a:text-brand-700 prose-a:font-bold prose-a:underline prose-a:decoration-brand-200 prose-a:decoration-2 prose-a:underline-offset-4 hover:prose-a:decoration-brand-600',
    'prose-strong:text-slate-900 prose-strong:font-bold',
    'prose-img:rounded-xl prose-img:border prose-img:border-slate-200 prose-img:my-6',
    'prose-blockquote:border-l-[3px] prose-blockquote:border-brand-300 prose-blockquote:bg-slate-50 prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:my-5 prose-blockquote:not-italic prose-blockquote:font-normal prose-blockquote:text-slate-700 prose-blockquote:text-[15px] sm:prose-blockquote:text-[16px]',
    'prose-code:bg-slate-100 prose-code:text-slate-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none',
    'prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:text-slate-800 prose-pre:rounded-lg prose-pre:my-4 prose-pre:p-3 prose-pre:font-sans prose-pre:text-[14px] prose-pre:leading-[1.7] [&_pre_code]:text-slate-800 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
    'prose-ul:marker:text-slate-500 prose-ol:marker:text-slate-500 prose-ol:marker:font-bold prose-ul:my-4 prose-ol:my-4 prose-li:text-[15.5px] prose-li:leading-[1.85] prose-li:my-1 prose-li:text-slate-900 sm:prose-li:text-[17px]',
    'prose-table:my-0 prose-table:text-[14px] sm:prose-table:text-[15px]',
].join(' ');

const stableArticleAdProps = {
    placement: 'inline' as const,
    minHeight: '280px',
    collapseUnfilled: false,
    lazyRootMargin: '760px 0px 760px 0px',
    refreshRootMarginPx: 720,
    className: 'article-ad-slot',
};

// 目次との間はスマホ16px（最初の段落の上の16pxと重なる）、PCは40px
const ArticlePart = ({ html, first = false }: { html: string; first?: boolean }) => (
    <div
        className={`${ARTICLE_PROSE_CLASS} ${first ? 'mt-4 sm:mt-10' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
    />
);

export function ArticleBody({ html, analyticsPrefix }: ArticleBodyProps) {
    const h2Positions: number[] = [];
    // 「よくある質問」は enhanceArticleHtml が <section class="article-faq"> で包む。その中のH2では切らず、section の前で切る
    const searchRegex = /<section class="article-faq[^"]*"[^>]*>\s*<h2[\s>]|<h2[\s>]/gi;
    let match: RegExpExecArray | null;
    while ((match = searchRegex.exec(html)) !== null) {
        h2Positions.push(match.index);
    }

    const afterIntroPlacement = `${analyticsPrefix}_after_intro`;
    const midPlacement = `${analyticsPrefix}_mid`;
    const midLongPlacement = `${analyticsPrefix}_mid_long`;
    const isLongArticle = html.length >= 6000;

    if (h2Positions.length >= 7 || (h2Positions.length >= 4 && isLongArticle)) {
        const split1 = h2Positions[1];
        const split2 = h2Positions.length >= 7 ? h2Positions[4] : h2Positions[Math.min(3, h2Positions.length - 1)];
        return (
            <>
                <ArticlePart html={html.substring(0, split1)} first />
                <AdUnit slot="1489598374" analyticsPlacement={afterIntroPlacement} {...stableArticleAdProps} />
                <ArticlePart html={html.substring(split1, split2)} />
                <AdUnit
                    slot="9407670747"
                    analyticsPlacement={h2Positions.length >= 7 ? midPlacement : midLongPlacement}
                    {...stableArticleAdProps}
                />
                <ArticlePart html={html.substring(split2)} />
            </>
        );
    }

    if (h2Positions.length >= 4) {
        const splitPosition = h2Positions[1];
        return (
            <>
                <ArticlePart html={html.substring(0, splitPosition)} first />
                <AdUnit slot="1489598374" analyticsPlacement={afterIntroPlacement} {...stableArticleAdProps} />
                <ArticlePart html={html.substring(splitPosition)} />
            </>
        );
    }

    return <ArticlePart html={html} first />;
}
