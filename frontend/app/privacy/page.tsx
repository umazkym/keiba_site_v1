import type { Metadata } from "next";
import { Breadcrumb } from '@/components/Breadcrumb';
import { BreadcrumbSchema } from '@/components/StructuredData';
import { InfoPageShell, PolicySection } from "@/components/InfoPageLayout";

export const metadata: Metadata = {
    title: "プライバシーポリシー",
    description: "UMA-FREEのプライバシーポリシーです。個人情報の取り扱い、Cookieの使用、広告配信について詳しく説明しています。",
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: "プライバシーポリシー",
        description: "UMA-FREEのプライバシーポリシーです。個人情報の取り扱い、Cookieの使用、Google AdSense・アナリティクスによる情報収集について詳しく説明しています。",
    },
    alternates: {
        canonical: '/privacy',
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
    contactInfo?: {
        operator: string;
        siteName: string;
        formLink: string;
    };
};

type PrivacyPolicyContent = {
    title: string;
    lastUpdated: string;
    introduction: string;
    sections: Section[];
};

// プライバシーポリシーコンテンツ定義
const privacyPolicyContent: PrivacyPolicyContent = {
    title: 'プライバシーポリシー',
    lastUpdated: '最終更新日: 2026年6月10日',
    introduction: 'UMA-FREE（以下「当サイト」といいます。）は、ユーザーの個人情報保護の重要性について認識し、個人情報の保護に関する法律（以下「個人情報保護法」といいます。）を遵守すると共に、以下のプライバシーポリシー（以下「本ポリシー」といいます。）に従い、適切な取扱い及び保護に努めます。',
    sections: [
        {
            title: '1. 個人情報の定義',
            content: '本ポリシーにおいて「個人情報」とは、個人情報保護法第2条第1項に定める個人情報、すなわち、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日その他の記述等により特定の個人を識別することができるもの（他の情報と容易に照合することができ、それにより特定の個人を識別することができることとなるものを含む。）を指します。',
        },
        {
            title: '2. 収集する情報と収集方法',
            subsections: [
                {
                    title: '2.1 自動的に収集される情報',
                    intro: '当サイトでは、サービスの改善や広告配信のために、以下の情報を自動的に収集することがあります。',
                    items: [
                        'IPアドレス',
                        'ブラウザの種類、バージョン、言語設定',
                        'オペレーティングシステム',
                        'アクセス日時、滞在時間',
                        '参照元URL',
                        '閲覧ページURL',
                        'クリック、スクロール、ページ内の操作状況',
                        'Cookie情報およびそれに類する技術',
                        'デバイス情報（PC、スマートフォン、タブレット等）',
                    ],
                },
                {
                    title: '2.2 お問い合わせ時に収集する情報',
                    intro: 'お問い合わせフォームからご連絡いただいた場合、以下の情報を収集することがあります：',
                    items: ['お名前（ニックネーム可）', 'メールアドレス', 'お問い合わせ内容'],
                },
            ],
        },
        {
            title: '3. 情報の利用目的',
            intro: '収集した情報は、以下の目的で利用いたします：',
            items: [
                '本サービスの提供・運営・改善のため',
                'ユーザーからのお問い合わせに対応するため',
                '本サービスに関する重要なお知らせを通知するため',
                'アクセス解析によるサービスの品質向上のため',
                '広告配信の最適化および広告収益の分析のため',
                '不正行為や利用規約違反の防止および対応のため',
                '法令に基づく対応のため',
            ],
            isOrdered: true,
        },
        {
            title: '4. 第三者への提供',
            intro: '当サイトは、以下の場合を除き、収集した個人情報を第三者に提供することはありません：',
            items: [
                'ユーザーの同意がある場合',
                '法令に基づく場合',
                '人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難である場合',
                '公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難である場合',
                '国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合',
            ],
            isOrdered: true,
        },
        {
            title: '5. 広告配信について',
            subsections: [
                {
                    title: 'Google AdSense',
                    content: [
                        '当サイトは、第三者配信の広告サービス「Google AdSense」を利用しています。このような広告配信事業者は、ユーザーの興味に応じた商品やサービスの広告を表示するため、Cookieを使用して当サイトや他サイトへのアクセスに関する情報（氏名、住所、メールアドレス、電話番号は含まれません）を使用することがあります。',
                        'このプロセスの詳細やこのような情報が広告配信事業者に使用されないようにする方法については、<a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Googleの広告ポリシー</a>をご覧ください。また、ユーザーは、<a href="https://myadcenter.google.com/" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">広告設定</a>でパーソナライズ広告を無効にすることができます。または、<a href="https://www.aboutads.info/" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">www.aboutads.info</a> にアクセスすれば、パーソナライズ広告に使われる第三者配信事業者の Cookie を無効にすることができます。',
                        '当サイトの広告配信に関する詳細情報は、<a href="/advertising" class="text-primary hover:underline">広告について</a>をご覧ください。',
                    ],
                },
                {
                    title: 'アフィリエイトプログラム',
                    content: [
                        '当サイトでは、商品紹介リンクや外部サービスへの案内リンクにアフィリエイトプログラムを利用する場合があります。リンク先で商品購入、会員登録、サービス利用などが行われた場合、当サイトが紹介料を受け取ることがあります。',
                        'アフィリエイトリンクをクリックした後の情報取得、Cookieの使用、個人情報の取り扱いは、移動先の事業者および提携広告ネットワークのプライバシーポリシーや利用規約に従って行われます。',
                    ],
                },
            ],
        },
        {
            title: '6. アクセス解析ツールについて',
            subsections: [
                {
                    title: 'Google Analytics',
                    content: [
                        '当サイトでは、Googleによるアクセス解析ツール「Google Analytics」を利用しています。このGoogle Analyticsはトラフィックデータの収集のためにCookieを使用しています。このトラフィックデータは匿名で収集されており、個人を特定するものではありません。',
                        'この機能はCookieを無効にすることで収集を拒否することが可能ですので、お使いのブラウザの設定をご確認ください。Google Analyticsの詳細については、<a href="https://marketingplatform.google.com/about/analytics/terms/jp/" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Google Analytics利用規約</a>をご覧ください。',
                    ],
                },
                {
                    title: 'Microsoft Clarity',
                    content: [
                        '当サイトでは、サイト改善および広告配置の検証のため、Microsoft Corporationが提供するアクセス解析ツール「Microsoft Clarity」を利用しています。Microsoft Clarityでは、ページの閲覧状況、クリック、スクロール、操作の流れなどをヒートマップやセッション記録として分析することがあります。',
                        'これらの情報は、ユーザー体験の改善、コンテンツの読みやすさの確認、広告表示位置の適正化を目的として利用します。当サイトは、Microsoft Clarityを通じて氏名、メールアドレス、電話番号などの個人を直接特定する情報を意図して収集しません。Microsoft Clarityの詳細については、<a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Microsoftプライバシーステートメント</a>をご覧ください。',
                    ],
                },
            ],
        },
        {
            title: '7. 免責事項',
            content: '当サイトからリンクやバナーなどによって他のサイトに移動された場合、移動先サイトで提供される情報、サービス等について一切の責任を負いません。当サイトのコンテンツ・情報につきまして、可能な限り正確な情報を掲載するよう努めておりますが、誤情報が入り込んだり、情報が古くなっていることもございます。当サイトに掲載された内容によって生じた損害等の一切の責任を負いかねますのでご了承ください。',
        },
        {
            title: '8. プライバシーポリシーの変更',
            content: '当サイトは、法令の制定、改正等により、本ポリシーを適宜見直し、予告なく変更する場合があります。本ポリシーの変更は、変更後の本ポリシーが当サイトに掲載された時点で有効になります。',
        },
        {
            title: '9. お問い合わせ窓口',
            content: '本ポリシーに関するお問い合わせは、下記の窓口までお願いいたします。',
            contactInfo: {
                operator: 'おとうふや',
                siteName: 'UMA-FREE',
                formLink: '<a href="/contact" class="text-primary hover:underline">こちら</a>',
            },
        },
    ],
};



