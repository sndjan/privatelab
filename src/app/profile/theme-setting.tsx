"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getThemePreference, setThemePreference, type ThemePreference } from "@/lib/theme";

const options = [
  { value: "light", label: "Hell", Icon: SunIcon },
  { value: "dark", label: "Dunkel", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
] as const;

function subscribe(onChange: () => void) {
  window.addEventListener("themechange", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("themechange", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function ThemeSetting() {
  // The setting lives in localStorage, so the server renders "system".
  const preference = useSyncExternalStore(subscribe, getThemePreference, () => "system" as const);

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={preference}
      onValueChange={(value) => value && setThemePreference(value as ThemePreference)}
      aria-label="Design"
      className="w-full sm:w-auto"
    >
      {options.map(({ value, label, Icon }) => (
        <ToggleGroupItem key={value} value={value} className="h-10 flex-1 px-4 sm:flex-none">
          <Icon />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
