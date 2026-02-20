import { RacePrediction } from "@/lib/types";

type Props = {
  races: RacePrediction[];
  selectedIndex: number;
  onSelectRace: (index: number) => void;
};

export const RaceSelector = ({ races, selectedIndex, onSelectRace }: Props) => {
  return (
    <div className="grid grid-cols-6 md:flex md:flex-wrap gap-2 p-3 md:p-4 bg-surface rounded-t-2xl border-b border-slate-200">
      {races.map((race, index) => (
        <button
          key={race.id}
          onClick={(e) => {
            onSelectRace(index);
            e.currentTarget.blur();
          }}
          className={`w-full md:w-auto px-3 md:px-5 py-2.5 md:py-2 text-xs md:text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap min-h-[44px] active:scale-95 border ${selectedIndex === index
            ? 'bg-primary text-white shadow-soft border-primary-dark'
            : 'bg-white text-text-secondary hover:bg-slate-100 border-slate-200 hover:border-primary-light hover:text-primary-dark shadow-sm'
            }`}
        >
          {race.race_number}R
        </button>
      ))}
    </div>
  );
};