import { RacePrediction } from "@/lib/types";

type Props = {
  races: RacePrediction[];
  selectedIndex: number;
  onSelectRace: (index: number) => void;
};

export const RaceSelector = ({ races, selectedIndex, onSelectRace }: Props) => {
  return (
    <div className="grid grid-cols-6 md:flex md:flex-wrap gap-1.5 md:gap-2 p-3 md:p-4 bg-gradient-to-r from-gray-50 to-white rounded-t-xl border-b-2 border-gray-200">
      {races.map((race, index) => (
        <button
          key={race.id}
          onClick={(e) => {
            onSelectRace(index);
            e.currentTarget.blur();
          }}
          className={`w-full md:w-auto px-3 md:px-4 py-2 md:py-2 text-xs md:text-sm font-extrabold rounded-lg transition-all duration-300 whitespace-nowrap ${
            selectedIndex === index
              ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/40 scale-105'
              : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 border border-gray-300 hover:border-primary/30 hover:shadow-md'
          }`}
        >
          {race.race_number}R
        </button>
      ))}
    </div>
  );
};