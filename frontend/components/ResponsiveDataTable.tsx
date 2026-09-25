import type { ReactNode } from 'react';

type ResponsiveDataTableProps = {
    children: ReactNode;
    label: string;
    className?: string;
    stickyFirstColumn?: boolean;
    /**
     * 固定した先頭列の縦線と、偶数行だけの灰色を付けるか（既定は付ける）。
     * 行に縞の無い表（データ詳細の条件別成績）では false にして、先頭列だけ色が変わって見えるのを避ける（2026-09-25）。
     */
    firstColumnDivider?: boolean;
};

export function ResponsiveDataTable({
    children,
    label,
    className = '',
    stickyFirstColumn = true,
    firstColumnDivider = true,
}: ResponsiveDataTableProps) {
    const stickyClass = stickyFirstColumn ? 'responsive-data-table--sticky-first' : '';
    const plainFirstClass = stickyFirstColumn && !firstColumnDivider ? 'responsive-data-table--plain-first' : '';
    return (
        <div
            className={`responsive-data-table ${stickyClass} ${plainFirstClass} ${className}`.replace(/\s+/g, ' ').trim()}
            role="region"
            aria-label={label}
            tabIndex={0}
        >
            {children}
        </div>
    );
}
