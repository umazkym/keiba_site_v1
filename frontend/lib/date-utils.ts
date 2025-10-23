/**
 * JST で今日の日付を YYYY-MM-DD 形式で返す
 */
export const getTodayString = (): string => {
    const now = new Date();
    const jstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    return jstDate.toISOString().split('T')[0];
};
