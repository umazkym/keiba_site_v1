import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー | ウマFREE",
  robots: "noindex, follow",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md border">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">
          プライバシーポリシー
        </h1>
        <div className="prose prose-sm md:prose-base max-w-none text-gray-700">
          <p>当サイト「ウマFREE」（以下、「当サイト」といいます。）は、ユーザーの個人情報保護の重要性について認識し、個人情報の保護に関する法律（以下、「個人情報保護法」といいます。）を遵守すると共に、以下のプライバシーポリシー（以下、「本ポリシー」といいます。）に従い、適切な取扱い及び保護に努めます。</p>
          <h2 className="text-xl font-bold mt-6 mb-2">広告の配信について</h2>
          <p>当サイトは、第三者配信の広告サービス「Google AdSense」を利用しています。</p>
          <p>このような広告配信事業者は、ユーザーの興味に応じた商品やサービスの広告を表示するため、当サイトや他サイトへのアクセスに関する情報『Cookie』（氏名、住所、メールアドレス、電話番号は含まれません）を使用することがあります。</p>
          <p>またGoogle AdSenseに関して、このプロセスの詳細やこのような情報が広告配信事業者に使用されないようにする方法については、<a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">こちら</a>をクリックしてご確認ください。</p>
          <h2 className="text-xl font-bold mt-6 mb-2">アクセス解析ツールについて</h2>
          <p>当サイトでは、Googleによるアクセス解析ツール「Google Analytics」を利用しています。このGoogle Analyticsはトラフィックデータの収集のためにCookieを使用しています。このトラフィックデータは匿名で収集されており、個人を特定するものではありません。</p>
          <h2 className="text-xl font-bold mt-6 mb-2">免責事項</h2>
          <p>当サイトで掲載している情報の正確性については万全を期しておりますが、その内容の正確性や安全性を保証するものではありません。情報が古くなっていることもございます。当サイトに掲載された内容によって生じた損害等の一切の責任を負いかねますのでご了承ください。</p>
          <h2 className="text-xl font-bold mt-6 mb-2">本ポリシーの変更</h2>
          <p>当サイトは、法令の制定、改正等により、本ポリシーを適宜見直し、予告なく変更する場合があります。本ポリシーの変更は、変更後の本ポリシーが当サイトに掲載された時点、またはその他の方法により変更後の本ポリシーが閲覧可能となった時点で有効になります。</p>
          <p className="mt-8">制定日: 2025年9月11日</p>
        </div>
      </div>
    </div>
  );
}