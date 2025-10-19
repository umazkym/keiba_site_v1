import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "プライバシーポリシー | UMA-FREE",
    description: "UMA-FREEのプライバシーポリシーです。個人情報の取り扱い、Cookieの使用、広告配信について詳しく説明しています。",
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
                    {'プライバシーポリシー'}
                </h1>
                
                <div className="space-y-8 text-gray-700 leading-relaxed">
                    <p className="text-sm text-gray-500">{'最終更新日: 2025年10月20日'}</p>
                    
                    <p>
                        {'UMA-FREE（以下「当サイト」といいます。）は、ユーザーの個人情報保護の重要性について認識し、個人情報の保護に関する法律（以下「個人情報保護法」といいます。）を遵守すると共に、以下のプライバシーポリシー（以下「本ポリシー」といいます。）に従い、適切な取扱い及び保護に努めます。'}
                    </p>

                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">{'1. 個人情報の定義'}</h2>
                        <p>
                            {'本ポリシーにおいて「個人情報」とは、個人情報保護法第2条第1項に定める個人情報、すなわち、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日その他の記述等により特定の個人を識別することができるもの（他の情報と容易に照合することができ、それにより特定の個人を識別することができることとなるものを含む。）を指します。'}
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">{'2. 収集する情報と収集方法'}</h2>
                        <h3 className="text-xl font-semibold text-gray-700 mt-4 mb-2">{'2.1 自動的に収集される情報'}</h3>
                        <p>{'当サイトでは、サービスの改善や広告配信のために、以下の情報を自動的に収集することがあります。'}</p>
                        <ul className="list-disc list-inside space-y-2 mt-2">
                            <li>{'IPアドレス'}</li>
                            <li>{'ブラウザの種類、バージョン、言語設定'}</li>
                            <li>{'オペレーティングシステム'}</li>
                            <li>{'アクセス日時、滞在時間'}</li>
                            <li>{'参照元URL'}</li>
                            <li>{'閲覧ページURL'}</li>
                            <li>{'Cookie情報およびそれに類する技術'}</li>
                            <li>{'デバイス情報（PC、スマートフォン、タブレット等）'}</li>
                        </ul>

                        <h3 className="text-xl font-semibold text-gray-700 mt-4 mb-2">{'2.2 お問い合わせ時に収集する情報'}</h3>
                        <p>
                            {'お問い合わせフォームからご連絡いただいた場合、以下の情報を収集することがあります：'}
                        </p>
                        <ul className="list-disc list-inside space-y-2 mt-2">
                            <li>{'お名前（ニックネーム可）'}</li>
                            <li>{'メールアドレス'}</li>
                            <li>{'お問い合わせ内容'}</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">{'3. 情報の利用目的'}</h2>
                        <p>{'収集した情報は、以下の目的で利用いたします：'}</p>
                        <ol className="list-decimal list-inside space-y-2 mt-2">
                            <li>{'本サービスの提供・運営・改善のため'}</li>
                            <li>{'ユーザーからのお問い合わせに対応するため'}</li>
                            <li>{'本サービスに関する重要なお知らせを通知するため'}</li>
                            <li>{'アクセス解析によるサービスの品質向上のため'}</li>
                            <li>{'広告配信の最適化および広告収益の分析のため'}</li>
                            <li>{'不正行為や利用規約違反の防止および対応のため'}</li>
                            <li>{'法令に基づく対応のため'}</li>
                        </ol>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">{'4. 第三者への提供'}</h2>
                        <p>
                            {'当サイトは、以下の場合を除き、収集した個人情報を第三者に提供することはありません：'}
                        </p>
                        <ol className="list-decimal list-inside space-y-2 mt-2">
                            <li>{'ユーザーの同意がある場合'}</li>
                            <li>{'法令に基づく場合'}</li>
                            <li>{'人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難である場合'}</li>
                            <li>{'公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難である場合'}</li>
                            <li>{'国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合'}</li>
                        </ol>
                    </section>
                    
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">{'5. 広告配信について'}</h2>
                        <h3 className="text-xl font-semibold text-gray-700 mt-4 mb-2">{'Google AdSense'}</h3>
                        <p>
                            {'当サイトは、第三者配信の広告サービス「Google AdSense」を利用しています。このような広告配信事業者は、ユーザーの興味に応じた商品やサービスの広告を表示するため、Cookieを使用して当サイトや他サイトへのアクセスに関する情報（氏名、住所、メールアドレス、電話番号は含まれません）を使用することがあります。'}
                        </p>
                        <p className="mt-2">
                            {'このプロセスの詳細やこのような情報が広告配信事業者に使用されないようにする方法については、'}
                            <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{'Googleの広告ポリシー'}</a>{'をご覧ください。'}
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">{'6. アクセス解析ツールについて'}</h2>
                        <h3 className="text-xl font-semibold text-gray-700 mt-4 mb-2">{'Google Analytics'}</h3>
                        <p>
                            {'当サイトでは、Googleによるアクセス解析ツール「Google Analytics」を利用しています。このGoogle Analyticsはトラフィックデータの収集のためにCookieを使用しています。このトラフィックデータは匿名で収集されており、個人を特定するものではありません。'}
                        </p>
                        <p className="mt-2">
                            {'この機能はCookieを無効にすることで収集を拒否することが可能ですので、お使いのブラウザの設定をご確認ください。Google Analyticsの詳細については、'}<a href="https://marketingplatform.google.com/about/analytics/terms/jp/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{'Google Analytics利用規約'}</a>{'をご覧ください。'}
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">{'7. 免責事項'}</h2>
                        <p>
                            {'当サイトからリンクやバナーなどによって他のサイトに移動された場合、移動先サイトで提供される情報、サービス等について一切の責任を負いません。当サイトのコンテンツ・情報につきまして、可能な限り正確な情報を掲載するよう努めておりますが、誤情報が入り込んだり、情報が古くなっていることもございます。当サイトに掲載された内容によって生じた損害等の一切の責任を負いかねますのでご了承ください。'}
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">{'8. プライバシーポリシーの変更'}</h2>
                        <p>
                            {'当サイトは、法令の制定、改正等により、本ポリシーを適宜見直し、予告なく変更する場合があります。本ポリシーの変更は、変更後の本ポリシーが当サイトに掲載された時点で有効になります。'}
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-3">{'9. お問い合わせ窓口'}</h2>
                        <p>
                            {'本ポリシーに関するお問い合わせは、下記の窓口までお願いいたします。'}
                        </p>
                        <div className="mt-2 space-y-1">
                            <p><strong>{'運営者：'}</strong>{'おとうふや'}</p>
                            <p><strong>{'サイト名：'}</strong>{'UMA-FREE'}</p>
                            <p><strong>{'お問い合わせフォーム：'}</strong><a href="/contact" className="text-blue-600 hover:underline">{'こちら'}</a></p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
