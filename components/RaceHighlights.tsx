"use client";

import {
  AlertTriangle,
  Camera,
  Flag,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import {
  formatRaceControlTime,
  localizedRaceControlMessage,
  raceControlCategoryLabel,
  raceControlSearchText,
  raceControlVisualKind,
  type RaceControlVisualKind,
} from "@/lib/raceControlText";
import type { F1Driver, RaceControlMessage } from "@/types/f1";
import type { CircuitPhoto } from "@/types/circuit";

interface RaceHighlightsProps {
  messages: RaceControlMessage[];
  drivers: F1Driver[];
  eventPhoto: CircuitPhoto | null;
  locale: Locale;
  onSelectDriver: (driverNumber: number) => void;
}

interface HighlightItem {
  body: string;
  driver: F1Driver | null;
  index: number;
  kind: RaceControlVisualKind;
  message: RaceControlMessage;
  score: number;
  targetDriverNumber: number | null;
}

const KIND_STYLES: Record<
  RaceControlVisualKind,
  {
    accent: string;
    badge: string;
    bg: string;
    glow: string;
    icon: typeof MessageSquareText;
    streak: string;
  }
> = {
  red: {
    accent: "#f87171",
    badge: "bg-red-500/18 text-red-100",
    bg: "from-red-950 via-neutral-950 to-neutral-900",
    glow: "bg-red-400/24",
    icon: AlertTriangle,
    streak: "rgba(248, 113, 113, 0.42)",
  },
  yellow: {
    accent: "#fde047",
    badge: "bg-amber-300/18 text-amber-100",
    bg: "from-amber-950 via-neutral-950 to-stone-900",
    glow: "bg-amber-200/24",
    icon: Flag,
    streak: "rgba(253, 224, 71, 0.42)",
  },
  safety: {
    accent: "#fbbf24",
    badge: "bg-amber-300/18 text-amber-100",
    bg: "from-stone-950 via-neutral-950 to-amber-950",
    glow: "bg-amber-300/22",
    icon: ShieldAlert,
    streak: "rgba(251, 191, 36, 0.42)",
  },
  green: {
    accent: "#6ee7b7",
    badge: "bg-emerald-300/16 text-emerald-100",
    bg: "from-emerald-950 via-neutral-950 to-zinc-900",
    glow: "bg-emerald-300/20",
    icon: Flag,
    streak: "rgba(110, 231, 183, 0.38)",
  },
  blue: {
    accent: "#7dd3fc",
    badge: "bg-sky-300/16 text-sky-100",
    bg: "from-sky-950 via-neutral-950 to-slate-900",
    glow: "bg-sky-300/20",
    icon: Flag,
    streak: "rgba(125, 211, 252, 0.38)",
  },
  chequered: {
    accent: "#f5f5f5",
    badge: "bg-white/14 text-white",
    bg: "from-neutral-800 via-neutral-950 to-neutral-900",
    glow: "bg-white/16",
    icon: Flag,
    streak: "rgba(245, 245, 245, 0.34)",
  },
  incident: {
    accent: "#fb923c",
    badge: "bg-orange-300/18 text-orange-100",
    bg: "from-orange-950 via-neutral-950 to-red-950",
    glow: "bg-orange-300/22",
    icon: Zap,
    streak: "rgba(251, 146, 60, 0.42)",
  },
  drs: {
    accent: "#c084fc",
    badge: "bg-fuchsia-300/16 text-fuchsia-100",
    bg: "from-fuchsia-950 via-neutral-950 to-purple-950",
    glow: "bg-fuchsia-300/18",
    icon: Zap,
    streak: "rgba(192, 132, 252, 0.34)",
  },
  message: {
    accent: "#d4d4d4",
    badge: "bg-white/10 text-neutral-200",
    bg: "from-neutral-800 via-neutral-950 to-neutral-900",
    glow: "bg-white/12",
    icon: MessageSquareText,
    streak: "rgba(212, 212, 212, 0.24)",
  },
};

const KIND_SCORES: Record<RaceControlVisualKind, number> = {
  red: 100,
  safety: 92,
  incident: 86,
  yellow: 78,
  chequered: 72,
  blue: 58,
  green: 50,
  drs: 36,
  message: 20,
};

function normalizedColor(value: string | null | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  return value.startsWith("#") ? value : `#${value}`;
}

function messageTime(message: RaceControlMessage): number {
  const value = new Date(message.date).getTime();
  return Number.isFinite(value) ? value : 0;
}

function highlightScore(
  message: RaceControlMessage,
  kind: RaceControlVisualKind,
  targetDriverNumber: number | null,
): number {
  let score = KIND_SCORES[kind];
  const value = raceControlSearchText(message);

  if (targetDriverNumber !== null) {
    score += 8;
  }

  if (message.lapNumber !== null) {
    score += 4;
  }

  if (value.includes("DEPLOYED") || value.includes("INCIDENT")) {
    score += 5;
  }

  return score;
}

function inferDriverNumberFromText(
  message: RaceControlMessage,
  driverByNumber: Map<number, F1Driver>,
): number | null {
  if (message.driverNumber !== null) {
    return message.driverNumber;
  }

  const text = message.message;
  const numberWithAcronym = text.match(/\b(\d{1,2})\s*\(([A-Z]{2,3})\)/i);

  if (numberWithAcronym) {
    const driverNumber = Number(numberWithAcronym[1]);

    if (driverByNumber.has(driverNumber)) {
      return driverNumber;
    }
  }

  const carNumber = text.match(/\bCAR\s+(\d{1,2})\b/i);

  if (carNumber) {
    const driverNumber = Number(carNumber[1]);

    if (driverByNumber.has(driverNumber)) {
      return driverNumber;
    }
  }

  return null;
}

function buildHighlights(
  messages: RaceControlMessage[],
  drivers: F1Driver[],
  locale: Locale,
): HighlightItem[] {
  const driverByNumber = new Map(drivers.map((driver) => [driver.driverNumber, driver]));

  return messages
    .map((message, index) => {
      const kind = raceControlVisualKind(message);
      const targetDriverNumber = inferDriverNumberFromText(message, driverByNumber);

      return {
        body: localizedRaceControlMessage(locale, message.message),
        driver: targetDriverNumber !== null ? driverByNumber.get(targetDriverNumber) ?? null : null,
        index,
        kind,
        message,
        score: highlightScore(message, kind, targetDriverNumber),
        targetDriverNumber,
      };
    })
    .filter((item) => item.kind !== "message" || item.targetDriverNumber !== null)
    .sort((first, second) => second.score - first.score || messageTime(second.message) - messageTime(first.message))
    .slice(0, 5);
}

function ComicPanel({
  body,
  driver,
  eventPhoto,
  kind,
  locale,
}: {
  body: string;
  driver: F1Driver | null;
  eventPhoto: CircuitPhoto | null;
  kind: RaceControlVisualKind;
  locale: Locale;
}) {
  const style = KIND_STYLES[kind];
  const teamColor = normalizedColor(driver?.teamColour, style.accent);
  const driverLabel = driver?.acronym ?? t(locale, "highlightMoment");

  return (
    <div
      className={`relative aspect-[16/9] overflow-hidden rounded-md border border-white/10 bg-gradient-to-br ${style.bg}`}
      role="img"
      aria-label={`${t(locale, "highlightAiBadge")}: ${body}`}
    >
      {eventPhoto ? (
        <>
          <img
            src={eventPhoto.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full scale-110 object-cover"
            style={{
              filter:
                "saturate(1.65) contrast(1.35) brightness(0.82) sepia(0.12)",
            }}
          />
          <div
            className="absolute inset-0 opacity-50 mix-blend-overlay"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)",
              backgroundSize: "5px 5px",
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.24),transparent_34%,rgba(0,0,0,0.45)),linear-gradient(0deg,rgba(0,0,0,0.54),transparent_42%)]" />
          <div className="absolute inset-0 mix-blend-multiply opacity-70 [background-image:linear-gradient(90deg,rgba(0,0,0,0.45)_0_2px,transparent_2px_100%),linear-gradient(0deg,rgba(0,0,0,0.28)_0_2px,transparent_2px_100%)] [background-size:100%_100%,100%_100%]" />
        </>
      ) : (
        <div
          className="absolute inset-0 opacity-45"
          style={{
            backgroundImage: `repeating-linear-gradient(118deg, transparent 0 12px, ${style.streak} 13px 15px, transparent 16px 24px)`,
          }}
        />
      )}
      <div
        className="absolute inset-x-0 bottom-0 h-16"
        style={{ background: `linear-gradient(0deg, ${teamColor}cc, transparent)` }}
      />
      <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${style.glow}`} />

      <div className="absolute left-2 top-2 rounded bg-neutral-950/78 px-2 py-1 text-[0.64rem] font-black uppercase tracking-[0.12em] text-white shadow">
        {driverLabel}
      </div>
      {eventPhoto ? (
        <div
          className="absolute bottom-2 left-2 max-w-[55%] truncate rounded bg-neutral-950/72 px-2 py-1 text-[0.56rem] font-bold uppercase tracking-[0.12em] text-white/70 shadow"
          title={eventPhoto.attribution || eventPhoto.title}
        >
          Wikimedia
        </div>
      ) : null}
      <div className="absolute bottom-2 right-2 rounded bg-white px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-neutral-950 shadow">
        {t(locale, "highlightAiBadge")}
      </div>
    </div>
  );
}

export function RaceHighlights({
  messages,
  drivers,
  eventPhoto,
  locale,
  onSelectDriver,
}: RaceHighlightsProps) {
  const highlights = buildHighlights(messages, drivers, locale);
  const [openHighlightKey, setOpenHighlightKey] = useState<string | null>(null);

  return (
    <aside
      className="flex h-full min-h-0 flex-col rounded-lg border border-white/10 bg-neutral-950/76 backdrop-blur-sm"
      aria-label={t(locale, "highlightsAria")}
      data-race-highlights
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-200" aria-hidden="true" />
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">
            {t(locale, "highlights")}
          </h2>
        </div>
        <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-neutral-300">
          {highlights.length || 0}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {highlights.length === 0 ? (
          <div className="grid h-full min-h-0 place-items-center px-6 text-center text-sm text-neutral-400">
            {t(locale, "highlightsEmpty")}
          </div>
        ) : (
          <div className="space-y-2 p-2" role="list">
            {highlights.map((highlight) => {
              const { body, driver, index, kind, message, targetDriverNumber } = highlight;
              const style = KIND_STYLES[kind];
              const Icon = style.icon;
              const highlightKey = `${message.date}-${message.message}-${index}`;
              const open = openHighlightKey === highlightKey;

              return (
                <button
                  key={highlightKey}
                  type="button"
                  role="listitem"
                  aria-expanded={open}
                  data-highlight-open={open ? "true" : "false"}
                  onClick={() => {
                    setOpenHighlightKey(open ? null : highlightKey);

                    if (targetDriverNumber !== null) {
                      onSelectDriver(targetDriverNumber);
                    }
                  }}
                  className={`grid w-full cursor-pointer gap-3 rounded-lg border bg-white/[0.045] p-2 text-left transition hover:border-white/20 hover:bg-white/[0.085] focus:outline-none focus:ring-2 focus:ring-white/35 ${
                    open
                      ? "grid-cols-1 border-cyan-200/35 bg-cyan-300/[0.075]"
                      : "grid-cols-[7.6rem_minmax(0,1fr)] border-white/8"
                  }`}
                >
                  <ComicPanel
                    body={body}
                    driver={driver}
                    eventPhoto={eventPhoto}
                    kind={kind}
                    locale={locale}
                  />

                  <div className={`min-w-0 self-center ${open ? "px-1 pb-1" : ""}`}>
                    <div className="flex flex-wrap items-center gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.12em] text-neutral-400">
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

                    <p className={`mt-1 text-sm font-black leading-snug text-white ${
                      open ? "" : "max-h-12 overflow-hidden"
                    }`}>
                      {body}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.64rem] font-bold uppercase tracking-[0.12em] ${style.badge}`}
                      >
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {raceControlCategoryLabel(message, locale)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                        <Camera className="h-3 w-3" aria-hidden="true" />
                        {t(locale, "highlightMoment")}
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
