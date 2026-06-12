export type RaceBreadcrumbItem = {
    label: string;
    href: string;
};

export type RaceBreadcrumbChangeDetail = {
    items: RaceBreadcrumbItem[];
};

export const RACE_BREADCRUMB_CHANGE_EVENT = 'uma-free:race-breadcrumb-change';
