import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Display convention: farmers call hatch/day-old "Day 1"; storage stays 0-based. */
export function displayDay(ageDays: number) {
  return ageDays + 1;
}

