"use client";

import {
  AlertTriangle,
  Flag,
  MessageSquareText,
  Radio,
  ShieldAlert,
} from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import {
  formatRaceControlTime,
  localizedRaceControlMessage,
  raceControlCategoryLabel,
  raceControlSearchText,
} from "@/lib/raceControlText";
import type { F1Driver, RaceControlMessage } from "@/types/f1";

interface RaceCommentaryProps {
  messages: RaceControlMessage[];
  drivers: F1Driver[];
  locale: Locale;
  onSelectDriver: (driverNumber: number) => void;
}

function toneForMessage(message: RaceControlMessage): {
  rail: string;
  dot: string;
  badge: string;
  icon: typeof MessageSquareText;
} {
  const value = raceControlSearchText(message);

  if (value.includes("RED FLAG")) {
    return {
      rail: "border-red-400/70",
      dot: "bg-red-300",
      badge: "bg-red-500/18 text-red-100",
      icon: AlertTriangle,
    };
  }

  if (value.includes("YELLOW") || value.includes("SAFETY CAR")) {
    return {
      rail: "border-amber-300/70",
      dot: "bg-amber-200",
      badge: "bg-amber-300/16 text-amber-100",
      icon: ShieldAlert,
    };
  }

  if (value.includes("GREEN") || value.includes("TRACK CLEAR")) {
    return {
      rail: "border-emerald-300/70",
      dot: "bg-emerald-200",
      badge: "bg-emerald-300/16 text-emerald-100",
      icon: Flag,
    };
  }

  if (value.includes("BLUE")) {
    return {
      rail: "border-sky-300/70",
      dot: "bg-sky-200",
      badge: "bg-sky-300/16 text-sky-100",
      icon: Flag,
    };
  }

  return {
    rail: "border-white/18",
    dot: "bg-white/65",
    badge: "bg-white/10 text-neutral-200",
    icon: MessageSquareText,
  };
}

export function RaceCommentary({
  messages,
  drivers,
  locale,
  onSelectDriver,
}: RaceCommentaryProps) {
  const driverByNumber = new Map(drivers.map((driver) => [driver.driverNumber, driver]));

  return (
    <aside
      className="flex h-full min-h-0 flex-col rounded-lg border border-white/10 bg-neutral-950/76 backdrop-blur-sm"
      aria-label={t(locale, "commentaryAria")}
      data-race-commentary
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-amber-200" aria-hidden="true" />
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">
            {t(locale, "commentary")}
          </h2>
        </div>
        <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-neutral-300">
          {messages.length || 0}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {messages.length === 0 ? (
          <div className="grid h-full min-h-0 place-items-center px-6 text-center text-sm text-neutral-400">
            {t(locale, "commentaryEmpty")}
          </div>
        ) : (
          <div className="divide-y divide-white/5" role="list">
            {messages.map((message, index) => {
              const tone = toneForMessage(message);
              const Icon = tone.icon;
              const driver =
                message.driverNumber !== null ? driverByNumber.get(message.driverNumber) : null;
              const body = localizedRaceControlMessage(locale, message.message);

              return (
                <button
                  key={`${message.date}-${message.message}-${index}`}
                  type="button"
                  role="listitem"
                  aria-disabled={message.driverNumber === null}
                  onClick={() => {
                    if (message.driverNumber !== null) {
                      onSelectDriver(message.driverNumber);
                    }
                  }}
                  className={`grid w-full grid-cols-[1.8rem_minmax(0,1fr)] gap-3 border-l-4 px-3 py-3 text-left transition ${tone.rail} ${
                    message.driverNumber !== null
                      ? "cursor-pointer hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-white/35"
                      : "cursor-default"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2 pt-0.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                    <Icon className="h-4 w-4 text-white/55" aria-hidden="true" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-neutral-400">
                      <span>{formatRaceControlTime(message.date, locale)}</span>
                      {message.lapNumber !== null ? (
                        <span>
                          {t(locale, "lapShort")}
                          {message.lapNumber}
                        </span>
                      ) : null}
                      {driver || message.driverNumber !== null ? (
                        <span>
                          {driver?.acronym ?? `${t(locale, "driverShort")} ${message.driverNumber}`}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 break-words text-sm font-semibold leading-snug text-white">
                      {body}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] ${tone.badge}`}
                      >
                        {raceControlCategoryLabel(message, locale)}
                      </span>
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                        {t(locale, "raceControl")}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
