// Server Component - 構造化データはSSR時にHTMLに直接含める必要がある
// 'use client' と next/script の strategy="afterInteractive" は使用しない

/**
 * 組織情報のSchema.org構造化データ
 * このコンポーネントはサイト全体で1度だけ使用
 */
export function OrganizationSchema() {
    const organizationSchema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "UMA-FREE",
        "url": "https://uma-free.com",
        "logo": "https://uma-free.com/new-logo.png",
        "description": "競馬レースの統計分析データを無料で提供するデータ分析サイト。中央・地方競馬の全レースのAI偏差値・対戦成績・枠順分析を公開しています。",
        "sameAs": ["https://x.com/umafree_ai"],
        "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "General",
            "url": "https://uma-free.com/contact"
        },
        "founder": {
            "@type": "Person",
            "name": "おとうふや",
            "url": "https://uma-free.com/about"
        },
        "foundingDate": "2025-09-11"
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(organizationSchema)
            }}
        />
    );
}

/**
 * WebSiteスキーマ：サイト検索機能とクエリの関連性情報
 */
export function WebsiteSchema() {
    const websiteSchema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "url": "https://uma-free.com",
        "name": "UMA-FREE",
        "description": "競馬データ分析・統計情報サイト",
        "potentialAction": {
            "@type": "SearchAction",
            "target": {
                "@type": "EntryPoint",
                "urlTemplate": "https://uma-free.com/search?q={search_term_string}"
            },
            "query-input": "required name=search_term_string"
        }
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(websiteSchema)
            }}
        />
    );
}

/**
 * 記事ページ用のArticleスキーマ
 * @param title 記事タイトル
 * @param description 記事説明
 * @param url 記事URL
 * @param datePublished 公開日（ISO 8601形式）
 * @param dateModified 更新日（ISO 8601形式）
 * @param image 記事画像URL
 */
export function ArticleSchema({
    title,
    description,
    url,
    datePublished,
    dateModified,
    image
}: {
    title: string;
    description: string;
    url: string;
    datePublished: string;
    dateModified: string;
    image?: string;
}) {
    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": title,
        "description": description,
        "url": url,
        "datePublished": datePublished,
        "dateModified": dateModified,
        "author": {
            "@type": "Person",
            "name": "おとうふや",
            "url": "https://uma-free.com/about"
        },
        "publisher": {
            "@type": "Organization",
            "name": "UMA-FREE",
            "logo": {
                "@type": "ImageObject",
                "url": "https://uma-free.com/new-logo.png"
            }
        },
        ...(image && {
            "image": {
                "@type": "ImageObject",
                "url": image,
                "width": 1200,
                "height": 630
            }
        })
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(articleSchema)
            }}
        />
    );
}

/**
 * BreadcrumbListスキーマ
 * @param items パンくずリストアイテム [{name: string, url: string}, ...]
 */
export function BreadcrumbSchema({ items }: { items: Array<{ name: string; url: string }> }) {
    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": items.map((item, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": item.name,
            "item": item.url
        }))
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(breadcrumbSchema)
            }}
        />
    );
}

/**
 * FAQPageスキーマ
 * @param faqs FAQ配列 [{question: string, answer: string}, ...]
 */
export function FAQSchema({ faqs }: { faqs: Array<{ question: string; answer: string }> }) {
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs.map(item => ({
            "@type": "Question",
            "name": item.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": item.answer
            }
        }))
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(faqSchema)
            }}
        />
    );
}

/**
 * SoftwareApplicationスキーマ（AI予測サービスの説明）
 */
export function SoftwareApplicationSchema() {
    const today = new Date();
    const validFromDate = today.toISOString().split('T')[0];

    const appSchema = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "UMA-FREE AI 競馬データ分析システム",
        "description": "機械学習を用いた競馬データ分析。中央・地方競馬の全レースの偏差値・対戦成績・枠順傾向を無料で提供。",
        "applicationCategory": "Sports",
        "operatingSystem": "Web",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "JPY",
            "availability": "https://schema.org/InStock",
            "validFrom": validFromDate
        },
        "author": {
            "@type": "Person",
            "name": "おとうふや"
        },
        "URL": "https://uma-free.com"
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(appSchema)
            }}
        />
    );
}
