import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from '@/components/Breadcrumb';

export const metadata: Metadata = {
    title: "お問い合わせ",
    description: "UMA-FREEへのお問い合わせページ。ご質問や不具合のご報告はこちらからお願いします。FAQで解決できる場合もございます。",
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: "お問い合わせ",
        description: "UMA-FREEへのお問い合わせページ。サイトの使い方、データの不具合報告、機能リクエストなどお気軽にご連絡ください。",
    },
    alternates: {
        canonical: '/contact',
    },
};

export default function ContactPage() {
    const googleFormUrl =
        "https://docs.google.com/forms/d/e/1FAIpQLSdSJrPy6vagOLhjcIAGb7D8SaWCCUKHfE7muzpD0ML6dy9p_w/viewform";

    const inquiryTypes = [
        "サイトの使い方について",
        "データの不具合・エラー報告",
        "機能リクエスト・改善提案",
        "広告掲載について",
        "その他ご質問",
    ];

    // --- スタイル定義 ---
    // セクション全体
    const sectionClass = "flex flex-col gap-3 sm:gap-4";
    // セクションタイトル (h2)
    const sectionTitleClass = "text-lg sm:text-2xl font-bold text-gray-800 border-b-2 border-gray-300 pb-2 sm:pb-3";
    // 本文テキスト
    const textBaseClass = "text-gray-700 leading-8 text-base";
    // メインCTAボタン
    const primaryButtonClass = "inline-block bg-primary hover:bg-primary-dark text-white font-bold py-3 md:py-3 px-8 md:px-8 rounded-lg transition-all shadow-md hover:shadow-lg active:shadow-sm text-base md:text-lg min-h-[44px] md:min-h-auto flex items-center justify-center";
    // サブCTAボタン (FAQ)
    const secondaryButtonClass = "inline-block bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 md:py-3 px-8 md:px-8 rounded-lg transition-all active:bg-gray-400 text-base min-h-[44px] md:min-h-auto flex items-center justify-center";
    // --- スタイル定義ここまで ---

    return (
        <>
            <Breadcrumb />
            <div className="py-4 sm:py-8">
                <div className="max-w-4xl mx-auto">
                    {/* セクション間の余白をgap-10に設定 */}
                    <div className="flex flex-col gap-6 sm:gap-10">

                        {/* 1. メインタイトル */}
                        <div>
                            <h1 className="text-2xl sm:text-4xl font-bold text-gray-800 mb-4 sm:mb-6 border-b-2 border-primary pb-3 sm:pb-4">
                                お問い合わせ
                            </h1>
                            <p className={textBaseClass}>
                                サイトに関するご質問、ご意見、不具合のご報告などがございましたら、お気軽にお問い合わせください。
                            </p>
                        </div>

                        {/* 2. メインCTAセクション (最優先) */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>
                                お問い合わせフォーム
                            </h2>
                            <p className={textBaseClass}>
                                ご用の際はこちらのフォームよりご連絡ください。
                            </p>
                            <div className="flex justify-start">
                                <a
                                    href={googleFormUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={primaryButtonClass}
                                    aria-label="お問い合わせフォームを新しいタブで開く"
                                >
                                    お問い合わせフォームを開く
                                </a>
                            </div>
                        </section>

                        {/* 3. FAQセクション (CTAの次に配置) */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>
                                よくある質問 (FAQ)
                            </h2>
                            <p className={textBaseClass}>
                                多くのご質問には、FAQページでお答えしています。お問い合わせの前にご確認いただくと、問題が解決する場合があります。
                            </p>
                            <div className="flex justify-start">
                                <Link
                                    href="/faq"
                                    className={secondaryButtonClass}
                                >
                                    FAQを確認
                                </Link>
                            </div>
                        </section>

                        {/* 4. お問い合わせ種別セクション (h2を追加) */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>
                                主なお問い合わせ内容
                            </h2>
                            <p className={textBaseClass}>
                                以下のようなお問い合わせをお受けしています：
                            </p>
                            {/* セマンティクス向上のため ul/li に変更 (list-decimal) */}
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 list-decimal list-inside marker:text-primary marker:font-bold">
                                {inquiryTypes.map((type) => (
                                    <li key={type} className={`${textBaseClass} ml-2`}>
                                        {type}
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {/* 5. 返信ポリシーセクション (h2を追加) */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>
                                ご返信について
                            </h2>
                            {/* ul/li と flex を組み合わせてレイアウト */}
                            <ul className="flex flex-col gap-3">
                                {[
                                    "お問い合わせいただいた内容に対して、必要に応じてご返事させていただきます。",
                                    "ご返信は入力いただいたメールアドレスに送信されます。",
                                    "スパム判定される場合もございますので、迷惑メールフォルダもご確認ください。",
                                ].map((text, index) => (
                                    <li key={index} className={`${textBaseClass} flex items-start gap-2.5`}>
                                        <span className="text-primary font-bold flex-shrink-0 mt-1.5 text-lg">•</span>
                                        <span>{text}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {/* 6. 個人情報の取り扱いセクション */}
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>個人情報の取り扱い</h2>
                            <p className={textBaseClass}>
                                お問い合わせ時にご入力いただいた個人情報については、サイトの改善とお問い合わせへのご返信にのみ使用いたします。詳細は<Link href="/privacy" className="text-primary hover:underline font-semibold">プライバシーポリシー</Link>をご覧ください。
                            </p>
                        </section>

                    </div>
                </div>
            </div>
        </>
    );
}