// frontend/app/privacy/page.tsx (既存ファイルを完全に置き換え)
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "プライバシーポリシー | UMA-FREE",
    description: "UMA-FREEのプライバシーポリシーです。個人情報の取り扱いについて詳しく説明しています。",
    robots: {
        index: true,
        follow: true,
    },
};

export default function PrivacyPolicyPage() {
    return (
        <div className="container py-8">
            <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md border">
                <h1 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">
                    プライバシーポリシー
                </h1>
                
                <div className="prose prose-gray max-w-none">
                    <p className="text-sm text-gray-600 mb-6">最終更新日: 2025年1月1日</p>
                    
                    <p className="mb-6">
                        UMA-FREE（以下「当サイト」といいます。）は、ユーザーの個人情報保護の重要性について認識し、
                        個人情報の保護に関する法律（以下「個人情報保護法」といいます。）を遵守すると共に、
                        以下のプライバシーポリシー（以下「本ポリシー」といいます。）に従い、適切な取扱い及び保護に努めます。
                    </p>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">1. 個人情報の定義</h2>
                        <p className="text-gray-700">
                            本ポリシーにおいて「個人情報」とは、個人情報保護法第2条第1項に定める個人情報、
                            すなわち、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日その他の記述等により
                            特定の個人を識別することができるもの（他の情報と容易に照合することができ、それにより特定の個人を
                            識別することができることとなるものを含む。）を指します。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">2. 収集する情報と収集方法</h2>
                        <h3 className="text-xl font-semibold text-gray-700 mt-4 mb-2">2.1 自動的に収集される情報</h3>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                            <li>IPアドレス</li>
                            <li>ブラウザの種類とバージョン</li>
                            <li>オペレーティングシステム</li>
                            <li>アクセス日時</li>
                            <li>参照元URL</li>
                            <li>閲覧ページURL</li>
                            <li>Cookie情報</li>
                            <li>デバイス情報（PC、スマートフォン、タブレット等）</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-gray-700 mt-4 mb-2">2.2 お問い合わせ時に収集する情報</h3>
                        <p className="text-gray-700">
                            お問い合わせフォームからご連絡いただいた場合、以下の情報を収集することがあります：
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                            <li>お名前（ニックネーム可）</li>
                            <li>メールアドレス</li>
                            <li>お問い合わせ内容</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">3. 情報の利用目的</h2>
                        <p className="mb-2">収集した情報は、以下の目的で利用いたします：</p>
                        <ol className="list-decimal list-inside space-y-2 text-gray-700">
                            <li>本サービスの提供・運営・改善</li>
                            <li>ユーザーからのお問い合わせへの対応</li>
                            <li>本サービスに関する重要なお知らせの通知</li>
                            <li>アクセス解析によるサービスの改善</li>
                            <li>不正利用の防止</li>
                            <li>法令に基づく対応</li>
                        </ol>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">4. 第三者への提供</h2>
                        <p className="text-gray-700 mb-4">
                            当サイトは、以下の場合を除き、収集した個人情報を第三者に提供することはありません：
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-gray-700">
                            <li>ユーザーの同意がある場合</li>
                            <li>法令に基づく場合</li>
                            <li>人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難である場合</li>
                            <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難である場合</li>
                            <li>国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合</li>
                        </ol>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">5. Cookieの使用について</h2>
                        <p className="text-gray-700 mb-4">
                            当サイトでは、以下の目的でCookieを使用しています：
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                            <li>ユーザーの利便性向上</li>
                            <li>アクセス解析</li>
                            <li>広告配信の最適化</li>
                        </ul>
                        <p className="text-gray-700">
                            ユーザーは、ブラウザの設定によりCookieの受け取りを拒否することができます。
                            ただし、Cookieを無効にした場合、当サイトの一部機能が利用できなくなる可能性があります。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">6. Google AdSenseについて</h2>
                        <p className="text-gray-700 mb-4">
                            当サイトは、第三者配信の広告サービス「Google AdSense」を利用しています。
                            このような広告配信事業者は、ユーザーの興味に応じた商品やサービスの広告を表示するため、
                            当サイトや他サイトへのアクセスに関する情報（氏名、住所、メールアドレス、電話番号は含まれません）を使用することがあります。
                        </p>
                        <p className="text-gray-700">
                            このプロセスの詳細やこのような情報が広告配信事業者に使用されないようにする方法については、
                            <a href="https://policies.google.com/technologies/ads" 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               className="text-blue-600 hover:underline">
                                 Googleの広告ポリシー
                            </a>
                            をご覧ください。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">7. Google Analyticsについて</h2>
                        <p className="text-gray-700 mb-4">
                            当サイトでは、Googleによるアクセス解析ツール「Google Analytics」を利用しています。
                            このGoogle Analyticsはトラフィックデータの収集のためにCookieを使用しています。
                            このトラフィックデータは匿名で収集されており、個人を特定するものではありません。
                        </p>
                        <p className="text-gray-700">
                            この機能はCookieを無効にすることで収集を拒否することが可能ですので、お使いのブラウザの設定をご確認ください。
                            Google Analyticsの詳細については、
                            <a href="https://marketingplatform.google.com/about/analytics/terms/jp/" 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               className="text-blue-600 hover:underline">
                                 Google Analytics利用規約
                            </a>
                            をご覧ください。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">8. データの保管期間</h2>
                        <p className="text-gray-700">
                            収集した個人情報は、利用目的の達成に必要な期間において適切に保管し、
                            その後は速やかに削除または匿名化処理を行います。
                            ただし、法令により保管が義務付けられている場合は、法令に従った期間保管します。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">9. セキュリティ対策</h2>
                        <p className="text-gray-700">
                            当サイトは、個人情報の漏洩、滅失またはき損の防止その他の個人情報の安全管理のために、
                            必要かつ適切な措置を講じます。ただし、インターネット上での情報送信は100%安全であることを
                            保証することはできませんので、ユーザー自身でも情報の管理にご注意ください。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">10. ユーザーの権利</h2>
                        <p className="mb-2">ユーザーは、自己の個人情報について以下の権利を有します：</p>
                        <ul className="list-disc list-inside space-y-2 text-gray-700">
                            <li>開示請求権：自己の個人情報の開示を求める権利</li>
                            <li>訂正請求権：自己の個人情報の訂正を求める権利</li>
                            <li>削除請求権：自己の個人情報の削除を求める権利</li>
                            <li>利用停止請求権：自己の個人情報の利用停止を求める権利</li>
                        </ul>
                        <p className="text-gray-700 mt-4">
                            これらの請求を行う場合は、本ポリシー末尾に記載のお問い合わせ窓口までご連絡ください。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">11. 未成年者のご利用について</h2>
                        <p className="text-gray-700">
                            当サイトで提供する情報は、日本の法律で定められた成人の利用を想定しています。法律により20歳未満の方の馬券購入等は禁止されております。当サイトは20歳未満の方のご利用を推奨するものではありません。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">12. プライバシーポリシーの変更</h2>
                        <p className="text-gray-700">
                            当サイトは、法令の制定、改正等により、本ポリシーを適宜見直し、予告なく変更する場合があります。
                            本ポリシーの変更は、変更後の本ポリシーが当サイトに掲載された時点で有効になります。
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">13. お問い合わせ窓口</h2>
                        <div>
                            <p className="text-gray-700 mb-2">
                                本ポリシーに関するお問い合わせは、下記の窓口までお願いいたします。
                            </p>
                            <p className="text-gray-700">
                                <strong>運営者：</strong>おとうふや<br/>
                                <strong>サイト名：</strong>UMA-FREE<br/>
                                <strong>お問い合わせフォーム：</strong>
                                <a href="/contact" className="text-blue-600 hover:underline">こちら</a>
                            </p>
                        </div>
                    </section>

                    <div className="mt-8">
                        <p className="text-gray-700">
                            制定日: 2025年9月11日<br/>
                            最終改定日: 2025年10月1日<br/>
                            おとうふや
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}