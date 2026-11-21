/**
 * The next cohort and the recent ones sit in a short menu.
 * An older year is typed, so the menu does not run back forty years.
 */

import { useState } from "react";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const EARLIEST_YEAR = 1986;

export function newestCohortYear(now = new Date().getFullYear()): number {
  return now + 1;
}

/** Next year, then about fifteen years back. Newest first. */
export function recentCohortYears(now = new Date().getFullYear()): number[] {
  const years: number[] = [];
  for (let year = newestCohortYear(now); year >= now - 14; year -= 1) years.push(year);
  return years;
}

interface CohortYearFieldProps {
  value: number;
  onChange: (year: number) => void;
}

export function CohortYearField({ value, onChange }: CohortYearFieldProps) {
  const recent = recentCohortYears();
  const newest = recent[0];
  const known = value >= EARLIEST_YEAR && value <= newest ? value : 0;
  const inMenu = known === 0 || recent.includes(known);
  const [earlier, setEarlier] = useState(known > 0 && !inMenu);
  const [typed, setTyped] = useState(known > 0 && !inMenu ? String(known) : "");

  function choose(next: string) {
    if (next === "earlier") {
      setEarlier(true);
      setTyped(known > 0 && !recent.includes(known) ? String(known) : "");
      return;
    }
    setEarlier(false);
    setTyped("");
    onChange(next === "0" ? 0 : Number(next));
  }

  function typeYear(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    setTyped(digits);
    if (digits.length < 4) return;
    const year = Number(digits);
    if (year >= EARLIEST_YEAR && year <= newest) onChange(year);
  }

  return (
    <div className="space-y-2">
      <Select value={earlier ? "earlier" : String(inMenu ? known : 0)} onValueChange={choose}>
        <SelectTrigger className="min-h-11 w-full sm:min-h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">Unknown</SelectItem>
          {recent.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
          <SelectItem value="earlier">Earlier year</SelectItem>
        </SelectContent>
      </Select>
      {earlier ? (
        <Input
          inputMode="numeric"
          value={typed}
          placeholder="1998"
          aria-label="Earlier cohort year"
          className="min-h-11 sm:min-h-10"
          onChange={(event) => typeYear(event.target.value)}
        />
      ) : null}
    </div>
  );
}