function HtmlText({ html }: { html: string }) {
    return <p dangerouslySetInnerHTML={{ __html: html }} />;
}

function PolicyContentSection({ section }: { section: Section }) {
    return (
        <PolicySection title={section.title}>
            {section.content && typeof section.content === 'string' && <HtmlText html={section.content} />}

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
                section.isOrdered ? (
                    <ol className="list-decimal space-y-2 pl-5">
                        {section.items.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ol>
                ) : (
                    <ul className="list-disc space-y-2 pl-5">
                        {section.items.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                )
            )}

            {section.contactInfo && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p><strong>運営者: </strong>{section.contactInfo.operator}</p>
                    <p><strong>サイト名: </strong>{section.contactInfo.siteName}</p>
                    <p><strong>お問い合わせフォーム: </strong><span dangerouslySetInnerHTML={{ __html: section.contactInfo.formLink }} /></p>
                </div>
            )}
        </PolicySection>
    );
}

export default function PrivacyPolicyPage() {
    return (
        <>
            <BreadcrumbSchema
                items={[
                    { name: "ホーム", url: "https://uma-free.com" },
                    { name: "プライバシーポリシー", url: "https://uma-free.com/privacy" },
                ]}
            />
            <Breadcrumb />
            <InfoPageShell
                eyebrow="PRIVACY POLICY"
                title={privacyPolicyContent.title}
                updated={privacyPolicyContent.lastUpdated}
                description={privacyPolicyContent.introduction}
            >
                {privacyPolicyContent.sections.map((section) => (
                    <PolicyContentSection key={section.title} section={section} />
                ))}
            </InfoPageShell>
        </>
    );
}
