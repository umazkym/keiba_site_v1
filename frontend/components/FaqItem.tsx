// よくある質問の1行（Qの印・質問・∨で開閉）。ホーム・よくある質問のページで同じ形を使う（2026-09-26 利用者の指定「ホーム同様」）。
// 記事の中のよくある質問は本文のHTMLのため、同じ見た目を globals.css の .article-faq で持つ。初めは全部閉じる。
import type { ReactNode } from 'react';
import { LineIcon } from '@/components/LineIcon';

export function FaqItem({ question, children, id }: { question: ReactNode; children: ReactNode; id?: string }) {
    return (
        <details id={id} className="group border-b border-slate-200 last:border-b-0">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-1.5 text-[14.5px] font-bold text-slate-900 md:min-h-[52px] md:text-[15.5px] [&::-webkit-details-marker]:hidden">
                <span className="text-[18px] font-bold text-brand-600" aria-hidden="true">Q</span>
                <span className="flex-1 [text-wrap:balance] [word-break:auto-phrase]">{question}</span>
                <LineIcon name="chevD" size={18} className="block shrink-0 text-slate-500 transition-transform duration-150 group-open:rotate-180" />
            </summary>
            <div className="mb-3 ml-[30px] text-pretty text-[13.5px] leading-[1.85] text-slate-700 md:text-[14.5px]">{children}</div>
        </details>
    );
}
