import { RacePrediction } from "@/lib/types";

type Props = {
  races: RacePrediction[];
  selectedIndex: number;
  onSelectRace: (index: number) => void;
};

export const RaceSelector = ({ races, selectedIndex, onSelectRace }: Props) => {
  return (
    <div className="grid grid-cols-6 gap-1 lg:flex lg:overflow-x-auto lg:snap-x lg:snap-mandatory lg:scrollbar-hide lg:gap-2 p-1 lg:p-2 bg-white rounded-lg lg:rounded-xl border border-slate-200 shadow-sm w-full mx-auto">
      {races.map((race, index) => (
        <button
          key={race.id}
          onClick={(e) => {
            onSelectRace(index);
            e.currentTarget.blur();
          }}
          className={`shrink-0 snap-start px-1 py-0.5 text-[10px] lg:px-5 lg:py-2 lg:text-sm font-bold rounded-md lg:rounded-lg transition-all duration-200 whitespace-nowrap min-h-[28px] lg:min-h-[40px] active:scale-95 border flex items-center justify-center flex-1 lg:flex-initial ${selectedIndex === index
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
