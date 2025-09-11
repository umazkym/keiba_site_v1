import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "運営者情報 | ウマFREE",
  robots: "noindex, follow", 
};

export default function AboutPage() {
  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md border">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">
          運営者情報
        </h1>

        <div className="space-y-4 text-gray-700">
          <div>
            <h2 className="text-lg font-semibold">サイト名</h2>
            <p>ウマFREE</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">サイトURL</h2>
            {/* ▼▼▼ 取得したドメインに修正 ▼▼▼ */}
            <p>https://uma-free.com</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">運営者</h2>
            {/* ▼▼▼ あなたの名前またはハンドルネームに修正 ▼▼▼ */}
            <p>[ここにあなたの名前またはハンドルネームを記載]</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">お問い合わせ</h2>
            <p>
              お問い合わせは、<a href="/contact" className="text-blue-600 hover:underline">お問い合わせフォーム</a>よりお願いいたします。
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">プライバシーポリシー</h2>
            <p>
              当サイトのプライバシーポリシーについては、<a href="/privacy" className="text-blue-600 hover:underline">こちら</a>をご覧ください。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}