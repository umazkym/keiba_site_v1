export const formatDate = (dateString: string): string => {
    try {
        const date = new Date(dateString + 'T00:00:00');
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
      
        return `${year}年${month}月${day}日 (${dayOfWeek})`;
    } catch (e) {
        return dateString;
    }
};