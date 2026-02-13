import type { Metadata } from "next";
import { Breadcrumb } from '@/components/Breadcrumb';

export const metadata: Metadata = {
    title: "利用規約",
    description: "UMA-FREEの利用規約です。サービス利用時のルール、免責事項、ユーザーの責任や禁止事項について詳しく説明しています。",
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: "利用規約",
        description: "UMA-FREEの利用規約。サービス利用のルール、免責事項、ユーザーの責任、禁止事項、知的財産権について詳しく定めています。",
    },
    alternates: {
        canonical: '/terms',
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

type TermsOfServiceContent = {
    title: string;
    lastUpdated: string;
    introduction: string;
    sections: Section[];
};

// 利用規約コンテンツ定義
const termsOfServiceContent: TermsOfServiceContent = {
    title: '利用規約',
    lastUpdated: '最終更新日: 2025年10月21日',
    introduction: 'UMA-FREE（以下「当サイト」といいます。）をご利用いただく際には、以下の利用規約（以下「本規約」といいます。）に同意していただく必要があります。本規約を読んで、その内容に同意していただけない場合は、当サイトのご利用をお控えくださいますようお願いいたします。',
    sections: [
        {
            title: '1. サービス概要',
            subsections: [
                {
                    title: '1.1 サービス内容',
                    content: [
                        '当サイトは、AI技術を用いた競馬データ分析と予想情報を無料で提供するサイトです。当サイトで提供される情報は、あくまで参考情報であり、投票の推奨や保証を行うものではありません。',
                    ],
                },
                {
                    title: '1.2 無料提供',
                    content: [
                        '当サイトは基本的に無料でご利用いただけます。ただし、将来的に有料サービスを追加する可能性があります。その場合は、事前に利用者に通知いたします。',
                    ],
                },
            ],
        },
        {
            title: '2. ユーザーの責任と義務',
            intro: 'ユーザーは本サービスを利用する際、以下の事項を遵守してください：',
            items: [
                '本サービスは情報提供目的であり、投票の推奨ではないことを理解し、投票判断は自己責任で行うこと',
                '当サイトで提供される情報に基づいて生じた損失や損害について、当サイトは一切の責任を負わないことを理解すること',
                '本サービスをご利用いただく際は、日本の関連法令を遵守すること',
                '満18歳以上であること（競馬投票は20歳以上が対象ですが、情報閲覧は18歳以上を対象としています）',
                '適切で安全な環境からアクセスすること',
            ],
            isOrdered: true,
        },
        {
            title: '3. 禁止事項',
            intro: '当サイトの利用にあたり、以下の行為は禁止いたします：',
            items: [
                '違法行為に該当するまたはそのおそれのある行為',
                'サイトの運営を妨害する行為',
                '他のユーザーに対する迷惑・嫌がらせ・脅迫行為',
                'コンテンツの無断複製、転載、改ざん、逆アセンブル等',
                'スクレイピング、クローリング、ボットプログラム等による自動的なアクセス（ただし、Googleなどの検索エンジンボットは除く）',
                'ウイルス、ワーム、マルウェアなどの有害プログラムの送信',
                'フィッシング、その他の詐欺行為',
                '他人の個人情報の不正入力・流用',
                'サイトの脆弱性を意図的に利用する行為',
                '過度なアクセスやリクエストによるサーバーへの負荷',
                'その他、当サイトが不適切と判断する行為',
            ],
            isOrdered: true,
        },
        {
            title: '4. 提供情報の信頼性と免責',
            subsections: [
                {
                    title: '4.1 情報の正確性',
                    content: [
                        '当サイトは提供する情報の正確性に努めておりますが、その正確性、完全性、有用性等を保証するものではありません。',
                        '提供する予想やデータは過去の実績に基づいた統計分析ですが、将来の結果を保証するものではありません。',
                    ],
                },
                {
                    title: '4.2 免責事項',
                    content: [
                        '当サイトの情報を利用して発生した損失、損害、その他何らかの不利益については、当サイト、運営者、コンテンツ提供者は一切の責任を負いません。',
                        '当サイトで提供されるAI予想は参考情報であり、投票を保証・推奨するものではありません。投票に伴う損失は全てユーザーの自己責任となります。',
                        '競馬はギャンブルであり、予想に基づいて投票しても予想が外れることがあります。',
                        'システムメンテナンス等により、当サイトの利用が一時的に不可能になる場合があります。',
                    ],
                },
                {
                    title: '4.3 ギャンブル依存症についての注意',
                    content: [
                        '競馬への投票は自らの判断と責任において、無理のない範囲で楽しみのひとつとしてください。',
                        'ギャンブル依存症が疑われる場合は、速やかに専門家や相談機関にご相談ください。',
                        '競馬中央会、地方競馬全国協会等で相談窓口が設置されています。',
                    ],
                },
            ],
        },
        {
            title: '5. 知的財産権',
            subsections: [
                {
                    title: '5.1 著作権',
                    content: [
                        '当サイトで提供されるコンテンツ（テキスト、画像、分析データ等）の著作権は、当サイト運営者またはコンテンツ提供者に帰属します。',
                    ],
                },
                {
                    title: '5.2 利用制限',
                    content: [
                        'ユーザーは、個人的で非営利的な範囲内でのみ、当サイトのコンテンツを利用できます。',
                        'コンテンツの無断複製、転載、改ざん、販売、配布等は禁止です。',
                        '当サイトの内容をブログやSNSで引用する場合は、出典を明記してください。',
                    ],
                },
            ],
        },
        {
            title: '6. 外部リンクについて',
            content: '当サイトから他のウェブサイトへのリンクを提供している場合があります。リンク先のサイトについて、当サイトは管理下にないため、その内容、サービス、セキュリティ等については一切の責任を負いません。リンク先での損失や損害についても責任を負いかねます。',
        },
        {
            title: '7. サイトの変更・停止',
            content: '当サイトは、予告なく、サイトの全部または一部の変更、提供の中止、一時的な停止等を行う場合があります。これらにより生じた損失や損害についても責任を負いかねますので、予めご了承ください。',
        },
        {
            title: '8. 個人情報の取扱い',
            content: '個人情報の取扱いについては、別途「プライバシーポリシー」をご参照ください。当サイトにお問い合わせをいただいた場合の個人情報は、お問い合わせへの対応にのみ使用いたします。',
        },
        {
            title: '9. 利用規約の変更',
            content: '当サイトは、法令の制定・改正等により、本規約を適宜見直し、予告なく変更する場合があります。本規約の変更は、変更後の本規約が当サイトに掲載された時点で有効になります。ご不明な点は、変更後の規約を確認してください。',
        },
        {
            title: '10. 準拠法と管轄裁判所',
            subsections: [
                {
                    title: '10.1 準拠法',
                    content: [
                        '本規約は、日本国の法律に準拠します。',
                    ],
                },
                {
                    title: '10.2 管轄裁判所',
                    content: [
                        '本規約に関する紛争が生じた場合、東京地方裁判所を第一審の管轄裁判所とします。',
                    ],
                },
            ],
        },
        {
            title: '11. その他',
            subsections: [
                {
                    title: '11.1 分離可能性',
                    content: [
                        '本規約の一部が無効と判断されても、その他の条項は有効に存続するものとします。',
                    ],
                },
                {
                    title: '11.2 通知',
                    content: [
                        '本規約に関する通知は、当サイトに掲載する方法によって行います。',
                    ],
                },
            ],
        },
        {
            title: '12. お問い合わせ',
            content: '本規約に関するご質問やご指摘については、下記の窓口までお問い合わせください。',
            contactInfo: {
                operator: 'おとうふや',
                siteName: 'UMA-FREE',
                formLink: '<a href="/contact" class="text-primary hover:underline">こちら</a>',
            },
        },
    ],
};



export default function TermsOfServicePage() {
    return (
        <>
            <Breadcrumb />
            <div className="container py-8">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-6 border-b-2 border-primary pb-4">{termsOfServiceContent.title}</h1>
                    <div className="flex flex-col gap-8 text-gray-700 leading-8">
                        <p className="text-sm text-gray-500">{termsOfServiceContent.lastUpdated}</p>
                        <p className="text-base">{termsOfServiceContent.introduction}</p>
                        {termsOfServiceContent.sections.map((section, index) => (
                            <section key={index} className="flex flex-col gap-4">
                                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mt-6 mb-2 border-b-2 border-gray-300 pb-3">{section.title}</h2>

                                {section.content && typeof section.content === 'string' && (
                                    <p className="text-base" dangerouslySetInnerHTML={{ __html: section.content }} />
                                )}

                                {section.intro && (
                                    <p className="text-base">{section.intro}</p>
                                )}

                                {section.subsections?.map((subsection, subIndex) => (
                                    <div key={subIndex} className="flex flex-col gap-3">
                                        <h3 className="text-xl font-bold text-gray-700 mt-4 mb-1">{subsection.title}</h3>
                                        {subsection.intro && <p className="text-base">{subsection.intro}</p>}
                                        {Array.isArray(subsection.content) ? (
                                            subsection.content.map((p, pIndex) => (
                                                <p key={pIndex} className="mt-2 text-base" dangerouslySetInnerHTML={{ __html: p }} />
                                            ))
                                        ) : (
                                            subsection.items && (
                                                <ul className="list-disc list-inside flex flex-col gap-2 mt-2">
                                                    {subsection.items.map((item, itemIndex) => (
                                                        <li key={itemIndex} className="text-base">{item}</li>
                                                    ))}
                                                </ul>
                                            )
                                        )}
                                    </div>
                                ))}

                                {section.items && (
                                    section.isOrdered ? (
                                        <ol className="list-decimal list-inside flex flex-col gap-2 mt-2">
                                            {section.items.map((item, itemIndex) => (
                                                <li key={itemIndex} className="text-base">{item}</li>
                                            ))}
                                        </ol>
                                    ) : (
                                        <ul className="list-disc list-inside flex flex-col gap-2 mt-2">
                                            {section.items.map((item, itemIndex) => (
                                                <li key={itemIndex} className="text-base">{item}</li>
                                            ))}
                                        </ul>
                                    )
                                )}

                                {section.contactInfo && (
                                    <div className="flex flex-col gap-2 mt-3">
                                        <p className="text-base"><strong>{'運営者：'}</strong>{section.contactInfo.operator}</p>
                                        <p className="text-base"><strong>{'サイト名：'}</strong>{section.contactInfo.siteName}</p>
                                        <p className="text-base"><strong>{'お問い合わせフォーム：'}</strong><span dangerouslySetInnerHTML={{ __html: section.contactInfo.formLink }} /></p>
                                    </div>
                                )}
                            </section>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
