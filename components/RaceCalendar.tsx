"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CircleAlert,
  Clock,
  ExternalLink,
  Flag,
  Loader2,
  MapPin,
  RefreshCcw,
  Trophy,
} from "lucide-react";
import {
  apiMessage,
  circuitName,
  countryName,
  intlLocale,
  placeName,
  raceName,
  sessionName,
  t,
  type Locale,
} from "@/lib/i18n";
import type {
  F1CalendarApiResponse,
  F1CalendarPayload,
  F1CalendarRace,
  F1CalendarSession,
  F1CalendarSessionType,
  RacePodiumDriver,
  RaceStatus,
} from "@/types/calendar";

function statusLabel(locale: Locale, status: RaceStatus): string {
  if (status === "past") {
    return t(locale, "statusPast");
  }

  if (status === "today") {
    return t(locale, "statusToday");
  }

  return t(locale, "statusUpcoming");
}

function statusTone(status: RaceStatus): {
  border: string;
  dot: string;
  fill: string;
  text: string;
  rail: string;
} {
  if (status === "past") {
    return {
      border: "border-emerald-300/24",
      dot: "bg-emerald-300",
      fill: "bg-emerald-300/10",
      text: "text-emerald-100",
      rail: "from-emerald-300/90 to-emerald-300/20",
    };
  }

  if (status === "today") {
    return {
      border: "border-red-300/35",
      dot: "bg-red-300",
      fill: "bg-red-500/14",
      text: "text-red-100",
      rail: "from-red-300/95 to-red-300/25",
    };
  }

  return {
    border: "border-cyan-300/20",
    dot: "bg-cyan-300",
    fill: "bg-cyan-300/8",
    text: "text-cyan-100",
    rail: "from-cyan-300/75 to-cyan-300/12",
  };
}

function formatRaceDay(startsAt: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
  }).format(new Date(startsAt));
}

function formatRaceMonth(startsAt: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "short",
  })
    .format(new Date(startsAt))
    .replace(".", "")
    .toLocaleUpperCase(intlLocale(locale));
}

function formatRaceTime(startsAt: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

function formatSessionTime(
  time: string | null,
  startsAt: string,
  locale: Locale,
): string {
  return time ? formatRaceTime(startsAt, locale) : t(locale, "timeTba");
}

function formatSessionDay(startsAt: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "short",
  })
    .format(new Date(startsAt))
    .replace(".", "");
}

function formatUpdatedAt(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function driverName(driver: RacePodiumDriver): string {
  return [driver.givenName, driver.familyName].filter(Boolean).join(" ");
}

function constructorColor(name: string): string {
  const normalized = name.toLocaleLowerCase("en-US");

  if (normalized.includes("ferrari")) return "#ef4444";
  if (normalized.includes("mercedes")) return "#2dd4bf";
  if (normalized.includes("mclaren")) return "#f97316";
  if (normalized.includes("red bull")) return "#3b82f6";
  if (normalized.includes("williams")) return "#60a5fa";
  if (normalized.includes("aston")) return "#10b981";
  if (normalized.includes("alpine")) return "#38bdf8";
  if (normalized.includes("haas")) return "#e5e7eb";
  if (normalized.includes("audi")) return "#f43f5e";
  if (normalized.includes("cadillac")) return "#facc15";

  return "#a3a3a3";
}

function podiumHeight(position: number): string {
  if (position === 1) return "h-20";
  if (position === 2) return "h-16";
  return "h-14";
}

function sessionTranslationKey(type: F1CalendarSessionType): string {
  const keys: Record<F1CalendarSessionType, string> = {
    "practice-1": "practice 1",
    "practice-2": "practice 2",
    "practice-3": "practice 3",
    qualifying: "qualifying",
    race: "race",
    sprint: "sprint",
    "sprint-qualifying": "sprint qualifying",
    "sprint-shootout": "sprint shootout",
  };

  return keys[type];
}

function sessionShortLabel(type: F1CalendarSessionType, locale: Locale): string {
  const labels: Record<F1CalendarSessionType, string> = {
    "practice-1": "P1",
    "practice-2": "P2",
    "practice-3": "P3",
    qualifying: locale === "it" ? "Q" : locale === "de" ? "Q" : "Q",
    race: locale === "it" ? "Gara" : locale === "de" ? "Rennen" : "Race",
    sprint: "Sprint",
    "sprint-qualifying": "SQ",
    "sprint-shootout": "SS",
  };

  return labels[type];
}

function sessionTone(session: F1CalendarSession): string {
  if (session.type === "race") {
    return "border-red-300/22 bg-red-500/10 text-red-50";
  }

  if (session.type === "practice-2") {
    return "border-cyan-300/24 bg-cyan-300/10 text-cyan-50";
  }

  if (session.type.includes("sprint")) {
    return "border-fuchsia-300/22 bg-fuchsia-300/10 text-fuchsia-50";
  }

  if (session.type === "qualifying") {
    return "border-amber-300/22 bg-amber-300/10 text-amber-50";
  }

  return "border-white/10 bg-white/[0.04] text-neutral-100";
}

function WeekendSessions({
  sessions,
  locale,
}: {
  sessions: F1CalendarSession[];
  locale: Locale;
}) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-1.5">
      {sessions.map((session) => (
        <div
          key={`${session.type}-${session.startsAt}`}
          className={`min-w-0 rounded-md border px-2 py-1.5 ${sessionTone(session)}`}
          title={`${sessionName(locale, sessionTranslationKey(session.type))} · ${formatSessionDay(
            session.startsAt,
            locale,
          )} ${formatSessionTime(session.time, session.startsAt, locale)}`}
          aria-label={`${sessionName(locale, sessionTranslationKey(session.type))} ${formatSessionDay(
            session.startsAt,
            locale,
          )} ${formatSessionTime(session.time, session.startsAt, locale)}`}
          data-calendar-session={session.type}
        >
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="text-[0.68rem] font-black uppercase tracking-[0.1em]">
              {sessionShortLabel(session.type, locale)}
            </span>
            <span className="text-[0.65rem] font-semibold text-current/62">
              {formatSessionTime(session.time, session.startsAt, locale)}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[0.62rem] font-semibold text-current/55">
            {formatSessionDay(session.startsAt, locale)}
          </div>
        </div>
      ))}
    </div>
  );
}

