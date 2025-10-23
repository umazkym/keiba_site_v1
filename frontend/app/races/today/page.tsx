import { redirect } from 'next/navigation';

export default function TodayPage() {
    // 現在の日付をJST時刻で取得
    const today = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
    );
    const todayStr = today.toISOString().split("T")[0];

    // 当日の予測ページにリダイレクト
    redirect(`/races/${todayStr}`);
}
