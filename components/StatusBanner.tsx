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
      ? "border-red-400/30 bg-red-950/35 text-red-50"
      : tone === "amber"
        ? "border-amber-300/30 bg-amber-950/25 text-amber-50"
        : "border-cyan-300/30 bg-cyan-950/25 text-cyan-50";
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
    <section className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 gap-3">
          <Icon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold">{title}</h2>
            <p className="mt-1 text-sm opacity-85">{body}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {noSessionToday ? (
            <button
              type="button"
              onClick={onLoadLatest}
              className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white px-3 py-2 text-sm font-bold text-neutral-950 transition hover:bg-neutral-200"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              {t(locale, "loadLatestSession")}
            </button>
          ) : null}
          {!demo ? (
            <button
              type="button"
              onClick={onDemo}
              className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20"
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
