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
        <button
          key={race.id}
          onClick={(e) => {
            onSelectRace(index);
            e.currentTarget.blur();
          }}
          className={`race-tab active:scale-95 transition-transform ${
            selectedIndex === index ? "active" : ""
          }`}
        >
          {race.race_number}R
          <small>{race.course_type ? (race.course_type.includes("芝") ? "芝" : "ダ") : ""}</small>
        </button>
      ))}
    </nav>
  );
};
