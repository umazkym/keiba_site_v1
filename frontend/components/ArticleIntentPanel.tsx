import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3 } from 'lucide-react';
import type { ArticleIntent } from '@/lib/article-ux';

interface ArticleIntentPanelProps {
  intent: ArticleIntent;
}

export function ArticleIntentPanel({ intent }: ArticleIntentPanelProps) {
  return (
    <section className="border-y border-slate-100 bg-slate-50/80 px-6 py-5 sm:px-10 sm:py-6">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          <Clock3 className="h-4 w-4 text-blue-500" aria-hidden="true" />
          {intent.eyebrow}
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-black leading-snug text-slate-900 sm:text-xl">
            {intent.title}
          </h2>
          <p className="text-sm leading-7 text-slate-600 sm:text-[15px]">
            {intent.summary}
          </p>
        </div>

        <ul className="grid gap-2 text-sm text-slate-700">
          {intent.checkpoints.map((checkpoint) => (
            <li key={checkpoint} className="flex gap-2 leading-6">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
              <span>{checkpoint}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={intent.primaryHref}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-700"
          >
            {intent.primaryLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={intent.secondaryHref}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            {intent.secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
