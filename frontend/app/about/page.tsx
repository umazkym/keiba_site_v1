import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'このサイトについて',
};

export default function AboutPage() {
  return (
    <div className="bg-white p-8 rounded-lg shadow-md max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-2">このサイトについて</h1>
      <div className="space-y-6 text-gray-700">
        <p>
          個人運営による、AIを用いた競馬予想サイトです。
          中央・地方の全レースを対象に、全てのデータを無料で公開しています。登録は不要です。
        </p>
        <p>
          本サイトが、皆様の競馬予想に新しい視点や楽しみ方をもたらすきっかけの一つになればうれしいです。
        </p>
        <h2 className="text-2xl font-semibold text-gray-800 pt-4 border-t mt-6">
          公開データについて
        </h2>
        <ul className="list-disc list-inside space-y-4">
          <li>
            <strong>全出走馬のAI偏差値</strong><br />
            <span className="text-sm text-gray-600">AIによる能力評価を偏差値として数値化したものです。</span>
          </li>
          <li>
            <strong>AIスタート位置取り予測</strong><br />
            <span className="text-sm text-gray-600">脚質や過去データから、スタート直後の位置取りを予測します。</span>
          </li>
          <li>
            <strong>過去対決データ</strong><br />
            <span className="text-sm text-gray-600">出走馬同士の過去の対戦成績です。</span>
          </li>
          <li>
            <strong>枠順傾向スコア</strong><br />
            <span className="text-sm text-gray-600">過去レースの成績から、コースや距離に応じた枠順の有利・不利をスコア化したものです。</span>
          </li>
        </ul>
      </div>
    </div>
  );
}