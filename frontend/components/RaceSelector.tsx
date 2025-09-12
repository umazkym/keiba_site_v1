import { RacePrediction } from "@/lib/types";

type Props = {
  races: RacePrediction[];
  selectedIndex: number;
  onSelectRace: (index: number) => void;
};

export const RaceSelector = ({ races, selectedIndex, onSelectRace }: Props) => {
  return (
    <div className="flex flex-wrap gap-2 p-2 bg-white rounded-t-lg border-b">
      {races.map((race, index) => (
        <button
          key={race.id}
          onClick={(e) => {
            onSelectRace(index);
            e.currentTarget.blur(); // フォーカスを外す
          }}
          className={`px-3 py-1 text-sm font-bold rounded-full transition-colors duration-200  
            ${
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