import { RacePrediction } from "@/lib/types";

type Props = {
  races: RacePrediction[];
  selectedIndex: number;
  onSelectRace: (index: number) => void;
};

export const RaceSelector = ({ races, selectedIndex, onSelectRace }: Props) => {
  return (
    <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-white rounded-lg sm:rounded-xl border border-slate-200 shadow-sm w-full mx-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {races.map((race, index) => (
        <button
          key={race.id}
          onClick={(e) => {
            onSelectRace(index);
            e.currentTarget.blur();
          }}
          className={`shrink-0 snap-start px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold rounded-md sm:rounded-lg transition-all duration-200 whitespace-nowrap min-h-[36px] sm:min-h-[40px] active:scale-95 border flex-1 md:flex-none flex items-center justify-center ${selectedIndex === index
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