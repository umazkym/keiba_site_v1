export const formatDate = (dateString: string): string => {
    // 防御: undefined/null/空文字/不正な形式を弾く
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return '日付不明';
    }
    try {
        const date = new Date(dateString + 'T00:00:00');
        if (isNaN(date.getTime())) return '日付不明';
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
      
        return `${year}年${month}月${day}日 (${dayOfWeek})`;
    } catch (e) {
        return '日付不明';
    }
};

export const getWakuNumber = (horseNumber: number, totalHorses: number): number | null => {
    if (totalHorses <= 8) {
        return horseNumber;
    }
    const q = Math.floor(totalHorses / 8);
    const r = totalHorses % 8;
    
    const wakuCounts: number[] = [];
    for (let wakuIdx = 0; wakuIdx < 8; wakuIdx++) {
        if ((7 - wakuIdx) < r) {
            wakuCounts.push(q + 1);
        } else {
            wakuCounts.push(q);
        }
    }
    
    let currentHorse = 1;
    for (let wakuIdx = 0; wakuIdx < 8; wakuIdx++) {
        const count = wakuCounts[wakuIdx];
        if (horseNumber >= currentHorse && horseNumber < currentHorse + count) {
            return wakuIdx + 1;
        }
        currentHorse += count;
    }
    
    return null;
};