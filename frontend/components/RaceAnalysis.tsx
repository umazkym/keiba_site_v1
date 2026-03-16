import { RacePrediction } from '@/lib/types';
import { SparklesIcon } from './Icons';

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
        const topHorse = [...race.predictions].filter(p => p.deviation_score !== null).sort((a, b) => (b.deviation_score as number) - (a.deviation_score as number))[0];

        if (!topHorse) return "AI偏差値データが不足しているため、詳細な能力分析は控えさせていただきます。";

        if (deviationRange > 15) {
            return `このレースは出走馬の実力差が大きく、全体的に縦長の力関係となっています。中でもAI偏差値トップの${topHorse.horse_number}番「${topHorse.horse_name}」（偏差値${maxDeviation.toFixed(1)}）が抜けた評価を受けており、レースの中心になりそうです。最高値と最低値（${minDeviation.toFixed(1)}）の差は${deviationRange.toFixed(1)}と大きく、実力下位の馬が上位に食い込むのは厳しいかもしれません。${topHorse.horse_name}を軸に据えたシンプルな組み立てが有効な傾向があります。`;
        } else if (deviationRange > 8) {
            return `各馬のAI偏差値に中程度の開きがあり、上位陣にある程度絞られそうなレースです。トップ評価の${topHorse.horse_number}番「${topHorse.horse_name}」（偏差値${maxDeviation.toFixed(1)}）が優勢ではありますが、絶対的とは言えません。最低値（${minDeviation.toFixed(1)}）との差は${deviationRange.toFixed(1)}となっており、上位評価の数頭を中心としつつ、展開次第で入り込める中位の馬も押さえておく構成が適しています。`;
        } else {
            return `最高評価の${topHorse.horse_number}番「${topHorse.horse_name}」（偏差値${maxDeviation.toFixed(1)}）を含め、出走馬間の偏差値の差が小さい（差はわずか${deviationRange.toFixed(1)}）大混戦です。突出した能力を持つ馬がいないため、道中の位置取りや騎手の仕掛けのタイミングなど、展開一つで大きく着順が入れ替わる可能性が高いレースです。能力値だけでなく、多角的な視点から広く検討することをおすすめします。`;
        }
    };

    const generateStartAnalysis = (): string => {
        const strongRatio = (strongStartHorses.length / race.predictions.length * 100).toFixed(0);
        const startHorseNames = strongStartHorses.slice(0, 3).map(h => `${h.horse_number}番${h.horse_name}`).join('や');
        const startHorseText = startHorseNames ? `特に${startHorseNames}あたりがハナを主張しそうです。` : '';

        if (strongStartHorses.length >= race.predictions.length * 0.5) {
            return `スタートから前に行きたい馬が全体の${strongRatio}%（${strongStartHorses.length}頭）と多く、激しい先行争いが予想されます。${startHorseText}ハイペースになれば、道中脚を溜められる差し・追い込み馬に有利な展開が向く可能性があります。逆に前が止まらない馬場状態であれば、そのまま押し切るケースも考えられます。`;
        } else if (strongStartHorses.length >= race.predictions.length * 0.3) {
            return `先行力が期待できる馬が${strongRatio}%（${strongStartHorses.length}頭）存在し、標準的でよどみないペースになりそうです。${startHorseText}極端な展開にはなりにくいため、先行馬と差し馬の双方が持ち味を発揮しやすいフェアな流れになる確率が高いでしょう。`;
        } else {
            return `スタートからハナを切りたい馬が少なく（${strongRatio}%）、ペースが落ち着いてスローになりやすい構成です。${startHorseText}前半のペースが緩むと、後方から追い込む馬には厳しい展開となり、前で立ち回れる馬や好位で脚を溜められる馬が有利になります。上がり3ハロンの速い末脚勝負への警戒が必要です。`;
        }
    };

    const generateFrameAnalysis = (): string => {
        let analysis = '';
        if (bestFrame) {
            const bestHorses = race.predictions.filter(p => p.waku_number === bestFrame.horse_number).map(h => h.horse_name);
            const bestHorseText = bestHorses.length > 0 ? `（${bestHorses.join('、')}など）` : '';
            analysis += `過去の傾向から、このコースでは${bestFrame.horse_number}枠${bestHorseText}が有利なポジションを取りやすいデータが出ています。`;
        }
        if (worstFrame) {
            const worstHorses = race.predictions.filter(p => p.waku_number === worstFrame.horse_number).map(h => h.horse_name);
            const worstHorseText = worstHorses.length > 0 ? `（${worstHorses.join('、')}など）` : '';
            analysis += `逆に、${worstFrame.horse_number}枠${worstHorseText}はやや不利な傾向が見られ、コース取りでロスが生じやすい点に注意が必要です。`;
        }
        return analysis || `このコース・距離において、枠順による極端な有利・不利のデータはみられません。馬番よりも純粋な能力や展開が勝敗に直結しやすい条件です。`;
    };

    const generateStrategyAnalysis = (): string => {
        const topHorse = [...race.predictions].filter(p => p.deviation_score !== null).sort((a, b) => (b.deviation_score as number) - (a.deviation_score as number))[0];

        if (topMarkedHorses.length > 0 && darkHorses.length > 0) {
            return `◎や〇の印がついた有力馬に加え、▲や△の伏兵馬も混在するレースです。基本的には${topHorse?.horse_name || '高い評価の馬'}を中心に据えつつも、展開次第でヒモ荒れの可能性が十分にあります。軸を固定し、相手を手広く流す戦略などが一考です。`;
        } else if (topMarkedHorses.length >= 3) {
            return `◎や〇の印を獲得した有力候補が${topMarkedHorses.length}頭おり、上位拮抗の様相です。1頭の軸に絞り切るのはリスクが伴うため、複数頭のボックスやフォーメーションなどで手広く構えることで、思わぬ取りこぼしを防ぐ戦略が効果的です。`;
        } else if (darkHorses.length >= 2) {
            return `▲や△の印がついた不気味な伏兵馬が複数存在しています。上位人気の馬が崩れた際に一気に波乱となるケースがあり、穴狙いの方にとっては面白い構成です。思わぬ高配当を狙うなら、手広くカバーする券種が適しているでしょう。`;
        } else {
            return `印の分布からも、比較的順当に決まりやすい堅実な構成と分析されています。${topHorse?.horse_name || 'トップ評価の馬'}から点数を絞り、無駄な買い目を減らして利益率を高める王道の戦略が似合うレースと言えそうです。`;
        }
    };

    // ========== レンダリング ==========
    return (
        <div className="space-y-2 sm:space-y-4">
            <h3 className="text-sm sm:text-lg font-bold text-gray-800 border-b-2 border-primary pb-1 sm:pb-2">このレースのデ－タ分析</h3>

            {race.ai_analysis_text && (
                <div className="bg-gradient-to-br from-indigo-50/50 to-blue-50/30 rounded-lg p-2.5 sm:p-5 border border-indigo-200 shadow-sm mb-3 sm:mb-6 relative overflow-hidden">
                    <h4 className="flex items-center text-primary font-bold mb-1.5 sm:mb-3 text-xs sm:text-lg relative z-10">
                        <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5" />
                        AIレース展望・展開予想
                    </h4>
                    <div className="text-gray-800 text-xs sm:text-[15px] leading-relaxed whitespace-pre-wrap relative z-10">
                        {race.ai_analysis_text}
                    </div>
                </div>
            )}

            <div className="bg-white rounded-lg p-2 sm:p-4 shadow-sm border border-gray-200 border-l-4 border-l-primary">
                <h4 className="font-bold text-gray-800 mb-1 sm:mb-2 text-xs sm:text-lg">出走馬の能力分析</h4>
                <p className="text-gray-700 text-[11px] sm:text-sm leading-relaxed">{generateAbilityAnalysis()}</p>
            </div>

            <div className="bg-white rounded-lg p-2 sm:p-4 shadow-sm border border-gray-200 border-l-4 border-l-accent">
                <h4 className="font-bold text-gray-800 mb-1 sm:mb-2 text-xs sm:text-lg">スタートからの展開予想</h4>
                <p className="text-gray-700 text-[11px] sm:text-sm leading-relaxed">{generateStartAnalysis()}</p>
            </div>

            <div className="bg-white rounded-lg p-2 sm:p-4 shadow-sm border border-gray-200 border-l-4 border-l-secondary">
                <h4 className="font-bold text-gray-800 mb-1 sm:mb-2 text-xs sm:text-lg">枠順による影響</h4>
                <p className="text-gray-700 text-[11px] sm:text-sm leading-relaxed">{generateFrameAnalysis()}</p>
            </div>

            <div className="bg-white rounded-lg p-2 sm:p-4 shadow-sm border border-gray-200 border-l-4 border-l-secondary-dark">
                <h4 className="font-bold text-gray-800 mb-1 sm:mb-2 text-xs sm:text-lg">馬券戦略の方向性</h4>
                <p className="text-gray-700 text-[11px] sm:text-sm leading-relaxed">{generateStrategyAnalysis()}</p>
            </div>

            <div className="p-2 sm:p-3 text-[10px] sm:text-xs italic">
                <p>このデータ分析はあくまで推定値です。実際のレースでは天候や馬場状態、騎手の判断、馬の調子など予測不可能な要因が大きく影響します。最終的な投票判断はご自身の責任でお願いします。</p>
            </div>
        </div>
    );
};