function PodiumBlock({ driver }: { driver: RacePodiumDriver }) {
  const color = constructorColor(driver.constructorName);

  return (
    <div
      className={`flex min-w-0 flex-col justify-end rounded-md border border-white/10 bg-white/[0.055] px-2 pb-2 pt-2 ${podiumHeight(
        driver.position,
      )}`}
      title={`${driverName(driver)} · ${driver.constructorName}`}
      data-podium-position={driver.position}
    >
      <div
        className="mb-2 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[0.68rem] font-black text-white/55">P{driver.position}</span>
        <span className="truncate text-sm font-black text-white">{driver.code}</span>
      </div>
    </div>
  );
}

function PodiumGraphic({
  race,
  locale,
}: {
  race: F1CalendarRace;
  locale: Locale;
}) {
  if (race.status !== "past") {
    const tone = statusTone(race.status);

    return (
      <div
        className={`flex h-24 items-center justify-center rounded-md border border-dashed ${tone.border} ${tone.fill} ${tone.text}`}
      >
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em]">
          <Clock className="h-4 w-4" aria-hidden="true" />
          {formatSessionTime(race.time, race.startsAt, locale)}
        </div>
      </div>
    );
  }

  if (race.podium.length === 0) {
    return (
      <div className="flex h-24 items-end justify-center gap-2 rounded-md border border-amber-300/18 bg-amber-300/8 px-3 pb-3">
        {[1, 2, 3].map((position) => (
          <div
            key={position}
            className={`w-1/3 rounded border border-dashed border-amber-200/25 bg-amber-200/8 ${
              position === 1 ? "h-16" : position === 2 ? "h-12" : "h-10"
            }`}
          />
        ))}
      </div>
    );
  }

  const podium = [...race.podium].sort((a, b) => a.position - b.position);

  return (
    <div className="grid h-24 grid-cols-3 items-end gap-2">
      {podium.map((driver) => (
        <PodiumBlock key={driver.position} driver={driver} />
      ))}
    </div>
  );
}

