import { RacePrediction } from "@/lib/types";

type Props = {
  races: RacePrediction[];
  selectedIndex: number;
  onSelectRace: (index: number) => void;
};

export const RaceSelector = ({ races, selectedIndex, onSelectRace }: Props) => {
  return (
    <div className="grid grid-cols-6 md:flex md:flex-wrap gap-1 md:gap-2 p-2 md:p-3 bg-white rounded-t-lg border-b">
      {races.map((race, index) => (
        <button
          key={race.id}
          onClick={(e) => {
            onSelectRace(index);
            e.currentTarget.blur();
          }}
          className={`w-full md:w-auto px-2 md:px-3 py-1.5 md:py-1 text-xs md:text-sm font-bold rounded-full transition-colors duration-200 whitespace-nowrap ${
            selectedIndex === index
              ? 'bg-blue-600 text-white shadow'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {race.race_number}R
        </button>
      ))}
    </div>
  );
};