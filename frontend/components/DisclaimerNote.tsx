// AI偏差値と分析の性質を添える1文の注記。出走表・開催日のボードの直後に置く。
// 以前は黄色の警告の帯（開閉つき）を各ページの下の方に置いていたが、分析と関係のない位置に警告の色が挟まり、
// フッターにも同じ趣旨の注記があるため、読んでいる分析のそばに控えめな文として出す（2026-09-25）。
import Link from 'next/link';

export function DisclaimerNote({ className = '' }: { className?: string }) {
    return (
        <p className={`text-[12.5px] leading-relaxed text-slate-500 ${className}`}>
            AI偏差値と分析は過去のレースデータから算出した参考情報で、的中や利益を保証するものではありません。馬券の購入はご自身の判断で、20歳になってから。
            <Link href="/terms" prefetch={false} className="ml-1 font-bold text-slate-600 underline underline-offset-2 hover:text-brand-700">
                利用規約（免責）
            </Link>
        </p>
    );
}
