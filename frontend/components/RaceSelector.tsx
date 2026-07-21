import { RacePrediction } from "@/lib/types";

type Props = {
  races: RacePrediction[];
  selectedIndex: number;
  onSelectRace: (index: number) => void;
};

export const RaceSelector = ({ races, selectedIndex, onSelectRace }: Props) => {
  return (
    <nav className="race-selector scrollbar-hide w-full" aria-label="同日のレース">
      {races.map((race, index) => (
        selectedIndex === index ? (
          <span
            key={race.id}
            className="race-tab active cursor-default"
            aria-current="page"
            title={`${race.race_number}Rを表示中`}
          >
            {race.race_number}R
          </span>
        ) : (
          <button
            key={race.id}
            type="button"
            onClick={(e) => {
              onSelectRace(index);
              e.currentTarget.blur();
            }}
            className="race-tab transition-colors duration-150"
          >
            {race.race_number}R
          </button>
        )
      ))}
    </nav>
  );
};
