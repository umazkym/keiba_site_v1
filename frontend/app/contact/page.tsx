import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "お問い合わせ | UMA-FREE",
  robots: "noindex, follow",
};

export default function ContactPage() {
  // ▼▼▼▼▼ Googleフォームの「送信」ボタンから「リンク」タブで取得したURLを貼り付け ▼▼▼▼▼
  const googleFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdSJrPy6vagOLhjcIAGb7D8SaWCCUKHfE7muzpD0ML6dy9p_w/viewform";
  // ▲▲▲▲▲ ここまで ▲▲▲▲▲

  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md border text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">
          お問い合わせ
        </h1>
        <p className="text-gray-700 mb-8 text-left">
          サイトに関するご質問、ご意見、不具合のご報告などがございましたら、以下のボタンをクリックして、お問い合わせフォームへお進みください。
        </p>
        
        {/* ▼▼▼▼▼ 埋め込みからリンクボタンに変更 ▼▼▼▼▼ */}
        <a
          href={googleFormUrl}
          target="_blank" // 新しいタブでフォームを開く
          rel="noopener noreferrer" // セキュリティ対策
          className="inline-block bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 text-lg"
        >
          お問い合わせフォームを開く
        </a>
        {/* ▲▲▲▲▲ ここまで ▲▲▲▲▲ */}

      </div>
    </div>
  );
}