import type { Metadata } from "next";
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { InfoPageShell, PolicySection } from "@/components/InfoPageLayout";

export const metadata: Metadata = {
    title: "広告について",
    description: "UMA-FREEで配信している広告についての説明です。Google AdSenseなどの広告配信方法、Cookie使用、個人情報の取り扱いについて詳しく解説しています。",
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: "広告について",
        description: "UMA-FREEの広告配信ポリシー。Google AdSenseによる広告配信、Cookie技術の使用、オプトアウト方法について説明しています。",
    },
    alternates: {
        canonical: '/advertising',
    },
};

// 型定義
type Subsection = {
    title: string;
    intro?: string;
    items?: string[];
    content?: string[];
};

type Section = {
    title: string;
    content?: string;
    intro?: string;
    items?: string[];
    isOrdered?: boolean;
    subsections?: Subsection[];
};

type AdvertisingContent = {
    title: string;
    lastUpdated: string;
    introduction: string;
    sections: Section[];
};

const advertisingContent: AdvertisingContent = {
    title: "広告について",
    lastUpdated: "最終更新日: 2026年6月10日",
    introduction: "UMA-FREE（以下「当サイト」といいます。）は、サイト運営費用をまかなうため、第三者配信の広告サービスを利用しています。このページでは、当サイトで配信している広告についての詳細をご説明します。",
    sections: [
        {
            title: "1. 広告配信について",
            content: "当サイトは、複数の広告配信ネットワークを通じて、ユーザーの興味・関心に基づいた広告を配信しています。これらの広告は、ユーザーの行動パターンやアクセス情報に基づいてカスタマイズされることがあります。",
        },
        {
            title: "2. Google AdSenseについて",
            subsections: [
                {
                    title: "2.1 概要",
                    content: [
                        "当サイトは、Google Inc.（以下「Google」）の広告配信サービス「Google AdSense」を利用しています。",
                        "Google AdSenseは、ユーザーの興味に応じた商品やサービスの広告を表示するため、Cookie技術を使用して、当サイトおよび他のサイトへのアクセス情報を利用することがあります。",
                        "このプロセスでは、ユーザーの氏名、住所、メールアドレス、電話番号などの個人を直接特定できる情報は使用されません。",
                    ],
                },
                {
                    title: "2.2 Cookie技術について",
                    content: [
                        "Cookieは、ウェブサイトを訪問する際にブラウザに保存される小さなファイルです。",
                        "Google AdSenseが使用するCookieにより、ユーザーが過去に訪問したサイトや検索した内容に基づいて、より関連性の高い広告が表示されるようになります。",
                        "ユーザーは、ブラウザの設定を変更することで、Cookieの受け入れを拒否することができます。ただし、Cookieを無効にすると、一部のウェブサイト機能が正常に動作しないことがあります。",
                    ],
                },
                {
                    title: "2.3 広告のパーソナライゼーション制御",
                    content: [
                        "ユーザーは、Google広告の個人設定からGoogleが表示する広告をコントロールできます。",
                        "詳細については、<a href=\"https://policies.google.com/technologies/ads\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-primary hover:underline\">Google広告に関するポリシー</a>をご覧ください。",
                        "また、<a href=\"https://myaccount.google.com/\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-primary hover:underline\">Googleアカウントの設定</a>から、広告のパーソナライゼーションを無効にすることもできます。",
                    ],
                },
            ],
        },
        {
            title: "3. アフィリエイト広告について",
            content: "当サイトでは、商品紹介リンクや投票サイトへの案内リンクなどにアフィリエイト広告を利用する場合があります。リンク先で商品購入、会員登録、サービス利用などが行われた場合、当サイトが紹介料を受け取ることがあります。楽天競馬など外部サービスへの案内リンクは、広告枠内に「PR」などの表示を行い、通常の分析コンテンツと区別できるよう努めます。",
        },
        {
            title: "4. その他の広告配信サービス",
            content: "当サイトでは、Google AdSense以外の広告配信ネットワークも利用する可能性があります。これらの配信事業者は、ユーザーの興味に基づいた広告を表示するため、同様にCookieおよび同等のトラッキング技術を使用することがあります。",
        },
        {
            title: "5. ユーザーのプライバシー保護",
            subsections: [
                {
                    title: "4.1 個人情報の非収集",
                    content: [
                        "広告配信事業者は、ユーザーを直接的に特定できる情報（名前、住所、メールアドレス、電話番号など）を収集・使用することはありません。",
                        "すべての情報収集は、匿名またはデータの集約形式で行われます。",
                    ],
                },
                {
                    title: "4.2 ユーザーのプライバシー保護措置",
                    items: [
                        "すべての広告配信事業者は、国際的なプライバシー保護規制に準拠しています",
                        "ユーザーのブラウザ設定により、Cookieを無効化できます",
                        "広告のパーソナライゼーションをオフにできます",
                        "当サイトを離れてもユーザーのプライバシーは保護されています",
                    ],
                },
            ],
        },
        {
            title: "6. オプトアウト方法",
            subsections: [
                {
                    title: "5.1 Google AdSenseからのオプトアウト",
                    content: [
                        "ユーザーは、<a href=\"https://adssettings.google.com\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-primary hover:underline\">Google広告設定ページ</a>を訪問することで、Google AdSenseによるパーソナライズド広告を無効にできます。",
                        "このページでは、ユーザーが見る広告について、Googleが推測している興味・関心を確認・管理できます。",
                    ],
                },
                {
                    title: "5.2 Network Advertising Initiative（NAI）",
                    content: [
                        "<a href=\"https://optout.networkadvertising.org/\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-primary hover:underline\">NAI Opt-out Tool</a>を使用することで、複数の広告配信ネットワークのパーソナライズド広告を一括で無効にできます。",
                    ],
                },
                {
                    title: "5.3 ブラウザの設定",
                    content: [
                        "ユーザーは、ブラウザの設定を変更することで、すべてのCookieを拒否することができます。",
                        "設定方法はブラウザの種類により異なります。詳細はブラウザのヘルプセクションを参照してください。",
                    ],
                },
            ],
        },
        {
            title: "7. 広告収益について",
            content: "当サイトで表示される広告から得られた収益は、サイトの運営費用（サーバー維持費、ドメイン代、コンテンツ制作費など）に充てられます。これにより、ユーザーが無料でサービスを利用できる環境が実現されています。",
        },
        {
            title: "8. 広告とコンテンツの分離",
            content: "当サイトのコンテンツ（記事、データ、分析など）は、広告配信事業者による影響を受けません。広告配信事業者が当サイトのコンテンツを編集、監督、または管理することはありません。当サイトのすべてのコンテンツは、独立した判断で作成・公開されています。",
        },
        {
            title: "9. 広告に関する苦情とお問い合わせ",
            content: "広告に関するご質問やご不明な点がある場合は、当サイトの<a href=\"/contact\" class=\"text-primary hover:underline\">お問い合わせフォーム</a>までお気軽にご連絡ください。",
        },
        {
            title: "10. 本ポリシーの変更",
            content: "当サイトは、広告配信方法やプライバシー法の変更に伴い、本ポリシーを予告なく変更する場合があります。本ポリシーの最新版は常にこのページに掲載されています。定期的にご確認ください。",
        },
        {
            title: "11. プライバシーポリシーとの関連性",
            content: "当サイトの広告配信に関する詳細情報は、当サイトの<a href=\"/privacy\" class=\"text-primary hover:underline\">プライバシーポリシー</a>にも記載されています。個人情報の取り扱いについては、プライバシーポリシーをご覧ください。",
        },
    ],
};

