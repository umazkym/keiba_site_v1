import type { ReactNode } from 'react';

type ResponsiveDataTableProps = {
    children: ReactNode;
    label: string;
    className?: string;
    stickyFirstColumn?: boolean;
};

export function ResponsiveDataTable({
    children,
    label,
    className = '',
    stickyFirstColumn = true,
}: ResponsiveDataTableProps) {
    return (
        <div
            className={`responsive-data-table ${stickyFirstColumn ? 'responsive-data-table--sticky-first' : ''} ${className}`.trim()}
            role="region"
            aria-label={label}
            tabIndex={0}
        >
            {children}
        </div>
    );
}
