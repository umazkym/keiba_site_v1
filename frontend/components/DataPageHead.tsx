// データベースの各画面の見出し（2026-09-25 段階5）。紺の面に15pxの見出しを置いていた形をやめ、
// 白い紙面に「競馬データベース」の小さなラベル・丸い書体の見出し・説明1文を置く。
// 2026-09-26：アイコンの丸い面をやめ、紺のアイコンだけを大きく置く。
import type { ReactNode } from 'react';
import { LineIcon, type LineIconName } from '@/components/LineIcon';

export function DataPageHead({
    title,
    description,
    icon,
    label = '競馬データベース',
    className = 'mt-4',
}: {
    title: ReactNode;
    description?: ReactNode;
    icon?: LineIconName;
    label?: string;
    className?: string;
}) {
    return (
        <header className={`flex items-center gap-3.5 sm:gap-4 ${className}`}>
            {icon && (
                <LineIcon name={icon} size={40} className="block h-10 w-10 shrink-0 text-navy sm:h-12 sm:w-12" />
            )}
            <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-500">{label}</p>
                <h1 className="mt-0.5 font-display text-[24px] font-bold leading-snug text-slate-900 [overflow-wrap:anywhere] sm:text-[32px]">
                    {title}
                </h1>
                {description && (
                    <p className="mt-1 max-w-3xl text-[14px] leading-[1.7] text-slate-700 sm:text-[15px]">{description}</p>
                )}
            </div>
        </header>
    );
}
