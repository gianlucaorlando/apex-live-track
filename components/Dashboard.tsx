"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Map, Trophy } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";
import { LiveStandings } from "@/components/LiveStandings";
import { LoadingState } from "@/components/LoadingState";
import { MotorsportNews } from "@/components/MotorsportNews";
import { RaceCalendar } from "@/components/RaceCalendar";
import { RaceCommentary } from "@/components/RaceCommentary";
import { SessionHeader } from "@/components/SessionHeader";
import { SeasonStandings } from "@/components/SeasonStandings";
import { StatusBanner } from "@/components/StatusBanner";
import { TrackMap } from "@/components/TrackMap";
import { WeatherBackdrop } from "@/components/WeatherBackdrop";
import { useF1LiveData } from "@/hooks/useF1LiveData";
import { DEFAULT_LOCALE, normalizeLocale, t, type Locale } from "@/lib/i18n";
import type { CircuitPhoto, CircuitPhotoApiResponse } from "@/types/circuit";
import type { RaceWeather, WeatherApiResponse } from "@/types/weather";

interface DashboardProps {
  initialDemo: boolean;
}

type DashboardView = "track" | "calendar" | "season-standings";

interface ViewTabsProps {
  activeView: DashboardView;
  locale: Locale;
  onChange: (view: DashboardView) => void;
}

