import type { GapValue } from "@/types/f1";
import { gapValue, intlLocale, leaderLabel, type Locale } from "@/lib/i18n";

const DASH = "\u2014";

export function formatGap(
  value: GapValue,
  position?: number | null,
  locale: Locale = "it",
): string {
  if (position === 1) {
    return leaderLabel(locale);
  }

  if (value === null || value === undefined || value === "") {
    return DASH;
  }

  if (typeof value === "string") {
    return gapValue(locale, value.toUpperCase());
  }

  if (!Number.isFinite(value)) {
    return DASH;
  }

  return `+${value.toFixed(3)}`;
}

export function formatInterval(
  value: GapValue,
  position?: number | null,
  locale: Locale = "it",
): string {
  if (position === 1) {
    return DASH;
  }

  if (value === null || value === undefined || value === "") {
    return DASH;
  }

  if (typeof value === "string") {
    return gapValue(locale, value.toUpperCase());
  }

  if (!Number.isFinite(value)) {
    return DASH;
  }

  return `+${value.toFixed(3)}`;
}

export function formatShortDateTime(value?: string | null, locale: Locale = "it"): string {
  if (!value) {
    return DASH;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return DASH;
  }

  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatTime(value?: string | null, locale: Locale = "it"): string {
  if (!value) {
    return DASH;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return DASH;
  }

  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function safeTeamColour(value?: string | null): string {
  const fallback = "#f43f5e";
  if (!value) {
    return fallback;
  }

  const cleaned = value.replace("#", "").trim();
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned}`;
  }

  return fallback;
}
