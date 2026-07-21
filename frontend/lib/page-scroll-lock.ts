type OverflowSnapshot = {
    bodyOverflow: string;
    htmlOverflow: string;
};

let snapshot: OverflowSnapshot | null = null;
const siteLocks = new Set<symbol>();

const isVisible = (element: HTMLElement) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || '1') > 0
        && rect.width > 0
        && rect.height > 0;
};

export const hasVisibleGoogleDialog = () => {
    if (typeof document === 'undefined') return false;
    const dialogs = document.querySelectorAll<HTMLElement>(
        '.fc-dialog-container, .fc-monetization-dialog-container, .fc-consent-root [role="dialog"]',
    );
    return Array.from(dialogs).some(isVisible);
};

export const hasSiteScrollLock = () => siteLocks.size > 0;

export const acquirePageScrollLock = () => {
    const token = Symbol('page-scroll-lock');
    if (siteLocks.size === 0) {
        snapshot = {
            bodyOverflow: document.body.style.overflow,
            htmlOverflow: document.documentElement.style.overflow,
        };
    }

    siteLocks.add(token);
    document.body.dataset.umaScrollLock = 'true';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    let released = false;
    return () => {
        if (released) return;
        released = true;
        siteLocks.delete(token);
        if (siteLocks.size > 0) return;

        delete document.body.dataset.umaScrollLock;
        if (!hasVisibleGoogleDialog() && snapshot) {
            document.body.style.overflow = snapshot.bodyOverflow;
            document.documentElement.style.overflow = snapshot.htmlOverflow;
        }
        snapshot = null;
    };
};

