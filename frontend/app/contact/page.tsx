import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "お問い合わせ | ウマFREE",
  robots: "noindex, follow",
};

export default function ContactPage() {
  // 無料で作成できるGoogleフォームの埋め込みを推奨します
  // 例: <iframe src="https://docs.google.com/forms/d/e/[あなたのフォームID]/viewform?embedded=true" ...></iframe>
  const googleFormEmbedHtml = `
    <iframe src="[ここにGoogleフォームの埋め込みコードを貼り付け]" width="100%" height="800" frameborder="0" marginheight="0" marginwidth="0">読み込んでいます…</iframe>
  `;

  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md border">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">
          お問い合わせ
        </h1>
        <p className="text-gray-700 mb-6">
          サイトに関するご質問、ご意見、不具合のご報告などがございましたら、以下のフォームよりお気軽にご連絡ください。
        </p>
        <div dangerouslySetInnerHTML={{ __html: googleFormEmbedHtml }} />
      </div>
    </div>
  );
}