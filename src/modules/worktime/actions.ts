"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDate, type ChristmasMode, type DayKind } from "./calc";

// All writes go through the user's own Supabase client, so RLS enforces
// ownership and access to the 'worktime' module.

const PATH = "/m/worktime";

async function db() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return { supabase: await createClient(), userId: user.id };
}

function text(formData: FormData, key: string, max: number) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function date(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  if (!isDate(value)) throw new Error(`Invalid date: ${key}`);
  return value;
}

function int(formData: FormData, key: string, min: number, max: number) {
  const value = Math.round(Number(formData.get(key)));
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}

// "7:30" → 450
function time(formData: FormData, key: string) {
  const [hours, minutes] = String(formData.get(key) ?? "").split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) throw new Error(`Invalid time: ${key}`);
  return Math.max(0, Math.min(23 * 60 + 59, hours * 60 + minutes));
}

// Throws on a Supabase error; otherwise returns the data (an empty result for writes without select).
function check<T>({ data, error }: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

// --- Settings -------------------------------------------------------------

export async function saveSettings(formData: FormData) {
  const mode = String(formData.get("christmasMode"));
  const openingDate = String(formData.get("openingDate") ?? "");
  const hours = Number(String(formData.get("openingBalance") ?? "0").replace(",", "."));
  const { supabase, userId } = await db();
  check(
    await supabase.from("worktime_settings").upsert({
      user_id: userId,
      employer: text(formData, "employer", 60) || null,
      opening_balance_minutes: Number.isFinite(hours) ? Math.max(-100000, Math.min(100000, Math.round(hours * 60))) : 0,
      opening_date: isDate(openingDate) ? openingDate : null,
      default_start_minute: time(formData, "defaultStart"),
      default_break_minutes: int(formData, "defaultBreak", 0, 240),
      christmas_mode: (["work", "half", "off"].includes(mode) ? mode : "work") as ChristmasMode,
      holiday_state: formData.get("holidayState") === "BY" ? "BY" : "BW",
      updated_at: new Date().toISOString(),
    }),
  );
  revalidatePath(PATH);
}

// --- Work time models -----------------------------------------------------

export async function savePeriod(formData: FormData) {
  const weekdayMinutes = Array.from({ length: 7 }, (_, index) => {
    const hours = Number(String(formData.get(`day${index}`) ?? "0").replace(",", "."));
    return Number.isFinite(hours) ? Math.max(0, Math.min(960, Math.round(hours * 60))) : 0;
  });
  const vacation = Number(String(formData.get("vacationPerMonth") ?? "0").replace(",", "."));
  const row = {
    valid_from: date(formData, "validFrom"),
    label: text(formData, "label", 60),
    weekday_minutes: weekdayMinutes,
    vacation_days_per_month: Number.isFinite(vacation) ? Math.max(0, Math.min(5, vacation)) : 0,
  };
  const { supabase } = await db();
  const periodId = String(formData.get("periodId") ?? "");
  if (periodId) {
    check(await supabase.from("worktime_periods").update(row).eq("id", periodId));
  } else {
    check(await supabase.from("worktime_periods").insert(row));
  }
  revalidatePath(PATH);
}

export async function deletePeriod(formData: FormData) {
  const { supabase } = await db();
  check(await supabase.from("worktime_periods").delete().eq("id", String(formData.get("periodId"))));
  revalidatePath(PATH);
}

// --- Days -----------------------------------------------------------------

export async function saveDay(formData: FormData) {
  const kind = String(formData.get("kind")) as DayKind;
  if (!["work", "sick", "overtime_off"].includes(kind)) throw new Error("Invalid kind");
  let start: number | null = null;
  let end: number | null = null;
  let breakMinutes = 0;
  if (kind === "work") {
    start = int(formData, "start", 0, 1439);
    end = int(formData, "end", start + 1, 1440);
    breakMinutes = int(formData, "break", 0, end - start - 1);
  }
  const { supabase, userId } = await db();
  check(
    await supabase.from("worktime_days").upsert({
      user_id: userId,
      day: date(formData, "day"),
      kind,
      start_minute: start,
      end_minute: end,
      break_minutes: breakMinutes,
    }),
  );
  revalidatePath(PATH);
}

// Back to the standard day.
export async function resetDay(formData: FormData) {
  const { supabase } = await db();
  check(await supabase.from("worktime_days").delete().eq("day", date(formData, "day")));
  revalidatePath(PATH);
}

// --- Vacation -------------------------------------------------------------

export async function saveVacation(formData: FormData) {
  const startDate = date(formData, "startDate");
  const endDate = date(formData, "endDate");
  const row = {
    start_date: startDate,
    end_date: endDate < startDate ? startDate : endDate,
    note: text(formData, "note", 120) || null,
    in_calendar: formData.get("inCalendar") === "on",
    from_overtime: formData.get("paidWith") === "overtime",
  };
  const { supabase } = await db();
  const vacationId = String(formData.get("vacationId") ?? "");
  if (vacationId) {
    check(await supabase.from("worktime_vacations").update(row).eq("id", vacationId));
  } else {
    check(await supabase.from("worktime_vacations").insert(row));
  }
  revalidatePath(PATH);
}

export async function deleteVacation(formData: FormData) {
  const { supabase } = await db();
  check(await supabase.from("worktime_vacations").delete().eq("id", String(formData.get("vacationId"))));
  revalidatePath(PATH);
}

export async function setVacationInCalendar(id: string, inCalendar: boolean) {
  const { supabase } = await db();
  check(await supabase.from("worktime_vacations").update({ in_calendar: inCalendar }).eq("id", id));
  revalidatePath(PATH);
}
