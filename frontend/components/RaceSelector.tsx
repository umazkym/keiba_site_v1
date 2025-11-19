import { RacePrediction } from "@/lib/types";

type Props = {
  races: RacePrediction[];
  selectedIndex: number;
  onSelectRace: (index: number) => void;
};

export const RaceSelector = ({ races, selectedIndex, onSelectRace }: Props) => {
  return (
    <div className="grid grid-cols-6 md:flex md:flex-wrap gap-2 p-3 md:p-4 bg-gray-50 rounded-t-xl border-b-2 border-gray-200">
      {races.map((race, index) => (
        <button
          key={race.id}
          onClick={(e) => {
            onSelectRace(index);
            e.currentTarget.blur();
          }}
          className={`w-full md:w-auto px-3 md:px-4 py-2.5 md:py-2 text-xs md:text-sm font-bold rounded-lg transition-all duration-200 whitespace-nowrap min-h-[44px] active:scale-95 ${selectedIndex === index
              ? 'bg-primary text-white shadow-md border-2 border-primary-dark'
              : 'bg-white text-gray-700 hover:bg-blue-50 border-2 border-gray-300 hover:border-primary/40'
            }`}
        >
          {race.race_number}R
        </button>
      ))}
    </div>
  );
};