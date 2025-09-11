import type { Metadata } from "next";
import Link from 'next/link';

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
            <p>https://uma-free.com</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">運営者</h2>
            <p>おとうふや</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">お問い合わせ</h2>
            <p>
              お問い合わせは、<Link href="/contact" className="text-blue-600 hover:underline">お問い合わせフォーム</Link>よりお願いいたします。
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">プライバシーポリシー</h2>
            <p>
              当サイトのプライバシーポリシーについては、<Link href="/privacy" className="text-blue-600 hover:underline">こちら</Link>をご覧ください。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}