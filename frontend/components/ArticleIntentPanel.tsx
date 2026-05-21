import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ArticleIntent } from '@/lib/article-ux';

interface ArticleIntentPanelProps {
  intent: ArticleIntent;
}

export function ArticleIntentPanel({ intent }: ArticleIntentPanelProps) {
  return (
    <section className="border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-slate-400">{intent.eyebrow}</p>
          <h2 className="mt-1 text-base font-black leading-snug text-slate-900">
            {intent.title}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {intent.summary}
          </p>
        </div>

        <details className="border-t border-slate-100 pt-2">
          <summary className="cursor-pointer list-none text-xs font-bold text-slate-500 hover:text-primary">
            読み方のポイントを見る
          </summary>
          <ul className="mt-2 grid gap-1.5 text-sm text-slate-600">
            {intent.checkpoints.map((checkpoint) => (
              <li key={checkpoint} className="leading-6">
                {checkpoint}
              </li>
            ))}
          </ul>
        </details>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href={intent.primaryHref}
            className="inline-flex items-center justify-center gap-2 bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-700"
          >
            {intent.primaryLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={intent.secondaryHref}
            className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            {intent.secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
