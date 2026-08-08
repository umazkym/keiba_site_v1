import { RacePrediction } from '@/lib/types';

const sanitizeRaceAnalysisText = (text: string): string => {
    const replacements: Array<[RegExp, string]> = [
        [/断然の存在/g, '目立つ存在'],
        [/断然/g, '目立って'],
        [/絶対的な本命/g, '目立つ上位候補'],
        [/波乱の余地は極めて少ない/g, '上位評価を中心に確認したい'],
        [/極めて/g, 'かなり'],
        [/容易に想像できる/g, '想定しやすい'],
        [/相当な脚力が要求される/g, '展開面の条件確認が必要になる'],
        [/突き放す公算が高い/g, '評価を上げやすい'],
        [/公算/g, '可能性'],
        [/抜けている/g, '上位に入る'],
        [/確実/g, '可能性'],
        [/上位(\d+)頭の壁は厚い/g, '上位$1頭とは評価差があります'],
        [/壁は厚い/g, '評価差があります'],
        [/苦しい/g, '評価を下げたい条件になりやすい'],
        [/圧倒的な偏差値を誇る/g, '高い偏差値を示す'],
        [/圧倒的な/g, '高い'],
        [/圧倒的に/g, '大きく'],
        [/信頼度が最も高い/g, '評価上位として確認したい'],
        [/信頼度/g, '評価'],
        [/最も高い/g, '上位です'],
        [/馬券/g, '投票判断'],
    ];

    return replacements.reduce((current, [pattern, replacement]) => (
        current.replace(pattern, replacement)
    ), text);
};

/**
 * レース全体の統計分析コンテンツを生成するコンポーネント
 * 既存のデータ（AI偏差値、脚質パターン、このコースの枠順傾向）のみを使用
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

    const maxDeviation = deviationScores.length > 0 ? Math.max(...deviationScores) : 0;
    const minDeviation = deviationScores.length > 0 ? Math.min(...deviationScores) : 0;
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

    const topMarkedHorses = race.predictions.filter(p => p.mark === '◎' || p.mark === '〇' || p.mark === '○');
    const darkHorses = race.predictions.filter(p => p.mark === '▲' || p.mark === '△');

    // ========== 分析文言の生成 ==========
    const generateAbilityAnalysis = (): string => {
        const topHorse = [...race.predictions].filter(p => p.deviation_score !== null).sort((a, b) => (b.deviation_score as number) - (a.deviation_score as number))[0];

        if (!topHorse) return "AI偏差値データが不足しているため、詳細な能力分析は控えさせていただきます。";

        if (deviationRange > 15) {
            return `このレースは出走馬のAI偏差値に大きな開きがあり、全体的に評価差が出ている構成です。中でもAI偏差値トップの${topHorse.horse_number}番「${topHorse.horse_name}」（偏差値${maxDeviation.toFixed(1)}）が高く評価されています。最高値と最低値（${minDeviation.toFixed(1)}）の差は${deviationRange.toFixed(1)}と大きいため、まずは上位評価馬の条件を丁寧に確認したいレースです。`;
        } else if (deviationRange > 8) {
            return `各馬のAI偏差値に中程度の開きがあり、上位評価馬を中心に確認したいレースです。トップ評価の${topHorse.horse_number}番「${topHorse.horse_name}」（偏差値${maxDeviation.toFixed(1)}）は目立つ存在ですが、展開や馬場次第で中位評価の馬が評価を上げる余地もあります。`;
        } else {
            return `最高評価の${topHorse.horse_number}番「${topHorse.horse_name}」（偏差値${maxDeviation.toFixed(1)}）を含め、出走馬間の偏差値差が小さいレースです。道中の位置取りや仕掛けのタイミングなど、展開面の確認も重要になります。能力値だけでなく、対決成績や枠順傾向も合わせて見たい構成です。`;
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
            return `◎や〇の印がついた上位評価馬に加え、▲や△の相手候補もいるレースです。まずは${topHorse?.horse_name || '高い評価の馬'}の条件を確認しつつ、展開次第で浮上しそうな馬がいないかを見ておきたい構成です。`;
        } else if (topMarkedHorses.length >= 3) {
            return `◎や〇の印がついた上位評価馬が${topMarkedHorses.length}頭おり、上位の比較が大事になりそうです。AI偏差値だけでなく、過去対決成績や脚質予測を合わせて確認すると、評価の優先順位を整理しやすくなります。`;
        } else if (darkHorses.length >= 2) {
            return `▲や△の印がついた相手候補が複数います。上位評価馬だけでなく、展開や枠順が合う馬を確認しておくと、オッズ妙味を判断する材料になりそうです。`;
        } else {
            return `印の分布を見ると、上位評価馬を中心に確認しやすい構成です。${topHorse?.horse_name || 'トップ評価の馬'}の条件が当日の馬場や展開に合うかを見ながら、相手候補を整理したいレースです。`;
        }
    };

    // ========== レンダリング ==========
    return (
        <details className="race-panel group overflow-hidden">
            <summary className="race-section-summary flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-2 py-1.5 transition-colors duration-150 hover:bg-slate-50 sm:px-4 sm:py-2">
                <h2 className="race-section-heading mb-0" id="race-analysis-heading">AIレース展望</h2>
                <span className="shrink-0 text-xs font-bold text-blue-700 group-open:hidden">展望を開く</span>
                <span className="hidden shrink-0 text-xs font-bold text-slate-600 group-open:inline">閉じる</span>
            </summary>

            <div className="space-y-2 border-t border-slate-200 bg-slate-50 p-2 sm:space-y-3 sm:p-4">
                {race.ai_analysis_text && (
                    <section className="rounded-lg border border-slate-200 bg-white p-2.5 sm:p-4">
                        <h3 className="mb-1 text-xs font-black text-slate-800 sm:text-sm">AI展望コメント</h3>
                        <p className="whitespace-pre-wrap text-[11px] font-semibold leading-[1.65] text-slate-700 sm:text-sm sm:leading-7">
                            {sanitizeRaceAnalysisText(race.ai_analysis_text)}
                        </p>
                    </section>
                )}

                <div className="grid gap-2 lg:grid-cols-2">
                    {[
                        ['出走馬の能力分析', generateAbilityAnalysis(), 'border-l-blue-600'],
                        ['スタートからの展開予想', generateStartAnalysis(), 'border-l-amber-500'],
                        ['枠順による影響', generateFrameAnalysis(), 'border-l-emerald-600'],
                        ['検討材料のまとめ', generateStrategyAnalysis(), 'border-l-indigo-600'],
                    ].map(([title, body, borderClass]) => (
                        <section key={title} className={`rounded-lg border border-slate-200 border-l-4 bg-white p-2.5 sm:p-4 ${borderClass}`}>
                            <h3 className="mb-1 text-xs font-black text-slate-800 sm:text-sm">{title}</h3>
                            <p className="text-[11px] leading-[1.65] text-slate-700 sm:text-sm sm:leading-7">{body}</p>
                        </section>
                    ))}
                </div>

                <p className="px-1 text-[10px] leading-[1.6] text-slate-500 sm:text-xs">
                    この分析は過去データに基づく推定です。天候、馬場状態、騎手の判断、馬の状態などにより結果は変わります。
                </p>
            </div>
        </details>
    );
};
