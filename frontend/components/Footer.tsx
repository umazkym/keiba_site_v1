import Link from 'next/link';

export const Footer = () => {
    return (
      <footer className="bg-gray-200 text-center py-4 mt-8">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center gap-x-4 mb-2">
            <Link href="/about" className="text-sm text-gray-600 hover:text-primary-dark hover:underline">
              運営者情報
            </Link>
            <span className="text-gray-400">|</span>
            <Link href="/contact" className="text-sm text-gray-600 hover:text-primary-dark hover:underline">
              お問い合わせ
            </Link>
            <span className="text-gray-400">|</span>
            <Link href="/privacy" className="text-sm text-gray-600 hover:text-primary-dark hover:underline">
              プライバシーポリシー
            </Link>
          </div>
          <p className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} ウマFREE. All Rights Reserved.
          </p>
        </div>
      </footer>
    );
};