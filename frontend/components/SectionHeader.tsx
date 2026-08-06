import type { ReactNode } from 'react';

type SectionHeaderProps = {
    id?: string;
    title: ReactNode;
    description?: ReactNode;
    meta?: ReactNode;
    action?: ReactNode;
    className?: string;
    compact?: boolean;
};

export function SectionHeader({
    id,
    title,
    description,
    meta,
    action,
    className = '',
    compact = false,
}: SectionHeaderProps) {
    return (
        <div className={`ui-section-header ${compact ? 'ui-section-header--compact' : ''} ${className}`.trim()}>
            <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h2 id={id} className="ui-section-header__title">{title}</h2>
                    {meta && <span className="ui-section-header__meta">{meta}</span>}
                </div>
                {description && <p className="ui-section-header__description">{description}</p>}
            </div>
            {action && <div className="ui-section-header__action">{action}</div>}
        </div>
    );
}
