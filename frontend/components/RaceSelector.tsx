import Link from 'next/link';
import { RacePrediction } from "@/lib/types";

export type RaceSelectorLink = {
  raceNumber: number;
  href: string;
};

type Props = {
  races: RacePrediction[];
  selectedIndex: number;
  onSelectRace: (index: number) => void;
  raceLinks?: RaceSelectorLink[];
  onSelectRaceLink?: (raceNumber: number, href: string, suppressPageView: boolean) => void;
};

export const RaceSelector = ({ races, selectedIndex, onSelectRace, raceLinks, onSelectRaceLink }: Props) => {
  const selectedRaceNumber = races[selectedIndex]?.race_number;
  const options = raceLinks?.length
    ? raceLinks.map(link => ({
        key: `race-link-${link.raceNumber}`,
        raceNumber: link.raceNumber,
        href: link.href,
        raceIndex: races.findIndex(race => race.race_number === link.raceNumber),
      }))
    : races.map((race, index) => ({
        key: race.id,
        raceNumber: race.race_number,
        href: null,
        raceIndex: index,
      }));

  return (
    <nav
      className="race-selector w-full"
      aria-label="同日のレース"
      style={{ gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))` }}
    >
      {options.map(option => (
        selectedRaceNumber === option.raceNumber ? (
          <span
            key={option.key}
            className="race-tab active cursor-default"
            aria-current="page"
            title={`${option.raceNumber}Rを表示中`}
          >
            {option.raceNumber}R
          </span>
        ) : option.href ? (
          <Link
            key={option.key}
            href={option.href}
            prefetch={false}
            onClick={(event) => onSelectRaceLink?.(
              option.raceNumber,
              option.href,
              event.button === 0
                && !event.metaKey
                && !event.ctrlKey
                && !event.shiftKey
                && !event.altKey
            )}
            className="race-tab flex items-center justify-center transition-colors duration-150"
          >
            {option.raceNumber}R
          </Link>
        ) : (
          <button
            key={option.key}
            type="button"
            onClick={(e) => {
              onSelectRace(option.raceIndex);
              e.currentTarget.blur();
            }}
            className="race-tab transition-colors duration-150"
          >
            {option.raceNumber}R
          </button>
        )
      ))}
    </nav>
  );
};
