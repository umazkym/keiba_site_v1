// AI偏差値と分析の性質を添える1文の注記。出走表・開催日のボードの直後に置く。
// 以前は黄色の警告の帯（開閉つき）を各ページの下の方に置いていたが、分析と関係のない位置に警告の色が挟まり、
// フッターにも同じ趣旨の注記があるため、読んでいる分析のそばに控えめな文として出す（2026-09-25）。
// スマホの見直し（2026-09-25）で1行に短くした。20歳の注意はフッターと PR 枠の注記に残る。
import Link from 'next/link';

export function DisclaimerNote({ className = '' }: { className?: string }) {
    return (
        <p className={`text-[12.5px] leading-relaxed text-slate-500 ${className}`}>
            過去データによる参考値で、的中は保証しません。
            {/* 以前の「利用規約（免責）」は390px幅で行をはみ出し、「利用規約／（免責）」と不自然に折れていた。1行に収め、折れるときも言葉の途中で切らない（2026-09-26） */}
            <Link href="/terms" prefetch={false} className="ml-1 whitespace-nowrap font-bold text-slate-600 underline underline-offset-2 hover:text-brand-700">
                利用規約
            </Link>
        </p>
    );
}
