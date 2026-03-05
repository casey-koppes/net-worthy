// Period utility functions for performance calculations

export type PeriodPreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "this_quarter"
  | "this_year"
  | "custom";

export interface PeriodState {
  preset: PeriodPreset;
  startDate: Date;
  endDate: Date;
}

export const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "this_month", label: "MTD" },
  { value: "this_quarter", label: "QTD" },
  { value: "this_year", label: "YTD" },
  { value: "custom", label: "Custom" },
];

// Button group options for performance period selector
export const PERIOD_BUTTON_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "this_month", label: "MTD" },
  { value: "this_quarter", label: "QTD" },
  { value: "this_year", label: "YTD" },
];

/**
 * Get the start date for a given period preset
 */
export function getStartDateForPreset(preset: PeriodPreset): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return today;

    case "yesterday":
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;

    case "7d":
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return sevenDaysAgo;

    case "30d":
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return thirtyDaysAgo;

    case "90d":
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      return ninetyDaysAgo;

    case "this_month":
      return new Date(now.getFullYear(), now.getMonth(), 1);

    case "this_quarter":
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), quarterMonth, 1);

    case "this_year":
      return new Date(now.getFullYear(), 0, 1);

    case "custom":
      // Default to 30 days for custom
      const customDefault = new Date(today);
      customDefault.setDate(customDefault.getDate() - 30);
      return customDefault;

    default:
      return today;
  }
}

/**
 * Get the period state for a preset
 */
export function getPeriodState(preset: PeriodPreset): PeriodState {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = getStartDateForPreset(preset);

  return {
    preset,
    startDate,
    endDate,
  };
}

/**
 * Calculate performance percentage
 * Returns the percentage change from start value to current value
 */
export function calculatePerformance(
  currentValue: number,
  startValue: number
): number {
  if (startValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }
  return ((currentValue - startValue) / Math.abs(startValue)) * 100;
}

/**
 * Format a date for API requests (YYYY-MM-DD)
 */
export function formatDateForApi(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Get Unix timestamp for a date (seconds since epoch)
 */
export function getUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Get the label for a period preset
 * For custom periods, can optionally pass the period state to show the date range
 */
export function getPeriodLabel(preset: PeriodPreset, periodState?: PeriodState): string {
  if (preset === "custom" && periodState) {
    const start = periodState.startDate;
    const end = periodState.endDate;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays}D`;
  }

  const option = PERIOD_OPTIONS.find((o) => o.value === preset);
  return option?.label ?? preset;
}

/**
 * Format a date for display (e.g., "Jan 1")
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