function RaceCard({ race, locale }: { race: F1CalendarRace; locale: Locale }) {
  const localizedPlace = placeName(locale, race.locality);
  const localizedCountry = countryName(locale, race.country);
  const place = [localizedPlace, localizedCountry].filter(Boolean).join(", ");
  const tone = statusTone(race.status);

  return (
    <article
      id={`calendar-race-${race.round}`}
      className={`group flex min-h-[17rem] flex-col rounded-lg border ${tone.border} bg-neutral-950/72 p-3 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:bg-neutral-900/78`}
      data-race-card
      data-race-status={race.status}
      data-podium-count={race.podium.length}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`grid h-16 w-16 flex-none place-items-center rounded-md ${tone.fill}`}>
            <div className="text-center leading-none">
              <div className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/48">
                R{race.round.toString().padStart(2, "0")}
              </div>
              <div className="mt-1 text-xl font-black text-white" data-calendar-day>
                {formatRaceDay(race.startsAt, locale)}
              </div>
              <div className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/58" data-calendar-month>
                {formatRaceMonth(race.startsAt, locale)}
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-white/42">
              {statusLabel(locale, race.status)}
            </div>
            <h3 className="mt-1 line-clamp-2 text-base font-black leading-tight text-white">
              {raceName(locale, race.raceName, race.country)}
            </h3>
          </div>
        </div>

        {race.wikipediaUrl ? (
          <a
            href={race.wikipediaUrl}
            target="_blank"
            rel="noreferrer"
            title={t(locale, "gpDetails")}
            aria-label={t(locale, "gpDetails")}
            className="grid h-8 w-8 flex-none place-items-center rounded-md border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/12 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>

      <div className="mt-4 min-h-[3.25rem] border-l border-white/10 pl-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-neutral-100">
          <Flag className="h-4 w-4 flex-none text-red-300" aria-hidden="true" />
          <span className="truncate">{localizedCountry}</span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs font-semibold text-neutral-400">
          <MapPin className="h-3.5 w-3.5 flex-none text-emerald-300" aria-hidden="true" />
          <span className="truncate">{place || circuitName(locale, race.circuitName)}</span>
        </div>
      </div>

      <WeekendSessions sessions={race.sessions} locale={locale} />

      <div className="mt-auto pt-4">
        <PodiumGraphic race={race} locale={locale} />
      </div>
    </article>
  );
}

function SeasonRail({
  races,
  locale,
}: {
  races: F1CalendarRace[];
  locale: Locale;
}) {
  const scrollToRace = (round: number) => {
    document
      .getElementById(`calendar-race-${round}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  };

  return (
    <div className="border-b border-white/10 px-4 py-3" data-calendar-rail>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {races.map((race) => {
          const tone = statusTone(race.status);

          return (
            <button
              key={`${race.season}-${race.round}`}
              type="button"
              onClick={() => scrollToRace(race.round)}
              title={`${race.round}. ${raceName(locale, race.raceName, race.country)}`}
              className="group flex w-14 flex-none flex-col items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-2 py-2 transition hover:bg-white/[0.09]"
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${tone.dot} shadow-[0_0_0_3px_rgba(255,255,255,0.08)]`}
              />
              <span className="text-xs font-black text-white">{race.round}</span>
              <span
                className={`h-0.5 w-full rounded-full bg-gradient-to-r ${tone.rail}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RaceCalendar({ locale }: { locale: Locale }) {
  const [calendar, setCalendar] = useState<F1CalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ lang: locale });
      const response = await fetch(`/api/f1/calendar?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | F1CalendarApiResponse
        | null;

      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.meta.messages[0] ?? t(locale, "calendarNotAvailable"),
        );
      }

      setCalendar(payload.data);
      if (payload.meta.partial && payload.meta.messages[0]) {
        setError(apiMessage(locale, payload.meta.messages[0]));
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? apiMessage(locale, loadError.message)
          : t(locale, "calendarNotAvailable"),
      );
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const summary = useMemo(() => {
    const races = calendar?.races ?? [];
    const past = races.filter((race) => race.status === "past").length;
    const podiums = races.filter((race) => race.podium.length > 0).length;

    return { total: races.length, past, podiums };
  }, [calendar]);

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-950/74 backdrop-blur-sm"
      data-f1-calendar
    >
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-red-300" aria-hidden="true" />
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">
              {t(locale, "calendarTitle", { season: calendar?.season ?? "" })}
            </h2>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs sm:flex sm:flex-wrap">
            <div className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2">
              <div className="text-base font-black text-white">{summary.total}</div>
              <div className="font-semibold text-neutral-400">{t(locale, "races")}</div>
            </div>
            <div className="rounded-md border border-emerald-300/18 bg-emerald-300/8 px-2.5 py-2">
              <div className="text-base font-black text-emerald-100">{summary.past}</div>
              <div className="font-semibold text-emerald-100/65">{t(locale, "completed")}</div>
            </div>
            <div className="rounded-md border border-amber-300/18 bg-amber-300/8 px-2.5 py-2">
              <div className="text-base font-black text-amber-100">{summary.podiums}</div>
              <div className="font-semibold text-amber-100/65">{t(locale, "withTop3")}</div>
            </div>
            {calendar ? (
              <div className="col-span-3 self-end text-[0.68rem] font-semibold text-neutral-500 sm:col-span-1">
                {t(locale, "updated")} {formatUpdatedAt(calendar.generatedAt, locale)}
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={loadCalendar}
          disabled={loading}
          title={t(locale, "calendarRefreshTitle")}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCcw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {t(locale, "refresh")}
        </button>
      </div>

      {loading && !calendar ? (
        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center text-sm text-neutral-300">
          <div>
            <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-red-300" />
            {t(locale, "calendarLoading")}
          </div>
        </div>
      ) : error && !calendar ? (
        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center">
          <div className="max-w-md">
            <CircleAlert className="mx-auto mb-3 h-7 w-7 text-red-300" />
            <h3 className="text-sm font-bold text-white">
              {t(locale, "calendarUnavailable")}
            </h3>
            <p className="mt-2 text-sm text-neutral-400">{error}</p>
          </div>
        </div>
      ) : (
        <>
          <SeasonRail races={calendar?.races ?? []} locale={locale} />
          <div className="min-h-0 flex-1 overflow-auto">
            {error ? (
              <div className="border-b border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm text-amber-50">
                {error}
              </div>
            ) : null}
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {(calendar?.races ?? []).map((race) => (
                <RaceCard
                  key={`${race.season}-${race.round}`}
                  race={race}
                  locale={locale}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
