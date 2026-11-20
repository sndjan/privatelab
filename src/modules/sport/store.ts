"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { dataQuery } from "@/lib/query/data";

export function useSportData() {
  return useSuspenseQuery(dataQuery("sport", "all")).data;
}
