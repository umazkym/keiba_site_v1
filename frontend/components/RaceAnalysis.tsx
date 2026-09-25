import { RacePrediction } from '@/lib/types';
import { getPositionLabels } from '@/lib/race-display';

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
        [/推奨したい/g, '注目したい'],
        [/推奨する/g, '注目する'],
        [/推奨/g, '注目'],
        [/おすすめ/g, '注目'],
        [/絶対に/g, 'かなり'],
        [/絶対的な/g, '目立つ'],
        [/絶対/g, '有力'],
        [/オッズ妙味/g, '判断材料'],
    ];

    return replacements.reduce((current, [pattern, replacement]) => (
        current.replace(pattern, replacement)
    ), text);
};

/**
 * レース全体の統計分析コンテンツを生成するコンポーネント
 * 既存のデータ（AI偏差値、脚質パターン、このコースの馬番の傾向）のみを使用
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

    // 序盤の位置取りはレース内の相対値で分ける（出走表の「位置」と同じ判定）。
    // 指標が全頭0以上のレースで「全頭が先行」と数えない。
    const positionLabels = getPositionLabels(race.predictions);
    const positionedCount = positionLabels.size;
    const strongStartHorses = race.predictions.filter(p => positionLabels.get(p.horse_number) === '先行');

    // 馬番の有利不利は、今回の出走馬の馬番だけで比べる（コース全体のデータには出走していない馬番も含まれる）。
    const runnerNumbers = new Set(race.predictions.map(p => p.horse_number));
    const frameScores = race.horse_number_advantages.filter(item => runnerNumbers.has(item.horse_number));
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

    // ========== 分析文言の生成 ==========
    const generateAbilityAnalysis = (): string => {
        const topHorse = [...race.predictions].filter(p => p.deviation_score !== null).sort((a, b) => (b.deviation_score as number) - (a.deviation_score as number))[0];

        if (!topHorse) return "AI偏差値データが不足しているため、詳細な能力分析は控えさせていただきます。";

        if (deviationRange > 15) {
            return `このレースは出走馬のAI偏差値に大きな開きがあり、全体的に評価差が出ている構成です。中でもAI偏差値トップの${topHorse.horse_number}番「${topHorse.horse_name}」（偏差値${maxDeviation.toFixed(1)}）が高く評価されています。最高値と最低値（${minDeviation.toFixed(1)}）の差は${deviationRange.toFixed(1)}と大きいため、まずは上位評価馬の条件を丁寧に確認したいレースです。`;
        } else if (deviationRange > 8) {
            return `各馬のAI偏差値に中程度の開きがあり、上位評価馬を中心に確認したいレースです。トップ評価の${topHorse.horse_number}番「${topHorse.horse_name}」（偏差値${maxDeviation.toFixed(1)}）は目立つ存在ですが、展開や馬場次第で中位評価の馬が評価を上げる余地もあります。`;
        } else {
            return `最高評価の${topHorse.horse_number}番「${topHorse.horse_name}」（偏差値${maxDeviation.toFixed(1)}）を含め、出走馬間の偏差値差が小さいレースです。道中の位置取りや仕掛けのタイミングなど、展開面の確認も重要になります。能力値だけでなく、対戦成績や馬番の傾向も合わせて見たい構成です。`;
        }
    };

    const generateStartAnalysis = (): string => {
        if (positionedCount === 0) {
            return 'このレースは序盤の位置取りを予測できるデータがそろっていません。展開は当日の隊列を見て判断したいレースです。';
        }
        const strongRatio = (strongStartHorses.length / positionedCount * 100).toFixed(0);
        const startHorseNames = strongStartHorses.slice(0, 3).map(h => `${h.horse_number}番${h.horse_name}`).join('や');
        const startHorseText = startHorseNames ? `特に${startHorseNames}あたりが前へ行きそうです。` : '';

        if (strongStartHorses.length >= positionedCount * 0.5) {
            return `序盤に前寄りの位置を取りそうな馬が${strongStartHorses.length}頭（${strongRatio}%）と多く、先行争いが激しくなりそうです。${startHorseText}ペースが上がれば、道中で脚をためられる差し・追い込みの馬に向く展開も考えられます。`;
        } else if (strongStartHorses.length >= positionedCount * 0.3) {
            return `序盤に前寄りの位置を取りそうな馬は${strongStartHorses.length}頭（${strongRatio}%）で、標準的な流れになりそうです。${startHorseText}極端な展開にはなりにくく、先行馬と差し馬の双方が持ち味を出しやすい構成です。`;
        } else {
            return `序盤に前寄りの位置を取りそうな馬が${strongStartHorses.length}頭（${strongRatio}%）と少なく、ペースが落ち着きやすい構成です。${startHorseText}前半が緩むと、前で立ち回れる馬や好位で脚をためられる馬が有利になり、後方から追い込む馬には厳しい展開になりやすくなります。`;
        }
    };

    const generateFrameAnalysis = (): string => {
        let analysis = '';
        const nameOf = (horseNumber: number) => race.predictions.find(p => p.horse_number === horseNumber)?.horse_name;
        if (bestFrame && bestFrame.advantage_score > 0) {
            const bestName = nameOf(bestFrame.horse_number);
            analysis += `このコースの過去データでは、今回の出走馬の馬番のうち${bestFrame.horse_number}番${bestName ? `（${bestName}）` : ''}が最も良い傾向です。`;
        }
        if (worstFrame && worstFrame.advantage_score < 0 && worstFrame.horse_number !== bestFrame?.horse_number) {
            const worstName = nameOf(worstFrame.horse_number);
            analysis += `逆に${worstFrame.horse_number}番${worstName ? `（${worstName}）` : ''}はやや不利寄りの傾向で、コース取りでロスが出やすい点に注意したいところです。`;
        }
        return analysis || 'このコース・距離では、今回の出走馬の馬番による大きな有利・不利の傾向はみられません。馬番よりも能力や展開が結果に直結しやすい条件です。';
    };

    // ========== レンダリング ==========
    return (
        <details className="race-panel group overflow-hidden">
            <summary className="race-section-summary flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2 transition-colors duration-150 hover:bg-slate-50 md:px-5 md:py-3">
                <h2 className="race-section-heading race-section-heading--flush !mb-0" id="race-analysis-heading">AIレース展望</h2>
                <span className="shrink-0 text-[13px] font-bold text-brand-700 group-open:hidden">展望を開く</span>
                <span className="hidden shrink-0 text-[13px] font-bold text-slate-600 group-open:inline">閉じる</span>
            </summary>

            <div className="flex flex-col gap-3.5 border-t border-slate-200 px-3.5 pb-3.5 pt-3 md:gap-4 md:px-5 md:pb-5 md:pt-3.5">
                {race.ai_analysis_text && (
                    <section className="flex flex-col gap-1">
                        <h3 className="text-sm font-bold text-navy md:text-[15px]">AI展望コメント</h3>
                        <p className="whitespace-pre-wrap text-sm leading-[1.85] text-slate-700 md:text-[15px]">
                            {sanitizeRaceAnalysisText(race.ai_analysis_text)}
                        </p>
                    </section>
                )}

                {/* 見本と同じ3項目。以前の「検討材料のまとめ」（どのレースでもほぼ同じ文）と、
                    免責の注記（出走表の直後の1文とフッターにある）は外した（2026-09-25） */}
                <div className="grid gap-3.5 md:gap-4 lg:grid-cols-2 lg:gap-x-8">
                    {[
                        ['出走馬の能力', generateAbilityAnalysis()],
                        ['序盤の展開', generateStartAnalysis()],
                        ['馬番の傾向', generateFrameAnalysis()],
                    ].map(([title, body]) => (
                        <section key={title} className="flex flex-col gap-1">
                            <h3 className="text-sm font-bold text-navy md:text-[15px]">{title}</h3>
                            <p className="text-sm leading-[1.85] text-slate-700 md:text-[15px]">{body}</p>
                        </section>
                    ))}
                </div>
            </div>
        </details>
    );
};
