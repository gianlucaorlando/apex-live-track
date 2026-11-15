"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, CalendarDays, LineChart, Map, Trophy } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";
import { GapHistoryChart } from "@/components/GapHistoryChart";
import { GapLadder } from "@/components/GapLadder";
import { LiveStandings } from "@/components/LiveStandings";
import { LoadingState } from "@/components/LoadingState";
import { RaceCalendar } from "@/components/RaceCalendar";
import { RaceCommentary } from "@/components/RaceCommentary";
import { SessionDataPanel } from "@/components/SessionDataPanel";
import { TelemetryHud } from "@/components/TelemetryHud";
import { SessionHeader } from "@/components/SessionHeader";
import { SeasonStandings } from "@/components/SeasonStandings";
import { StatusBanner } from "@/components/StatusBanner";
import { TrackMap } from "@/components/TrackMap";
import { useF1LiveData } from "@/hooks/useF1LiveData";
import { useGapHistory } from "@/hooks/useGapHistory";
import { useSessionInsights } from "@/hooks/useSessionInsights";
import { DEFAULT_LOCALE, normalizeLocale, t, type Locale } from "@/lib/i18n";
import type { RaceWeather, WeatherApiResponse } from "@/types/weather";

interface DashboardProps {
  initialDemo: boolean;
}

type DashboardView = "track" | "calendar" | "season-standings";

// Visualizzazione della vista "Tracciato": corsia dei distacchi (fluida, basata su
// intervalli scalari), grafico dei distacchi per giro oppure mappa del circuito.
type TrackViewMode = "ladder" | "chart" | "map";

const TRACK_VIEW_MODE_STORAGE_KEY = "f1-live-track-view-mode";

interface TrackViewToggleProps {
  mode: TrackViewMode;
  locale: Locale;
  onChange: (mode: TrackViewMode) => void;
}

