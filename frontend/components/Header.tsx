import Link from 'next/link';

export const Header = () => {
  return (
    <header className="bg-gray-800 text-white shadow-md">
      <div className="container mx-auto px-4 py-3">
        <Link href="/" className="text-xl font-bold tracking-tight hover:text-gray-300">
          競馬AI予測
        </Link>
      </div>
    </header>
  );
};