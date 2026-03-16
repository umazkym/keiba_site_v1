import { RacePrediction } from "@/lib/types";

type Props = {
  races: RacePrediction[];
  selectedIndex: number;
  onSelectRace: (index: number) => void;
};

export const RaceSelector = ({ races, selectedIndex, onSelectRace }: Props) => {
  return (
    <div className="grid grid-cols-6 md:flex md:flex-wrap gap-1 sm:gap-2 p-1.5 sm:p-3 md:p-4 bg-white rounded-lg sm:rounded-xl border border-slate-200 shadow-sm">
      {races.map((race, index) => (
        <button
          key={race.id}
          onClick={(e) => {
            onSelectRace(index);
            e.currentTarget.blur();
          }}
          className={`w-full md:w-auto px-1.5 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-bold rounded-md sm:rounded-lg transition-all duration-200 whitespace-nowrap min-h-[34px] sm:min-h-[40px] active:scale-95 border ${selectedIndex === index
            ? 'bg-primary text-white shadow-soft border-primary-dark'
            : 'bg-slate-50 text-text-secondary hover:bg-slate-100 border-slate-200 hover:border-primary-light hover:text-primary-dark'
            }`}
        >
          {race.race_number}R
        </button>
      ))}
    </div>
  );
};