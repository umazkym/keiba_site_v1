import { AdUnit } from '@/components/AdUnit';

type ArticleBodyProps = {
    html: string;
    analyticsPrefix: 'article' | 'entity_article';
};

export const ARTICLE_PROSE_CLASS = [
    'article-page-prose prose prose-slate w-full max-w-none',
    '[overflow-wrap:anywhere]',
    'prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900',
    'prose-h2:text-[16px] prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-1 prose-h2:mt-3.5 prose-h2:mb-[5px] prose-h2:scroll-mt-20 sm:prose-h2:text-xl sm:prose-h2:mt-6 sm:prose-h2:mb-3 sm:prose-h2:pb-1.5',
    'prose-h3:text-[14px] prose-h3:mt-2.5 prose-h3:mb-1 sm:prose-h3:text-lg sm:prose-h3:mt-4 sm:prose-h3:mb-1.5',
    'prose-p:text-[12px] prose-p:leading-[1.65] prose-p:my-1.5 prose-p:text-slate-700 sm:prose-p:text-sm sm:prose-p:leading-relaxed sm:prose-p:my-3 sm:prose-p:text-slate-600',
    'prose-a:text-primary prose-a:font-semibold prose-a:no-underline hover:prose-a:text-blue-600',
    'prose-strong:text-slate-900 prose-strong:font-bold',
    'prose-img:border prose-img:border-slate-100 prose-img:my-1.5',
    'prose-blockquote:border-l-2 prose-blockquote:border-slate-300 prose-blockquote:bg-slate-50 prose-blockquote:py-2 prose-blockquote:px-2.5 prose-blockquote:my-2 prose-blockquote:not-italic prose-blockquote:text-slate-700 prose-blockquote:text-[12px]',
    'prose-code:bg-slate-100 prose-code:text-slate-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-[11px] prose-code:before:content-none prose-code:after:content-none',
    'prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:text-slate-800 prose-pre:rounded-lg prose-pre:my-2 prose-pre:p-2.5 prose-pre:font-sans prose-pre:text-[12px] prose-pre:leading-[1.65] [&_pre_code]:text-slate-800 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
    'prose-ul:marker:text-slate-400 prose-ol:marker:text-slate-400 prose-ol:marker:font-bold prose-ul:my-1.5 prose-ol:my-1.5 prose-li:text-[12px] prose-li:my-0.5 sm:prose-li:text-sm',
    'prose-table:my-2 prose-table:text-[11px]',
].join(' ');

const stableArticleAdProps = {
    placement: 'inline' as const,
    minHeight: '280px',
    collapseUnfilled: false,
    lazyRootMargin: '760px 0px 760px 0px',
    refreshRootMarginPx: 720,
    className: 'article-ad-slot',
};

const ArticlePart = ({ html, first = false }: { html: string; first?: boolean }) => (
    <div
        className={`${ARTICLE_PROSE_CLASS} ${first ? 'mt-3.5 sm:mt-8' : ''} sm:prose-lg`}
        dangerouslySetInnerHTML={{ __html: html }}
    />
);

export function ArticleBody({ html, analyticsPrefix }: ArticleBodyProps) {
    const h2Positions: number[] = [];
    const searchRegex = /<h2[\s>]/gi;
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
