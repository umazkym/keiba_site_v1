type ClarityFunction = {
    (...args: unknown[]): void;
    q?: unknown[][];
};

type ClarityWindow = Window & {
    clarity?: ClarityFunction;
};

const getClarity = (): ClarityFunction | null => {
    if (typeof window === 'undefined') return null;

    const clarityWindow = window as ClarityWindow;
    if (clarityWindow.clarity) {
        return clarityWindow.clarity;
    }

    const queuedClarity: ClarityFunction = (...args: unknown[]) => {
        queuedClarity.q = queuedClarity.q ?? [];
        queuedClarity.q.push(args);
    };
    clarityWindow.clarity = queuedClarity;
    return queuedClarity;
};

const normalizeValue = (value: unknown): string | null => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'string') return value.slice(0, 120);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return null;
};

/**
 * Clarityの録画・ヒートマップを、サイト固有の文脈で絞り込むためのタグを設定する。
 * 個人情報や自由入力値は渡さず、ページ種別・配置名など低カーディナリティの値だけを扱う。
 */
export const setClarityTag = (key: string, value: unknown) => {
    const normalizedValue = normalizeValue(value);
    if (!normalizedValue) return;

    getClarity()?.('set', key.slice(0, 120), normalizedValue);
};

/**
 * GA4だけでは分からない操作前後の録画をClarityで確認できるよう、固定名のイベントを送る。
 */
export const sendClarityEvent = (
    eventName: string,
    tags: Record<string, unknown> = {},
) => {
    const clarity = getClarity();
    if (!clarity) return;

    Object.entries(tags).forEach(([key, value]) => {
        const normalizedValue = normalizeValue(value);
        if (normalizedValue) {
            clarity('set', key.slice(0, 120), normalizedValue);
        }
    });
    clarity('event', eventName.slice(0, 120));
};
