import { redirect } from 'next/navigation';

export default function HomePage() {
  // 今日日付の文字列を生成 (JST)
  const today = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
  const todayStr = today.toISOString().split('T')[0];
  
  // 今日の日付のレースページへ自動的にリダイレクト
  redirect(`/races/${todayStr}`);
}