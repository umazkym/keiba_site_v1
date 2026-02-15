import { RacePrediction } from '@/lib/types';

/**
 * レース全体の統計分析コンテンツを生成するコンポーネント
 * 既存のデータ（AI偏差値、脚質パターン、枠順傾向スコア）のみを使用
 * あくまで参考情報であり、実際の結果を保証するものではありません
 */
export const RaceAnalysis = ({ race }: { race: RacePrediction }) => {
    if (!race.predictions.length) {
        return null;
    }

    // ========== データ抽出と分析 ==========
    const deviationScores = race.predictions
        .filter(p => p.deviation_score !== null)
        .map(p => p.deviation_score as number);

    const avgDeviation = deviationScores.length > 0
        ? deviationScores.reduce((a, b) => a + b, 0) / deviationScores.length
        : 0;

    const maxDeviation = Math.max(...deviationScores);
    const minDeviation = Math.min(...deviationScores);
    const deviationRange = maxDeviation - minDeviation;

    const strongStartHorses = race.predictions.filter(
        p => p.start_1c_indicator !== null && p.start_1c_indicator > 0
    );

    const frameScores = race.horse_number_advantages;
    const bestFrame = frameScores.length > 0
        ? frameScores.reduce((best, current) =>
            current.advantage_score > best.advantage_score ? current : best
        )
        : null;

    const worstFrame = frameScores.length > 0
        ? frameScores.reduce((worst, current) =>
            current.advantage_score < worst.advantage_score ? current : worst
        )
        : null;

    const topMarkedHorses = race.predictions.filter(p => p.mark === '◎' || p.mark === '〇');
    const darkHorses = race.predictions.filter(p => p.mark === '▲' || p.mark === '△');

    // ========== 分析文言の生成 ==========
    const generateAbilityAnalysis = (): string => {
        if (deviationRange > 15) {
            return `このレースは出走馬の実力差が大きく、AIの偏差値でも明確な差が見られます。最高値は${maxDeviation.toFixed(1)}、最低値は${minDeviation.toFixed(1)}で、差は${deviationRange.toFixed(1)}となっています。このような場合、上位の数頭がレースを主導する展開になりやすく、能力上位馬を軸に据えた組み立てが有効になる傾向があります。逆に、実力下位の馬が大きく差を詰める展開は考えにくいため、軸を絞ってシンプルに考える戦略が適しています。`;
        } else if (deviationRange > 8) {
            return `このレースは偏差値の差が中程度で、実力差はある程度あります。最高${maxDeviation.toFixed(1)}と最低${minDeviation.toFixed(1)}の差は${deviationRange.toFixed(1)}です。能力上位馬が優勢になりやすいものの、下位馬にも入り込む余地が残る展開になる可能性があります。上位馬を中心としつつも、ある程度広く検討することでリスクを分散できる構成が向いています。`;
        } else {
            return `このレースは偏差値の差が小さく（差は${deviationRange.toFixed(1)}）、実力が拮抗しています。突出した存在がいないため、展開や位置取り、騎乗戦略といった他の要素が勝敗を分ける可能性が高いレースと考えられます。能力だけで判断せず、総合的な視点で組み立てることが重要です。`;
        }
    };

    const generateStartAnalysis = (): string => {
        const strongRatio = (strongStartHorses.length / race.predictions.length * 100).toFixed(0);
        if (strongStartHorses.length >= race.predictions.length * 0.5) {
            return `スタートから前に行ける馬が全体の${strongRatio}%を占めており、先行争いが活発になる可能性があります。前で競馬を進められる馬に展開の利が向きやすく、ペースが落ち着くと逃げ・先行馬がそのまま押し切る展開になることも考えられます。逆に、差し・追い込み勢は位置取りが重要になります。`;
        } else if (strongStartHorses.length >= race.predictions.length * 0.3) {
            return `スタートで前に行ける馬が${strongRatio}%存在し、極端な展開にはなりにくい構成です。先行勢と差し勢のバランスが取れており、レースの流れ次第でどちらにもチャンスがあると考えられます。展開予想の精度が結果を大きく左右するレースになりやすい傾向です。`;
        } else {
            return `スタートから前に行ける馬が少なく（${strongRatio}%）、差しや追い込みといった後方からの脚が勝負を左右しやすいレースです。前半のペースが緩みやすくなる一方で、直線勝負になる可能性も高く、末脚の鋭い馬に注意が必要です。`;
        }
    };

    const generateFrameAnalysis = (): string => {
        let analysis = '';
        if (bestFrame) {
            analysis += `${bestFrame.horse_number}枠は過去の傾向から見ても比較的有利な位置とされています。レースの進行に影響しやすく、特に先行馬の場合は展開を作りやすくなる可能性があります。`;
        }
        if (worstFrame) {
            analysis += `${worstFrame.horse_number}枠は他の枠に比べるとやや不利な傾向が見られます。位置取りやコース取りの工夫が求められ、能力があっても展開によっては力を発揮しづらいケースもあります。`;
        }
        return analysis || `枠順による有利・不利の傾向は特に見られず、純粋な能力や展開の影響が強いレースと考えられます。`;
    };

    const generateStrategyAnalysis = (): string => {
        if (topMarkedHorses.length > 0 && darkHorses.length > 0) {
            return `有力馬と伏兵馬の両方が混在している構成です。本命とされる馬が実力通りに走る可能性が高い一方で、展開次第では伏兵馬の台頭も十分考えられます。軸馬を明確にした上で、ヒモを広く拾う戦略が有効と考えられます。`;
        } else if (topMarkedHorses.length >= 3) {
            return `有力馬とされる候補が複数（${topMarkedHorses.length}頭）存在しており、1頭だけに依存する戦略はリスクが高い可能性があります。複数軸やボックス型など、幅を持たせた構成を検討することで安定性が増します。`;
        } else if (darkHorses.length >= 2) {
            return `伏兵馬が複数いるため、単純な力関係では決まりにくい可能性があります。展開や脚質の噛み合わせによって着順が入れ替わる余地があり、波乱の可能性も考慮した戦略が適しています。`;
        } else {
            return `能力・展開ともに比較的読みやすい構成です。明確な中心馬が存在し、軸を一本に絞ってシンプルな馬券構成を組む戦略が有効と考えられます。`;
        }
    };

    // ========== レンダリング ==========
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-primary pb-2">このレースのデ－タ分析</h3>

            <div className="bg-transparent sm:bg-white rounded-lg p-0 sm:p-4 shadow-none sm:shadow-sm border-none sm:border sm:border-gray-200 border-l-0 sm:border-l-4 border-l-primary">
                <h4 className="font-bold text-gray-800 mb-2 border-b sm:border-b-0 pb-2 sm:pb-0 text-base sm:text-lg">出走馬の能力分析</h4>
                <p className="text-gray-700 text-sm leading-relaxed">{generateAbilityAnalysis()}</p>
            </div>

            <div className="bg-transparent sm:bg-white rounded-lg p-0 sm:p-4 shadow-none sm:shadow-sm border-none sm:border sm:border-gray-200 border-l-0 sm:border-l-4 border-l-accent mt-6 sm:mt-0">
                <h4 className="font-bold text-gray-800 mb-2 border-b sm:border-b-0 pb-2 sm:pb-0 text-base sm:text-lg">スタートからの展開予想</h4>
                <p className="text-gray-700 text-sm leading-relaxed">{generateStartAnalysis()}</p>
            </div>

            <div className="bg-transparent sm:bg-white rounded-lg p-0 sm:p-4 shadow-none sm:shadow-sm border-none sm:border sm:border-gray-200 border-l-0 sm:border-l-4 border-l-secondary mt-6 sm:mt-0">
                <h4 className="font-bold text-gray-800 mb-2 border-b sm:border-b-0 pb-2 sm:pb-0 text-base sm:text-lg">枠順による影響</h4>
                <p className="text-gray-700 text-sm leading-relaxed">{generateFrameAnalysis()}</p>
            </div>

            <div className="bg-transparent sm:bg-white rounded-lg p-0 sm:p-4 shadow-none sm:shadow-sm border-none sm:border sm:border-gray-200 border-l-0 sm:border-l-4 border-l-secondary-dark mt-6 sm:mt-0">
                <h4 className="font-bold text-gray-800 mb-2 border-b sm:border-b-0 pb-2 sm:pb-0 text-base sm:text-lg">馬券戦略の方向性</h4>
                <p className="text-gray-700 text-sm leading-relaxed">{generateStrategyAnalysis()}</p>
            </div>

            <div className="p-3 text-xs italic">
                <p>このデータ分析はあくまで推定値です。実際のレースでは天候や馬場状態、騎手の判断、馬の調子など予測不可能な要因が大きく影響します。最終的な投票判断はご自身の責任でお願いします。</p>
            </div>
        </div>
    );
};
