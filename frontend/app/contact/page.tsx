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
        <div className="container py-8">
            <div className="max-w-4xl mx-auto">
                <div>
                    <h1 className="text-4xl font-bold text-gray-800 mb-6 border-b-3 border-primary pb-4">
                        お問い合わせ
                    </h1>

                    <p className="text-gray-700 mb-6 leading-8">
                        サイトに関するご質問、ご意見、不具合のご報告などがございましたら、以下のボタンをクリックして、お問い合わせフォームへお進みください。
                    </p>

                    <div className="flex justify-start mb-8">
                        <a
                            href={googleFormUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg transition-all shadow-md hover:shadow-lg"
                            aria-label="お問い合わせフォームを新しいタブで開く"
                        >
                            お問い合わせフォームを開く
                        </a>
                    </div>

                    <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-gray-700">
                            ※Googleフォームは別タブで開きます。個人情報の取り扱いについてはプライバシーポリシーをご確認ください。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
