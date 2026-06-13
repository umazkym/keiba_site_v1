import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { InfoCardLink, InfoPageShell, InfoSection } from "@/components/InfoPageLayout";

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
    canonical: "/contact",
  },
};

const inquiryTypes = [
  "サイトの使い方について",
  "データの不具合・エラー報告",
  "機能リクエスト・改善提案",
  "広告掲載について",
  "その他ご質問",
];

export default function ContactPage() {
  const googleFormUrl =
    "https://docs.google.com/forms/d/e/1FAIpQLSdSJrPy6vagOLhjcIAGb7D8SaWCCUKHfE7muzpD0ML6dy9p_w/viewform";

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "ホーム", url: "https://uma-free.com" },
          { name: "お問い合わせ", url: "https://uma-free.com/contact" },
        ]}
      />
      <Breadcrumb />
      <InfoPageShell
        eyebrow="CONTACT"
        title="お問い合わせ"
        description="サイトに関するご質問、ご意見、不具合のご報告などがございましたら、フォームよりご連絡ください。"
      >
        <InfoSection title="お問い合わせフォーム" tone="notice">
          <p>ご用の際はこちらのフォームよりご連絡ください。内容を確認し、必要に応じてご返信します。</p>
          <a
            href={googleFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-soft transition-colors hover:bg-primary-light"
            aria-label="お問い合わせフォームを新しいタブで開く"
          >
            お問い合わせフォームを開く
          </a>
        </InfoSection>

        <InfoSection title="お問い合わせ前に確認できるページ" tone="soft">
          <div className="grid gap-3 md:grid-cols-3">
            <InfoCardLink href="/faq" title="よくある質問" description="料金、データ更新、モバイル利用などをまとめています。" />
            <InfoCardLink href="/about" title="このサイトについて" description="運営方針や公開データの扱いを確認できます。" />
            <InfoCardLink href="/search" title="サイト内検索" description="記事やデータページをキーワードで探せます。" />
          </div>
        </InfoSection>

        <InfoSection title="主なお問い合わせ内容">
          <ul className="grid gap-3 md:grid-cols-2">
            {inquiryTypes.map((type) => (
              <li key={type} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                {type}
              </li>
            ))}
          </ul>
        </InfoSection>

        <InfoSection title="ご返信と個人情報の取り扱い">
          <p>お問い合わせいただいた内容に対して、必要に応じてご返信します。迷惑メールフォルダに振り分けられる場合もありますので、あわせてご確認ください。</p>
          <p>
            入力いただいた個人情報は、サイトの改善とお問い合わせへの返信にのみ使用します。詳細は
            <Link href="/privacy" className="font-bold text-primary hover:underline">
              プライバシーポリシー
            </Link>
            をご覧ください。
          </p>
        </InfoSection>
      </InfoPageShell>
    </>
  );
}