function TrackViewToggle({ mode, locale, onChange }: TrackViewToggleProps) {
  const options: { mode: TrackViewMode; label: string; icon: typeof Map }[] = [
    { mode: "ladder", label: t(locale, "viewModeLadder"), icon: ArrowRightLeft },
    { mode: "chart", label: t(locale, "viewModeChart"), icon: LineChart },
    { mode: "map", label: t(locale, "viewModeMap"), icon: Map },
  ];

  return (
    <nav
      className="flex flex-none items-center overflow-hidden rounded-md border border-line bg-white"
      aria-label={t(locale, "viewModeAria")}
    >
      {options.map((option) => {
        const active = mode === option.mode;
        const Icon = option.icon;

        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => onChange(option.mode)}
            className={`inline-flex h-7 items-center gap-1.5 border-r border-line px-3 font-display text-xs font-semibold transition last:border-r-0 ${
              active ? "bg-ink text-white" : "text-muted hover:bg-soft hover:text-ink"
            }`}
            aria-pressed={active}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </nav>
  );
}

interface ViewTabsProps {
  activeView: DashboardView;
  locale: Locale;
  onChange: (view: DashboardView) => void;
}

function ViewTabs({ activeView, locale, onChange, lapLabel }: ViewTabsProps & { lapLabel: string | null }) {
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
      className="flex h-11 flex-none items-end gap-7 border-b border-line bg-white px-4 sm:px-6"
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
            className={`inline-flex items-center gap-2 border-b-[3px] pb-2.5 font-display text-[13px] font-bold uppercase tracking-[0.06em] transition ${
              active ? "border-f1red text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
            aria-pressed={active}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {tab.label}
          </button>
        );
      })}
      {lapLabel ? (
        <span className="ml-auto pb-2.5 font-display text-[13px] font-semibold text-muted">{lapLabel}</span>
      ) : null}
    </nav>
  );
}

export function Dashboard({ initialDemo }: DashboardProps) {
  const [demo, setDemo] = useState(initialDemo);
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [localeHydrated, setLocaleHydrated] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>("track");
  const [trackViewMode, setTrackViewMode] = useState<TrackViewMode>("ladder");
  const [trackViewHydrated, setTrackViewHydrated] = useState(false);
  const [hoveredDriver, setHoveredDriver] = useState<number | null>(null);
  const [selectedDriverNumber, setSelectedDriverNumber] = useState<number | null>(null);
  const [weather, setWeather] = useState<RaceWeather | null>(null);
  const liveData = useF1LiveData(demo, locale);
  const loadingMessage = demo
    ? t(locale, "loadingDemoReplay")
    : t(locale, "loadingLatestSession");
  const { insights, telemetry } = useSessionInsights(
    liveData.session?.sessionKey ?? null,
    liveData.isLive,
    liveData.buildRequestParams,
    selectedDriverNumber,
  );
  const telemetryDriver =
    liveData.standings.find((row) => row.driverNumber === selectedDriverNumber) ?? null;
  const gapHistory = useGapHistory(
    liveData.standings,
    liveData.session?.sessionKey ?? null,
    insights?.gapByLap ?? null,
  );
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

  // Link diretti: ?view=calendar | season-standings apre una sezione, ?mode=ladder | chart | map una vista del tracciato.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const view = query.get("view");
    const mode = query.get("mode");
    if (mode === "ladder" || mode === "chart" || mode === "map") {
      setTrackViewMode(mode);
    }
    if (view === "calendar" || view === "season-standings" || view === "track") {
      setActiveView(view);
    }
  }, []);

  useEffect(() => {
    setLocale(normalizeLocale(window.localStorage.getItem("f1-live-track-locale")));
    setLocaleHydrated(true);
  }, []);

  useEffect(() => {
    // Il parametro ?mode= nell'URL ha la precedenza sulla scelta salvata.
    const stored = new URLSearchParams(window.location.search).has("mode")
      ? null
      : window.localStorage.getItem(TRACK_VIEW_MODE_STORAGE_KEY);

    if (stored === "neon") {
      setTrackViewMode("map");
    } else if (stored === "ladder" || stored === "chart" || stored === "map") {
      setTrackViewMode(stored);
    }

    setTrackViewHydrated(true);
  }, []);

  useEffect(() => {
    if (trackViewHydrated) {
      window.localStorage.setItem(TRACK_VIEW_MODE_STORAGE_KEY, trackViewMode);
    }
  }, [trackViewHydrated, trackViewMode]);

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
    // Re-fetch periodically so the displayed conditions stay current throughout
    // a long session (matches the server-side 10-minute cache TTL).
    const intervalId = setInterval(loadWeather, 10 * 60 * 1000);

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [liveData.meeting, locale]);

  if (liveData.loading && !liveData.session) {
    return (
      <main className="min-h-screen bg-page text-ink">
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
      <main className="min-h-screen bg-page text-ink">
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
    <main className="relative h-screen min-h-screen overflow-hidden bg-page text-ink">
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
          weather={weather}
          trackWeather={insights?.weather ?? null}
        />

        <ViewTabs
          activeView={activeView}
          locale={locale}
          onChange={setActiveView}
          lapLabel={
            lapSummary.current
              ? `${t(locale, "lapProgress")} ${lapSummary.current} / ${lapSummary.total ?? "-"}`
              : null
          }
        />

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
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

          {activeView === "track" ? (
            <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(12rem,0.58fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(46rem,0.95fr)] xl:grid-rows-[minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1fr)_56rem]">
              <div className="relative flex min-h-0 flex-col gap-2">
                {telemetryDriver ? (
                  <div className="pointer-events-none absolute bottom-3 left-3 z-[80]">
                    <TelemetryHud
                      driver={telemetryDriver}
                      samples={telemetry}
                      locale={locale}
                      onClose={() => setSelectedDriverNumber(null)}
                    />
                  </div>
                ) : null}
                <TrackViewToggle
                  mode={trackViewMode}
                  locale={locale}
                  onChange={setTrackViewMode}
                />
                {trackViewMode === "ladder" ? (
                  <div className="min-h-0 flex-1">
                    <GapLadder
                      session={liveData.session}
                      meeting={liveData.meeting}
                      standings={liveData.standings}
                      hoveredDriver={hoveredDriver}
                      selectedDriverNumber={selectedDriverNumber}
                      locale={locale}
                      onHoverDriver={setHoveredDriver}
                      onSelectDriver={setSelectedDriverNumber}
                      gapHistory={gapHistory.history}
                      gapHistoryVersion={gapHistory.version}
                    />
                  </div>
                ) : trackViewMode === "chart" ? (
                  <section className="panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
                    <div className="flex flex-none items-center gap-2 border-b border-line px-4 py-3">
                      <LineChart className="h-4 w-4 text-cyan-600" aria-hidden="true" />
                      <h2 className="panel-title text-sm font-black uppercase tracking-[0.18em]">
                        {t(locale, "gapChartTitle")}
                      </h2>
                    </div>
                    <div className="min-h-0 flex-1 px-3 pb-2 pt-3">
                      <GapHistoryChart
                        history={gapHistory.history}
                        version={gapHistory.version}
                        standings={liveData.standings}
                        hoveredDriver={hoveredDriver}
                        selectedDriverNumber={selectedDriverNumber}
                        locale={locale}
                      />
                    </div>
                  </section>
                ) : (
                  <div className="min-h-0 flex-1">
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
                      skin="classic"
                      onHoverDriver={setHoveredDriver}
                      onSelectDriver={setSelectedDriverNumber}
                    />
                  </div>
                )}
              </div>
              <div className="grid min-h-0 grid-cols-3 gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)_minmax(8rem,0.62fr)]">
                <LiveStandings
                  rows={liveData.standings}
                  hoveredDriver={hoveredDriver}
                  selectedDriverNumber={selectedDriverNumber}
                  locale={locale}
                  onHoverDriver={setHoveredDriver}
                  onSelectDriver={setSelectedDriverNumber}
                  insights={insights}
                />
                <RaceCommentary
                  messages={liveData.raceControlMessages}
                  drivers={liveData.drivers}
                  locale={locale}
                  onSelectDriver={setSelectedDriverNumber}
                  teamRadio={insights?.teamRadio}
                  pitStops={insights?.pitStops}
                  overtakes={insights?.overtakes}
                />
                <div className="min-h-0 xl:col-span-2">
                  <SessionDataPanel
                    insights={insights}
                    standings={liveData.standings}
                    locale={locale}
                    onSelectDriver={setSelectedDriverNumber}
                  />
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
