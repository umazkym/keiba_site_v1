// frontend/app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
    return (
        <div className="container py-16">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md border text-center">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">
                    404 - ページが見つかりません
                </h1>
                <p className="text-gray-700 mb-8">
                    お探しのページは存在しないか、移動した可能性があります。
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center justify-center text-blue-600 border border-gray-200 hover:bg-gray-50 hover:underline font-medium py-2 px-6 rounded-md transition"
                >
                    トップページへ戻る
                </Link>
            </div>
        </div>
    );
}
