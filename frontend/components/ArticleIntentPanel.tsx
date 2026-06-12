import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ArticleIntent } from '@/lib/article-ux';

interface ArticleIntentPanelProps {
  intent: ArticleIntent;
}

export function ArticleIntentPanel({ intent }: ArticleIntentPanelProps) {
  return (
    <section className="border border-slate-200 bg-white p-3 sm:p-5">
      <div className="flex flex-col gap-2.5 sm:gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 sm:text-xs">{intent.eyebrow}</p>
          <h2 className="mt-1 text-base font-black leading-snug text-slate-900">
            {intent.title}
          </h2>
          <p className="mt-1.5 text-xs leading-5 text-slate-600 sm:mt-2 sm:text-sm sm:leading-7">
            {intent.summary}
          </p>
        </div>

        <details className="border-t border-slate-100 pt-2">
          <summary className="cursor-pointer list-none text-xs font-bold text-slate-500 hover:text-primary">
            読み方のポイントを見る
          </summary>
          <ul className="mt-1.5 grid gap-1 text-xs text-slate-600 sm:mt-2 sm:gap-1.5 sm:text-sm">
            {intent.checkpoints.map((checkpoint) => (
              <li key={checkpoint} className="leading-5 sm:leading-6">
                {checkpoint}
              </li>
            ))}
          </ul>
        </details>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href={intent.primaryHref}
            className="inline-flex items-center justify-center gap-1.5 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-700 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
          >
            {intent.primaryLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={intent.secondaryHref}
            className="inline-flex items-center justify-center gap-1.5 border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
          >
            {intent.secondaryLabel}
          </Link>
        </div>

        {intent.nextLinks.length > 0 && (
          <div className="border-t border-slate-100 pt-2.5 sm:pt-3">
            <p className="mb-1.5 text-xs font-bold text-slate-500 sm:mb-2">次に確認するページ</p>
            <div className="divide-y divide-slate-100 border-y border-slate-100">
              {intent.nextLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center justify-between gap-2 py-2 sm:gap-3 sm:py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-bold leading-5 text-slate-800 group-hover:text-primary sm:text-sm">
                      {link.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-slate-500 sm:text-xs sm:leading-5">
                      {link.description}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-primary" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
