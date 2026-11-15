"use client";

import { AlertTriangle, Info, Radio, RefreshCcw, Timer } from "lucide-react";
import { apiMessage, t, type Locale } from "@/lib/i18n";
import type { F1Session } from "@/types/f1";

interface StatusBannerProps {
  session: F1Session | null;
  demo: boolean;
  error: string | null;
  rateLimited: boolean;
  partial: boolean;
  tokenConfigured: boolean;
  messages: string[];
  locale: Locale;
  onLoadLatest: () => void;
  onDemo: () => void;
}

export function StatusBanner({
  session,
  demo,
  error,
  rateLimited,
  partial,
  tokenConfigured,
  messages,
  locale,
  onLoadLatest,
  onDemo,
}: StatusBannerProps) {
  const noSessionToday = session?.status === "no-session-today" && !demo;
  const liveNeedsToken = session?.isLive && !tokenConfigured;

  if (!error && !rateLimited && !partial && !demo && !noSessionToday && !liveNeedsToken) {
    return null;
  }

  const tone = error ? "red" : rateLimited || noSessionToday ? "amber" : "cyan";
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-900"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-line bg-white text-ink";
  const Icon = error ? AlertTriangle : rateLimited ? Info : noSessionToday ? Radio : Info;
  const title = error
    ? t(locale, "apiError")
    : rateLimited
      ? t(locale, "statusRateLimitTitle")
      : noSessionToday
        ? t(locale, "statusNoSessionTitle")
        : demo
          ? t(locale, "statusDemoTitle")
          : liveNeedsToken
            ? t(locale, "statusTokenTitle")
            : t(locale, "statusPartialTitle");
  const body = error
    ? apiMessage(locale, error)
    : rateLimited
      ? t(locale, "statusRateLimitBody")
      : noSessionToday
        ? t(locale, "statusNoSessionBody")
        : demo
          ? t(locale, "statusDemoBody")
          : liveNeedsToken
            ? t(locale, "statusTokenBody")
            : messages[0] ?? t(locale, "statusPartialBody");

  return (
    <section className={`rounded-md border px-4 py-2.5 ${toneClass}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 gap-3">
          <Icon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold">{title}</h2>
            <p className="mt-0.5 text-xs opacity-75">{body}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {noSessionToday ? (
            <button
              type="button"
              onClick={onLoadLatest}
              className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-ink/85"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              {t(locale, "loadLatestSession")}
            </button>
          ) : null}
          {!demo ? (
            <button
              type="button"
              onClick={onDemo}
              className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-soft"
            >
              <Timer className="h-4 w-4" aria-hidden="true" />
              {t(locale, "historicalDemo")}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