function HtmlText({ html }: { html: string }) {
    return <p dangerouslySetInnerHTML={{ __html: html }} />;
}

function AdvertisingContentSection({ section }: { section: Section }) {
    return (
        <PolicySection title={section.title}>
            {section.content && typeof section.content === "string" && <HtmlText html={section.content} />}
            {section.intro && <p>{section.intro}</p>}

            {section.subsections?.map((subsection) => (
                <div key={subsection.title} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <h3 className="text-base font-black text-slate-900 sm:text-lg">{subsection.title}</h3>
                    {subsection.intro && <p className="mt-2">{subsection.intro}</p>}
                    {Array.isArray(subsection.content) &&
                        subsection.content.map((p) => <HtmlText key={p} html={p} />)}
                    {subsection.items && (
                        <ul className="mt-3 list-disc space-y-2 pl-5">
                            {subsection.items.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    )}
                </div>
            ))}

            {section.items && (
                <ul className="list-disc space-y-2 pl-5">
                    {section.items.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            )}
        </PolicySection>
    );
}

export default function AdvertisingPage() {
    return (
        <>
            <BreadcrumbSchema
                items={[
                    { name: "ホーム", url: "https://uma-free.com" },
                    { name: "広告について", url: "https://uma-free.com/advertising" },
                ]}
            />
            <Breadcrumb />
            <InfoPageShell
                eyebrow="AD POLICY"
                title={advertisingContent.title}
                updated={advertisingContent.lastUpdated}
                description={advertisingContent.introduction}
            >
                {advertisingContent.sections.map((section) => (
                    <AdvertisingContentSection key={section.title} section={section} />
                ))}
            </InfoPageShell>
        </>
    );
}
