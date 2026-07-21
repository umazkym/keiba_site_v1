import { AdUnit } from '@/components/AdUnit';

type ArticleBodyProps = {
    html: string;
    analyticsPrefix: 'article' | 'entity_article';
};

export const ARTICLE_PROSE_CLASS = [
    'article-page-prose prose prose-slate w-full max-w-none',
    '[overflow-wrap:anywhere]',
    'prose-headings:font-black prose-headings:tracking-tight prose-headings:text-slate-900',
    'prose-h2:text-xl prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-2 prose-h2:mt-8 prose-h2:mb-3 prose-h2:scroll-mt-20 sm:prose-h2:text-2xl sm:prose-h2:mt-12 sm:prose-h2:mb-6',
    'prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2 sm:prose-h3:text-xl sm:prose-h3:mt-8 sm:prose-h3:mb-3',
    'prose-p:leading-[1.78] prose-p:text-slate-600 sm:prose-p:leading-[1.9]',
    'prose-a:text-primary prose-a:font-semibold prose-a:no-underline hover:prose-a:text-blue-600',
    'prose-strong:text-slate-900 prose-strong:font-bold',
    'prose-img:border prose-img:border-slate-100',
    'prose-blockquote:border-l-4 prose-blockquote:border-slate-300 prose-blockquote:bg-slate-50 prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:not-italic prose-blockquote:text-slate-700',
    'prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-slate-800 prose-code:font-mono prose-code:text-sm',
    'prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl',
    'prose-ul:marker:text-slate-400 prose-ol:marker:text-slate-400 prose-ol:marker:font-bold',
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
        className={`${ARTICLE_PROSE_CLASS} ${first ? 'mt-5 sm:mt-8' : ''} sm:prose-lg`}
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

