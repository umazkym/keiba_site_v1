import { SpecialPick } from "@/lib/types";

export const SpecialPickCard = ({ pick }: { pick: SpecialPick | null }) => {
    if (!pick) {
        return (
            <div className="bg-gray-200 text-gray-600 p-6 rounded-xl shadow-inner mb-6 text-center">
                <p>本日のAI注目馬はいません。</p>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white p-6 rounded-xl shadow-lg mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-2">AIの注目馬！</h2>
            <p className="text-3xl font-bold">{pick.horse_name}</p>
            <p className="text-lg opacity-90">{pick.venue_name} {pick.race_number}R - {pick.race_name}</p>
            <div className="mt-4 pt-4 border-t border-white/30">
                <p className="text-sm italic">「{pick.commentary}」</p>
            </div>
        </div>
    );
};