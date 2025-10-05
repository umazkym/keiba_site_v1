import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "お問い合わせ | UMA-FREE",
    robots: {
        index: true,
        follow: true,
    },
};

export default function ContactPage() {
    const googleFormUrl =
        "https://docs.google.com/forms/d/e/1FAIpQLSdSJrPy6vagOLhjcIAGb7D8SaWCCUKHfE7muzpD0ML6dy9p_w/viewform";

    return (
        <div className="container mx-auto my-10 px-4">
            <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md border">
                <h1 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">
                    お問い合わせ
                </h1>

                <p className="text-gray-700 mb-6">
                    サイトに関するご質問、ご意見、不具合のご報告などがございましたら、以下のボタンをクリックして、お問い合わせフォームへお進みください。
                </p>

                <div className="flex justify-start">
                    {/* 控えめなアウトライン風ボタン。サイト内リンクのトーン（青系）に合わせる */}
                    <a
                        href={googleFormUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center text-blue-600 hover:underline border border-gray-200 hover:bg-gray-50 font-medium py-2 px-4 rounded-md transition"
                        aria-label="お問い合わせフォームを新しいタブで開く"
                    >
                        お問い合わせフォームを開く
                    </a>
                </div>

                <p className="text-sm text-gray-500 mt-6">
                    ※Googleフォームは別タブで開きます。個人情報の取り扱いについてはプライバシーポリシーをご確認ください。
                </p>
            </div>
        </div>
    );
}
