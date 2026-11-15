"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Flag,
  Mic,
  Pause,
  Play,
  Wrench,
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
import type { OfficialOvertake, PitStop, TeamRadioClip } from "@/types/f1Insights";

type TimelineEntry =
  | { kind: "rc"; key: string; date: string; message: RaceControlMessage }
  | { kind: "radio"; key: string; date: string; clip: TeamRadioClip }
  | { kind: "pit"; key: string; date: string; stop: PitStop }
  | { kind: "overtake"; key: string; date: string; overtake: OfficialOvertake };

type ExtraTimelineEntry = Exclude<TimelineEntry, { kind: "rc" }>;

// I sorpassi ufficiali sono tanti: in cronaca vanno solo quelli per le prime posizioni.
const OVERTAKE_MAX_POSITION = 10;
const TIMELINE_LIMIT = 80;

interface RaceCommentaryProps {
  messages: RaceControlMessage[];
  drivers: F1Driver[];
  locale: Locale;
  onSelectDriver: (driverNumber: number) => void;
  teamRadio?: TeamRadioClip[];
  pitStops?: PitStop[];
  overtakes?: OfficialOvertake[];
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
  teamRadio = [],
  pitStops = [],
  overtakes = [],
}: RaceCommentaryProps) {
  const driverByNumber = new Map(drivers.map((driver) => [driver.driverNumber, driver]));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const togglePlay = (url: string) => {
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;

    if (playingUrl === url) {
      audio.pause();
      setPlayingUrl(null);
      return;
    }

    audio.src = url;
    audio.onended = () => setPlayingUrl(null);
    audio.play().then(
      () => setPlayingUrl(url),
      () => setPlayingUrl(null),
    );
  };

  // Timeline unica, dal piu' recente: direzione gara + radio + pit + sorpassi.
  const entries = useMemo<TimelineEntry[]>(() => {
    const all: TimelineEntry[] = [
      ...messages.map((message, index) => ({
        kind: "rc" as const,
        key: `rc-${message.date}-${message.message}-${index}`,
        date: message.date,
        message,
      })),
      ...teamRadio.map((clip) => ({ kind: "radio" as const, key: `radio-${clip.url}`, date: clip.date, clip })),
      ...pitStops.map((stop) => ({
        kind: "pit" as const,
        key: `pit-${stop.driverNumber}-${stop.date}`,
        date: stop.date,
        stop,
      })),
      ...overtakes
        .filter((overtake) => overtake.position <= OVERTAKE_MAX_POSITION)
        .map((overtake) => ({
          kind: "overtake" as const,
          key: `ov-${overtake.date}-${overtake.overtakingDriver}-${overtake.overtakenDriver}`,
          date: overtake.date,
          overtake,
        })),
    ];

    return all
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, TIMELINE_LIMIT);
  }, [messages, overtakes, pitStops, teamRadio]);

  return (
    <aside
      className="panel-neon flex h-full min-h-0 flex-col overflow-hidden rounded-xl"
      aria-label={t(locale, "commentaryAria")}
      data-race-commentary
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <Radio className="h-4 w-4 text-fuchsia-300" aria-hidden="true" />
          <h2 className="panel-neon-title text-sm font-black uppercase italic tracking-[0.18em]">
            {t(locale, "commentary")}
          </h2>
        </div>
        <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-fuchsia-100">
          {entries.length || 0}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {entries.length === 0 ? (
          <div className="grid h-full min-h-0 place-items-center px-6 text-center text-sm text-neutral-400">
            {t(locale, "commentaryEmpty")}
          </div>
        ) : (
          <div className="relative px-2 py-2" role="list">
            {/* Linea verticale della timeline */}
            <span className="pointer-events-none absolute bottom-4 left-[1.45rem] top-4 w-px bg-gradient-to-b from-fuchsia-400/60 via-cyan-300/25 to-transparent" />
            {entries.map((entry, index) => {
              const isLatest = index === 0;

              if (entry.kind !== "rc") {
                return (
                  <ExtraEntry
                    key={entry.key}
                    entry={entry}
                    index={index}
                    isLatest={isLatest}
                    driverByNumber={driverByNumber}
                    locale={locale}
                    playingUrl={playingUrl}
                    onTogglePlay={togglePlay}
                    onSelectDriver={onSelectDriver}
                  />
                );
              }

              const message = entry.message;
              const tone = toneForMessage(message);
              const Icon = tone.icon;
              const driver =
                message.driverNumber !== null ? driverByNumber.get(message.driverNumber) : null;
              const body = localizedRaceControlMessage(locale, message.message);

              return (
                <button
                  key={entry.key}
                  type="button"
                  role="listitem"
                  aria-disabled={message.driverNumber === null}
                  onClick={() => {
                    if (message.driverNumber !== null) {
                      onSelectDriver(message.driverNumber);
                    }
                  }}
                  className={`animate-row-in relative grid w-full grid-cols-[1.9rem_minmax(0,1fr)] gap-2.5 py-1.5 text-left ${
                    message.driverNumber !== null
                      ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                      : "cursor-default"
                  }`}
                  style={{ animationDelay: `${Math.min(index, 15) * 30}ms` }}
                >
                  <div className="relative z-10 flex justify-center pt-2">
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-[#0b0420] shadow-[0_0_12px_-2px_currentColor] ${tone.dot.replace("bg-", "text-")}`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>

                  <div
                    className={`min-w-0 rounded-lg border-l-2 bg-white/[0.035] px-3 py-2 transition ${tone.rail} ${
                      message.driverNumber !== null ? "hover:bg-white/[0.08]" : ""
                    } ${isLatest ? "ring-1 ring-fuchsia-400/40" : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-neutral-400">
                      {isLatest ? (
                        <span className="rounded bg-fuchsia-500 px-1 text-[9px] text-white">LIVE</span>
                      ) : null}
                      <span className="font-mono">{formatRaceControlTime(message.date, locale)}</span>
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

function ExtraEntry({
  entry,
  index,
  isLatest,
  driverByNumber,
  locale,
  playingUrl,
  onTogglePlay,
  onSelectDriver,
}: {
  entry: ExtraTimelineEntry;
  index: number;
  isLatest: boolean;
  driverByNumber: Map<number, F1Driver>;
  locale: Locale;
  playingUrl: string | null;
  onTogglePlay: (url: string) => void;
  onSelectDriver: (driverNumber: number) => void;
}) {
  const driverNumber =
    entry.kind === "radio"
      ? entry.clip.driverNumber
      : entry.kind === "pit"
        ? entry.stop.driverNumber
        : entry.overtake.overtakingDriver;
  const driver = driverByNumber.get(driverNumber);
  const colour = driver?.teamColour ?? "#a3a3a3";
  const acronym = driver?.acronym ?? `#${driverNumber}`;
  const style =
    entry.kind === "radio"
      ? { icon: Mic, accent: "text-cyan-300", rail: "border-cyan-300/70", label: t(locale, "teamRadio") }
      : entry.kind === "pit"
        ? { icon: Wrench, accent: "text-orange-300", rail: "border-orange-300/70", label: t(locale, "pitBanner") }
        : { icon: ArrowUpRight, accent: "text-yellow-300", rail: "border-yellow-300/70", label: t(locale, "overtakeLabel") };
  const Icon = style.icon;
  const playing = entry.kind === "radio" && playingUrl === entry.clip.url;

  return (
    <div
      role="listitem"
      className="animate-row-in relative grid w-full grid-cols-[1.9rem_minmax(0,1fr)] gap-2.5 py-1.5 text-left"
      style={{ animationDelay: `${Math.min(index, 15) * 30}ms` }}
    >
      <div className="relative z-10 flex justify-center pt-2">
        <span className={`grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-[#0b0420] shadow-[0_0_12px_-2px_currentColor] ${style.accent}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>

      <div className={`flex min-w-0 items-center gap-3 rounded-lg border-l-2 bg-white/[0.035] px-3 py-2 ${style.rail} ${isLatest ? "ring-1 ring-fuchsia-400/40" : ""}`}>
        <button
          type="button"
          onClick={() => onSelectDriver(driverNumber)}
          className="min-w-0 flex-1 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
        >
          <div className="flex flex-wrap items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-neutral-400">
            {isLatest ? <span className="rounded bg-fuchsia-500 px-1 text-[9px] text-white">LIVE</span> : null}
            <span className="font-mono">{formatRaceControlTime(entry.date, locale)}</span>
            <span className={style.accent}>{style.label}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-white">
            <span className="h-3.5 w-1 flex-none rounded-sm" style={{ backgroundColor: colour }} />
            <span className="font-black italic">{acronym}</span>
            {entry.kind === "pit" ? (
              <span className="text-white/75">
                {entry.stop.stopDuration !== null ? `${entry.stop.stopDuration.toFixed(1)}s` : ""}
                {entry.stop.lapNumber !== null ? (
                  <span className="ml-1.5 text-xs text-white/45">
                    {t(locale, "lapShort")}
                    {entry.stop.lapNumber}
                  </span>
                ) : null}
              </span>
            ) : entry.kind === "overtake" ? (
              <span className="flex items-center gap-1.5 text-white/75">
                <span className="text-xs">{t(locale, "gapLadderOvertake")}</span>
                <span className="font-black italic">
                  {driverByNumber.get(entry.overtake.overtakenDriver)?.acronym ?? `#${entry.overtake.overtakenDriver}`}
                </span>
                <span className="rounded bg-yellow-300 px-1 text-[10px] font-black text-neutral-950">P{entry.overtake.position}</span>
              </span>
            ) : null}
          </div>
        </button>

        {entry.kind === "radio" ? (
          <button
            type="button"
            onClick={() => onTogglePlay(entry.clip.url)}
            aria-label={playing ? t(locale, "pauseRadio") : t(locale, "playRadio")}
            className={`grid h-9 w-9 flex-none place-items-center rounded-full border transition ${
              playing
                ? "border-cyan-300 bg-cyan-400 text-neutral-950 shadow-[0_0_16px_rgba(34,211,238,0.7)]"
                : "border-cyan-300/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20"
            }`}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