function ViewTabs({ activeView, locale, onChange }: ViewTabsProps) {
  const tabs: {
    view: DashboardView;
    label: string;
    icon: typeof Map;
  }[] = [
    { view: "track", label: t(locale, "trackTab"), icon: Map },
    { view: "calendar", label: t(locale, "calendarTab"), icon: CalendarDays },
    { view: "season-standings", label: t(locale, "seasonStandingsTab"), icon: Trophy },
  ];

  return (
    <nav
      className="flex flex-none items-center gap-1 self-start rounded-lg border border-white/10 bg-neutral-950/85 p-1"
      aria-label={t(locale, "viewTabsAria")}
    >
      {tabs.map((tab) => {
        const active = activeView === tab.view;
        const Icon = tab.icon;

        return (
          <button
            key={tab.view}
            type="button"
            onClick={() => onChange(tab.view)}
            className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-bold transition ${
              active
                ? "bg-white text-neutral-950"
                : "text-neutral-300 hover:bg-white/10 hover:text-white"
            }`}
            aria-pressed={active}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export function Dashboard({ initialDemo }: DashboardProps) {
  const [demo, setDemo] = useState(initialDemo);
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [localeHydrated, setLocaleHydrated] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>("track");
  const [hoveredDriver, setHoveredDriver] = useState<number | null>(null);
  const [selectedDriverNumber, setSelectedDriverNumber] = useState<number | null>(null);
  const [weather, setWeather] = useState<RaceWeather | null>(null);
  const [circuitPhoto, setCircuitPhoto] = useState<CircuitPhoto | null>(null);
  const liveData = useF1LiveData(demo, locale);
  const loadingMessage = demo
    ? t(locale, "loadingDemoReplay")
    : t(locale, "loadingLatestSession");
  const lapSummary = useMemo(() => {
    const currentLaps = liveData.standings
      .map((row) => row.currentLap)
      .filter((value): value is number => typeof value === "number" && value > 0);
    const totalLaps =
      liveData.standings.find((row) => row.totalLaps !== null)?.totalLaps ?? null;

    return {
      current: currentLaps.length > 0 ? Math.max(...currentLaps) : null,
      total: totalLaps,
    };
  }, [liveData.standings]);

  useEffect(() => {
    setLocale(normalizeLocale(window.localStorage.getItem("f1-live-track-locale")));
    setLocaleHydrated(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;

    if (localeHydrated) {
      window.localStorage.setItem("f1-live-track-locale", locale);
    }
  }, [locale, localeHydrated]);

  useEffect(() => {
    const meeting = liveData.meeting;

    if (!meeting) {
      setWeather(null);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      location: meeting.location || meeting.circuitShortName,
      circuit: meeting.circuitShortName,
      country: meeting.countryName,
      country_code: meeting.countryCode,
      lang: locale,
    });

    async function loadWeather() {
      try {
        const response = await fetch(`/api/weather?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | WeatherApiResponse
          | null;

        if (!controller.signal.aborted) {
          setWeather(response.ok ? payload?.data ?? null : null);
        }
      } catch {
        if (!controller.signal.aborted) {
          setWeather(null);
        }
      }
    }

    loadWeather();

    return () => {
      controller.abort();
    };
  }, [liveData.meeting, locale]);

  useEffect(() => {
    const meeting = liveData.meeting;

    if (!meeting) {
      setCircuitPhoto(null);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      meeting: meeting.meetingName,
      location: meeting.location || meeting.circuitShortName,
      circuit: meeting.circuitShortName,
      country: meeting.countryName,
    });

    async function loadCircuitPhoto() {
      try {
        const response = await fetch(`/api/circuit-photo?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | CircuitPhotoApiResponse
          | null;

        if (!controller.signal.aborted) {
          setCircuitPhoto(response.ok ? payload?.data ?? null : null);
        }
      } catch {
        if (!controller.signal.aborted) {
          setCircuitPhoto(null);
        }
      }
    }

    loadCircuitPhoto();

    return () => {
      controller.abort();
    };
  }, [liveData.meeting]);

  if (liveData.loading && !liveData.session) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white">
        <SessionHeader
          session={null}
          meeting={null}
          demo={demo}
          lastUpdated={null}
          lapSummary={{ current: null, total: null }}
          locale={locale}
          onRefresh={liveData.refresh}
          onToggleDemo={() => setDemo((value) => !value)}
          onLocaleChange={setLocale}
        />
        <div className="p-4 sm:p-6 lg:p-8">
          <LoadingState locale={locale} message={loadingMessage} />
        </div>
      </main>
    );
  }

  if (liveData.error && !liveData.session) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white">
        <SessionHeader
          session={null}
          meeting={null}
          demo={demo}
          lastUpdated={liveData.lastUpdated}
          lapSummary={lapSummary}
          locale={locale}
          onRefresh={liveData.refresh}
          onToggleDemo={() => setDemo((value) => !value)}
          onLocaleChange={setLocale}
        />
        <div className="p-4 sm:p-6 lg:p-8">
          <ErrorState message={liveData.error} locale={locale} onRetry={liveData.refresh} />
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen min-h-screen overflow-hidden bg-neutral-950 text-white">
      <WeatherBackdrop weather={weather} circuitPhoto={circuitPhoto} locale={locale} />
      <div className="relative z-10 flex h-screen min-h-0 flex-col">
        <SessionHeader
          session={liveData.session}
          meeting={liveData.meeting}
          demo={demo}
          lastUpdated={liveData.lastUpdated}
          lapSummary={lapSummary}
          locale={locale}
          onRefresh={liveData.refresh}
          onToggleDemo={() => setDemo((value) => !value)}
          onLocaleChange={setLocale}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4 lg:p-4">
          <StatusBanner
            session={liveData.session}
            demo={demo}
            error={liveData.error}
            rateLimited={liveData.rateLimited}
            partial={liveData.partial}
            tokenConfigured={liveData.tokenConfigured}
            messages={liveData.messages}
            locale={locale}
            onLoadLatest={liveData.refresh}
            onDemo={() => setDemo(true)}
          />

          <ViewTabs activeView={activeView} locale={locale} onChange={setActiveView} />

          {activeView === "track" ? (
            <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(12rem,0.58fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(34rem,0.54fr)] xl:grid-rows-[minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1fr)_40rem]">
              <TrackMap
                meeting={liveData.meeting}
                standings={liveData.standings}
                trackPoints={liveData.trackPoints}
                currentTrackPoints={liveData.currentTrackPoints}
                finishLine={liveData.finishLine}
                weather={weather}
                motionTimeMs={liveData.motionTimeMs}
                hoveredDriver={hoveredDriver}
                selectedDriverNumber={selectedDriverNumber}
                locale={locale}
                onHoverDriver={setHoveredDriver}
                onSelectDriver={setSelectedDriverNumber}
              />
              <div className="grid min-h-0 grid-cols-3 gap-3 xl:grid-cols-2 xl:grid-rows-[minmax(0,1fr)_minmax(8rem,0.7fr)]">
                <LiveStandings
                  rows={liveData.standings}
                  hoveredDriver={hoveredDriver}
                  selectedDriverNumber={selectedDriverNumber}
                  locale={locale}
                  onHoverDriver={setHoveredDriver}
                  onSelectDriver={setSelectedDriverNumber}
                />
                <RaceCommentary
                  messages={liveData.raceControlMessages}
                  drivers={liveData.drivers}
                  locale={locale}
                  onSelectDriver={setSelectedDriverNumber}
                />
                <div className="min-h-0 xl:col-span-2">
                  <MotorsportNews locale={locale} />
                </div>
              </div>
            </div>
          ) : activeView === "calendar" ? (
            <div className="min-h-0 flex-1">
              <RaceCalendar locale={locale} />
            </div>
          ) : (
            <div className="min-h-0 flex-1">
              <SeasonStandings locale={locale} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
