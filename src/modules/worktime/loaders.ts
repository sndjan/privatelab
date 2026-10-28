// Server only. What the browser cache loads for the work time tracker (see
// src/lib/query/data.ts).
import type { Loader } from "@/lib/query/loaders";
import { createClient } from "@/lib/supabase/server";
import {
  defaultSettings,
  type ChristmasMode,
  type DayEntry,
  type DayKind,
  type HolidayState,
  type Period,
  type Settings,
  type VacationBlock,
} from "./calc";

export const worktimeLoaders = {
  overview: async (_, user) => {
    const supabase = await createClient();
    const [{ data: settingsRow }, { data: periodRows }, { data: dayRows }, { data: vacationRows }] = await Promise.all([
      supabase.from("worktime_settings").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("worktime_periods")
        .select("id, valid_from, label, weekday_minutes, vacation_days_per_month")
        .order("valid_from"),
      supabase.from("worktime_days").select("day, kind, start_minute, end_minute, break_minutes"),
      supabase
        .from("worktime_vacations")
        .select("id, start_date, end_date, note, in_calendar, from_overtime")
        .order("start_date"),
    ]);

    const settings: Settings = settingsRow
      ? {
          employer: settingsRow.employer,
          openingBalance: settingsRow.opening_balance_minutes,
          openingDate: settingsRow.opening_date,
          defaultStart: settingsRow.default_start_minute,
          defaultBreak: settingsRow.default_break_minutes,
          christmasMode: settingsRow.christmas_mode as ChristmasMode,
          holidayState: (settingsRow.holiday_state ?? "BW") as HolidayState,
        }
      : defaultSettings;
    const periods: Period[] = (periodRows ?? []).map((row) => ({
      id: row.id,
      validFrom: row.valid_from,
      label: row.label,
      weekdayMinutes: row.weekday_minutes,
      vacationPerMonth: Number(row.vacation_days_per_month),
    }));
    const entries: DayEntry[] = (dayRows ?? []).map((row) => ({
      day: row.day,
      kind: row.kind as DayKind,
      start: row.start_minute,
      end: row.end_minute,
      breakMinutes: row.break_minutes,
    }));
    const vacations: VacationBlock[] = (vacationRows ?? []).map((row) => ({
      id: row.id,
      startDate: row.start_date,
      endDate: row.end_date,
      note: row.note,
      inCalendar: row.in_calendar,
      fromOvertime: row.from_overtime ?? false,
    }));
    return { settings, periods, entries, vacations };
  },
} satisfies Record<string, Loader>;
