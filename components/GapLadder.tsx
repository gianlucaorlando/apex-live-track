"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, ArrowDown, ArrowUp, MousePointer2 } from "lucide-react";
import { DriverProfileCard } from "@/components/DriverProfileCard";
import type { GapHistory } from "@/components/GapHistoryChart";
import { circuitName, t, type Locale } from "@/lib/i18n";
import type { F1Meeting, F1Session, LiveStandingRow } from "@/types/f1";

interface GapLadderProps {
  session: F1Session | null;
  meeting: F1Meeting | null;
  standings: LiveStandingRow[];
  hoveredDriver: number | null;
  selectedDriverNumber: number | null;
  locale: Locale;
  onHoverDriver: (driverNumber: number | null) => void;
  onSelectDriver: (driverNumber: number | null) => void;
  /** Distacco dal leader per giro (da useGapHistory), per il simulatore. */
  gapHistory: GapHistory;
  gapHistoryVersion: number;
}

// Geometria della corsia, in pixel del contenitore.
const START_X = 34;
const END_PAD = 30;
const PILL_MIN_GAP_PX = 60;
// Fondo scala "a gradini": si passa al gradino successivo quando il distacco massimo
// cresce, e le posizioni si riassestano in modo animato (mai un salto secco).
const SCALE_STEPS = [8, 12, 18, 27, 40, 60, 90, 135, 200, 300];
const NICE_TICKS = [1, 2, 3, 5, 8, 12, 20, 30, 45, 60, 90, 120, 180, 240];

// Soglie: zona DRS (< 1 s dall'auto davanti) e "treno" (catena di auto entro 1.5 s).
const DRS_THRESHOLD_S = 1;
const TRAIN_THRESHOLD_S = 1.5;
// Tendenza: confronta l'intervallo attuale con quello di almeno TREND_WINDOW_MS fa.
const TREND_WINDOW_MS = 20000;
const TREND_HISTORY_MS = 60000;
const TREND_MIN_DELTA_S = 0.15;
const OVERTAKE_BANNER_MS = 3600;

type Trend = "gaining" | "losing";

// Colori mescola per il badge gomma (S/M/H/I/W).
const TYRE_COLOURS: Record<string, string> = {
  SOFT: "#ef4444",
  MEDIUM: "#facc15",
  HARD: "#f4f4f5",
  INTERMEDIATE: "#22c55e",
  WET: "#3b82f6",
};

function tyreLetter(compound: string | undefined): string {
  return compound ? compound.charAt(0).toUpperCase() : "?";
}

// Giri usati per stimare il ritmo di avvicinamento nel simulatore "chi arriva a chi".
const CATCH_WINDOW_LAPS = 3;
const CATCH_MIN_RATE_S = 0.05;

interface OvertakeEvent {
  id: number;
  kind: "overtake" | "pit";
  compound?: string;
  driverNumber: number;
  acronym: string;
  teamColour: string;
  position: number;
  victimAcronym: string | null;
}

function byPosition(a: LiveStandingRow, b: LiveStandingRow): number {
  return (a.position ?? 99) - (b.position ?? 99);
}

export function GapLadder({
  session,
  meeting,
  standings,
  hoveredDriver,
  selectedDriverNumber,
  locale,
  onHoverDriver,
  onSelectDriver,
  gapHistory,
  gapHistoryVersion,
}: GapLadderProps) {
  // Piloti animabili sulla corsia: in pista, non doppiati, con distacco numerico.
  const racers = useMemo(
    () =>
      standings
        .filter(
          (row) =>
            row.status !== "OUT" &&
            row.position !== null &&
            row.lappedCount === null &&
            row.gapSeconds !== null,
        )
        .sort(byPosition),
    [standings],
  );
  // Doppiati o senza dato numerico: elencati nella zona laterale, senza animazione.
  const sidelined = useMemo(
    () =>
      standings
        .filter(
          (row) =>
            row.status !== "OUT" &&
            row.position !== null &&
            (row.lappedCount !== null || row.gapSeconds === null),
        )
        .sort(byPosition),
    [standings],
  );

  const laneRef = useRef<HTMLDivElement | null>(null);
  const bandRef = useRef<HTMLDivElement | null>(null);
  const markerNodes = useRef(new Map<number, HTMLButtonElement>());
  const tickNodes = useRef(new Map<number, HTMLDivElement>());
  // Distacchi target (ultimo dato ricevuto) e stato smussato per l'animazione.
  const targetsRef = useRef(new Map<number, number>());
  const smoothRef = useRef(new Map<number, { gap: number; y: number }>());
  const scaleRef = useRef({ value: SCALE_STEPS[0], step: SCALE_STEPS[0] });
  const [scaleStep, setScaleStep] = useState(SCALE_STEPS[0]);
  const trainNodes = useRef(new Map<number, HTMLDivElement>());
  const drsNodes = useRef(new Map<number, HTMLDivElement>());
  // Membri di treni e coppie DRS, letti dal loop rAF per posizionare gli overlay.
  const trainsRef = useRef<{ key: number; members: number[] }[]>([]);
  const drsPairsRef = useRef<{ chaser: number; ahead: number }[]>([]);
  const intervalHistoryRef = useRef(new Map<number, { t: number; interval: number }[]>());
  const [trends, setTrends] = useState<Map<number, Trend>>(new Map());
  const previousPositionsRef = useRef<Map<number, number> | null>(null);
  const overtakeIdRef = useRef(0);
  const [overtakes, setOvertakes] = useState<OvertakeEvent[]>([]);
  const previousStintsRef = useRef<Map<number, number> | null>(null);

  const pushEvents = (events: OvertakeEvent[]) => {
    if (events.length === 0) {
      return;
    }

    setOvertakes((current) => [...current, ...events].slice(-3));
    const ids = new Set(events.map((event) => event.id));
    window.setTimeout(() => {
      setOvertakes((current) => current.filter((event) => !ids.has(event.id)));
    }, OVERTAKE_BANNER_MS);
  };

  // Pit stop: il numero di stint aumenta → banner con la nuova mescola.
  useEffect(() => {
    const stints = new Map<number, number>();
    const previous = previousStintsRef.current;
    const events: OvertakeEvent[] = [];

    for (const row of standings) {
      if (!row.tyre) {
        continue;
      }

      stints.set(row.driverNumber, row.tyre.stintNumber);
      const before = previous?.get(row.driverNumber);

      if (before !== undefined && row.tyre.stintNumber > before) {
        overtakeIdRef.current += 1;
        events.push({
          id: overtakeIdRef.current,
          kind: "pit",
          compound: row.tyre.compound,
          driverNumber: row.driverNumber,
          acronym: row.acronym,
          teamColour: row.teamColour,
          position: row.position ?? 0,
          victimAcronym: null,
        });
      }
    }

    previousStintsRef.current = stints;
    pushEvents(events);
    // pushEvents usa solo setter stabili
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standings]);

  // Treni (gruppi consecutivi entro TRAIN_THRESHOLD_S) e coppie in zona DRS.
  const { trains, drsPairs } = useMemo(() => {
    const groups: { key: number; members: number[] }[] = [];
    const pairs: { chaser: number; ahead: number }[] = [];
    let current: number[] = [];

    racers.forEach((row, index) => {
      const ahead = index > 0 ? racers[index - 1] : null;
      const interval = row.intervalSeconds;
      const linked = ahead !== null && interval !== null && interval < TRAIN_THRESHOLD_S;

      if (ahead && interval !== null && interval < DRS_THRESHOLD_S) {
        pairs.push({ chaser: row.driverNumber, ahead: ahead.driverNumber });
      }

      if (linked) {
        current.push(row.driverNumber);
      } else {
        if (current.length >= 3) {
          groups.push({ key: current[0], members: current });
        }
        current = [row.driverNumber];
      }
    });

    if (current.length >= 3) {
      groups.push({ key: current[0], members: current });
    }

    return { trains: groups, drsPairs: pairs };
  }, [racers]);

  useEffect(() => {
    trainsRef.current = trains;
    drsPairsRef.current = drsPairs;
  }, [trains, drsPairs]);

  // Tendenza dell'intervallo dall'auto davanti, su una finestra di ~20 s.
  useEffect(() => {
    const now = Date.now();
    const history = intervalHistoryRef.current;
    const next = new Map<number, Trend>();

    for (const row of racers) {
      if (row.intervalSeconds === null || row.position === 1) {
        history.delete(row.driverNumber);
        continue;
      }

      const samples = (history.get(row.driverNumber) ?? []).filter(
        (sample) => now - sample.t <= TREND_HISTORY_MS,
      );
      const last = samples.at(-1);

      if (!last || last.interval !== row.intervalSeconds) {
        samples.push({ t: now, interval: row.intervalSeconds });
      }

      history.set(row.driverNumber, samples);
      const reference = [...samples].reverse().find((sample) => now - sample.t >= TREND_WINDOW_MS);

      if (reference) {
        const delta = row.intervalSeconds - reference.interval;

        if (delta <= -TREND_MIN_DELTA_S) {
          next.set(row.driverNumber, "gaining");
        } else if (delta >= TREND_MIN_DELTA_S) {
          next.set(row.driverNumber, "losing");
        }
      }
    }

    setTrends(next);
  }, [racers]);

  // Sorpassi: un pilota guadagna 1-2 posizioni rispetto all'ultimo aggiornamento.
  // Salti piu' grandi (cicli di pit stop, riallineamenti dei dati) sono ignorati.
  useEffect(() => {
    const positions = new Map<number, number>();

    for (const row of racers) {
      positions.set(row.driverNumber, row.position!);
    }

    const previous = previousPositionsRef.current;
    previousPositionsRef.current = positions;

    if (!previous) {
      return;
    }

    const events: OvertakeEvent[] = [];

    for (const row of racers) {
      const before = previous.get(row.driverNumber);
      const now = row.position!;

      if (before === undefined || before - now < 1 || before - now > 2) {
        continue;
      }

      const victimNumber = [...previous].find(([, position]) => position === now)?.[0];
      const victim = racers.find((other) => other.driverNumber === victimNumber);

      if (victim && (positions.get(victim.driverNumber) ?? 0) <= now) {
        continue;
      }

      overtakeIdRef.current += 1;
      events.push({
        id: overtakeIdRef.current,
        kind: "overtake",
        driverNumber: row.driverNumber,
        acronym: row.acronym,
        teamColour: row.teamColour,
        position: now,
        victimAcronym: victim?.acronym ?? null,
      });
    }

    pushEvents(events);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [racers]);

  useEffect(() => {
    const targets = new Map<number, number>();

    for (const row of racers) {
      targets.set(row.driverNumber, Math.max(row.gapSeconds ?? 0, 0));
    }

    targetsRef.current = targets;

    for (const key of [...smoothRef.current.keys()]) {
      if (!targets.has(key)) {
        smoothRef.current.delete(key);
      }
    }
  }, [racers]);

  // Le pillole appena montate partono fuori vista finche' il primo frame del loop
  // rAF non le posiziona (il transform e' di proprieta' del loop, mai di React).
  useLayoutEffect(() => {
    for (const node of markerNodes.current.values()) {
      if (!node.style.transform) {
        node.style.transform = "translate(-9999px, -9999px)";
      }
    }
  }, [racers]);

  // Dopo una pausa lunga (tab nascosto: rAF fermo) i dati sono vecchi: al ritorno
  // visibile si riallinea subito ai target invece di inscenare una "rimonta" finta.
  useEffect(() => {
    function snapToTargets() {
      if (document.visibilityState !== "visible") {
        return;
      }

      for (const [driverNumber, target] of targetsRef.current) {
        const state = smoothRef.current.get(driverNumber);

        if (state) {
          state.gap = target;
        }
      }

      scaleRef.current.value = scaleRef.current.step;
    }

    document.addEventListener("visibilitychange", snapToTargets);

    return () => {
      document.removeEventListener("visibilitychange", snapToTargets);
    };
  }, []);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const frame = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const lane = laneRef.current;

      if (lane) {
        const width = lane.clientWidth;
        const laneHeight = lane.clientHeight;
        const bandHeight = bandRef.current?.offsetHeight ?? 128;
        const usable = Math.max(width - START_X - END_PAD, 40);
        const targets = targetsRef.current;
        const maxTarget = targets.size > 0 ? Math.max(...targets.values()) : 0;
        const desiredStep =
          SCALE_STEPS.find((step) => step >= maxTarget * 1.08) ?? SCALE_STEPS.at(-1)!;

        if (desiredStep !== scaleRef.current.step) {
          scaleRef.current.step = desiredStep;
          setScaleStep(desiredStep);
        }

        // Il fondo scala insegue il gradino target, cosi' un cambio di scala
        // scivola invece di scattare.
        const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 1.7);
        scaleRef.current.value +=
          (desiredStep - scaleRef.current.value) *
          (reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 2));
        const scale = scaleRef.current.value;

        const items: { driverNumber: number; x: number }[] = [];
        const xByDriver = new Map<number, number>();

        for (const [driverNumber, target] of targets) {
          let state = smoothRef.current.get(driverNumber);

          if (!state) {
            state = { gap: target, y: 0 };
            smoothRef.current.set(driverNumber, state);
          }

          state.gap += (target - state.gap) * ease;
          const fraction = Math.min(Math.sqrt(Math.max(state.gap, 0) / scale), 1);
          const x = START_X + fraction * usable;
          items.push({ driverNumber, x });
          xByDriver.set(driverNumber, x);
        }

        // Overlay treni: sfondo che abbraccia dal primo all'ultimo membro.
        for (const train of trainsRef.current) {
          const node = trainNodes.current.get(train.key);
          const xs = train.members
            .map((member) => xByDriver.get(member))
            .filter((x): x is number => x !== undefined);

          if (node && xs.length > 0) {
            const left = Math.min(...xs) - 34;
            node.style.left = `${left.toFixed(1)}px`;
            node.style.width = `${(Math.max(...xs) + 34 - left).toFixed(1)}px`;
          }
        }

        // Connettori DRS tra inseguitore e auto davanti.
        for (const pair of drsPairsRef.current) {
          const node = drsNodes.current.get(pair.chaser);
          const aheadX = xByDriver.get(pair.ahead);
          const chaserX = xByDriver.get(pair.chaser);

          if (node && aheadX !== undefined && chaserX !== undefined) {
            node.style.left = `${aheadX.toFixed(1)}px`;
            node.style.width = `${Math.max(chaserX - aheadX, 2).toFixed(1)}px`;
          }
        }

        // Anti-sovrapposizione: pillole ordinate per x, sfalsate su cinque
        // sotto-corsie ricavate dall'altezza reale del nastro.
        const maxOffset = Math.max(22, Math.min(60, bandHeight / 2 - 26));
        const laneOffsets = [0, -maxOffset / 2, maxOffset / 2, -maxOffset, maxOffset];
        items.sort((a, b) => a.x - b.x);
        const laneLastX = laneOffsets.map(() => -Infinity);

        for (const item of items) {
          let laneIndex = laneLastX.findIndex(
            (lastX) => item.x - lastX >= PILL_MIN_GAP_PX,
          );

          if (laneIndex === -1) {
            laneIndex = laneLastX.indexOf(Math.min(...laneLastX));
          }

          laneLastX[laneIndex] = item.x;
          const state = smoothRef.current.get(item.driverNumber)!;
          state.y += (laneOffsets[laneIndex] - state.y) * ease;
          const node = markerNodes.current.get(item.driverNumber);

          if (node) {
            node.style.transform = `translate(${item.x.toFixed(1)}px, ${state.y.toFixed(1)}px) translate(-50%, -50%)`;
          }
        }

        const tickTop = Math.min(laneHeight / 2 + bandHeight / 2 + 6, laneHeight - 28);

        for (const [tickValue, node] of tickNodes.current) {
          const fraction = Math.min(Math.sqrt(tickValue / scale), 1);
          node.style.left = `${(START_X + fraction * usable).toFixed(1)}px`;
          node.style.top = `${tickTop.toFixed(1)}px`;
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  const tickValues = useMemo(() => {
    const inRange = NICE_TICKS.filter((value) => value <= scaleStep);
    return [0, ...inRange.slice(-4)];
  }, [scaleStep]);

  const hasLane = racers.length >= 2;
  const isRace = session?.sessionType?.toLowerCase().includes("race") ?? true;
  const selectedRow =
    standings.find((row) => row.driverNumber === selectedDriverNumber) ?? null;

  // Simulatore: ritmo medio di avvicinamento all'auto davanti sugli ultimi giri.
  const catchEstimate = useMemo(() => {
    const focusNumber = hoveredDriver ?? selectedDriverNumber;
    const index = racers.findIndex((row) => row.driverNumber === focusNumber);

    if (index <= 0) {
      return null;
    }

    const chaser = racers[index];
    const ahead = racers[index - 1];
    const chaserLaps = gapHistory.get(chaser.driverNumber);
    const aheadLaps = gapHistory.get(ahead.driverNumber);
    const lap = chaser.currentLap;
    const now = chaser.intervalSeconds;
    const pastLap = lap !== null ? lap - CATCH_WINDOW_LAPS : null;
    const chaserPast = pastLap !== null ? chaserLaps?.get(pastLap) : undefined;
    const aheadPast = pastLap !== null ? aheadLaps?.get(pastLap) : undefined;

    if (now === null || chaserPast === undefined || aheadPast === undefined) {
      return { chaser, ahead, text: t(locale, "catchNeedData"), tone: "muted" as const };
    }

    const rate = (chaserPast - aheadPast - now) / CATCH_WINDOW_LAPS;

    if (rate > CATCH_MIN_RATE_S) {
      const target = ahead.acronym;
      const text =
        now > DRS_THRESHOLD_S
          ? t(locale, "catchDrs", { target, laps: Math.ceil((now - DRS_THRESHOLD_S) / rate) })
          : t(locale, "catchCatch", { target, laps: Math.max(1, Math.ceil(now / rate)) });
      return { chaser, ahead, text, tone: "good" as const };
    }

    if (rate < -CATCH_MIN_RATE_S) {
      return {
        chaser,
        ahead,
        text: t(locale, "catchAway", { target: ahead.acronym, rate: (-rate).toFixed(2) }),
        tone: "bad" as const,
      };
    }

    return { chaser, ahead, text: t(locale, "catchStable", { target: ahead.acronym }), tone: "muted" as const };
  // gapHistoryVersion: la mappa e' mutata in place, la versione segnala i nuovi dati
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gapHistory, gapHistoryVersion, hoveredDriver, locale, racers, selectedDriverNumber]);

  return (
    <section
      aria-label={t(locale, "gapLadderAria")}
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-line bg-white"
    >
      <div className="flex flex-none items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-red-600" aria-hidden="true" />
          <h2 className="truncate text-[13px] font-bold uppercase tracking-[0.08em] text-ink">
            {t(locale, "gapLadderTitle")}
          </h2>
        </div>
        <div className="flex min-w-0 items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          <span className="hidden truncate sm:inline">
            {circuitName(locale, meeting?.circuitShortName)}
          </span>
          <span className="hidden flex-none md:inline">{t(locale, "gapLadderHint")}</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div ref={laneRef} className="relative min-w-0 flex-1" onClick={() => onSelectDriver(null)}>
          {/* Nastro della corsia: piu' luminoso verso il leader, altezza adattiva */}
          <div
            ref={bandRef}
            className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 rounded-md border border-line bg-soft"
            style={{ height: "clamp(6rem, 62%, 11rem)" }}
          >
            <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-line" />
            {/* Blocco di partenza a scacchi in corrispondenza del leader */}
            <div
              className="absolute bottom-1 top-1 w-2 rounded-sm opacity-70 [background:repeating-conic-gradient(#e5e5e5_0%_25%,#0a0a0a_0%_50%)_0_0/8px_8px]"
              style={{ left: START_X - 12 - 4 }}
            />
          </div>

          {/* Treni: gruppi di 3+ auto entro 1.5 s l'una dall'altra */}
          {trains.map((train) => (
            <div
              key={`train-${train.key}`}
              ref={(node) => {
                if (node) {
                  trainNodes.current.set(train.key, node);
                } else {
                  trainNodes.current.delete(train.key);
                }
              }}
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-lg border border-amber-300/60 bg-amber-100/40"
              style={{ left: -9999, width: 0, height: "clamp(6.5rem, 66%, 11.5rem)" }}
            >
              <span className="absolute -top-2.5 left-3 rounded bg-amber-400/90 px-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-ink">
                {t(locale, "gapLadderTrain")} ×{train.members.length}
              </span>
            </div>
          ))}

          {/* Zona DRS: arco luminoso tra le due auto */}
          {drsPairs.map((pair) => (
            <div
              key={`drs-${pair.chaser}`}
              ref={(node) => {
                if (node) {
                  drsNodes.current.set(pair.chaser, node);
                } else {
                  drsNodes.current.delete(pair.chaser);
                }
              }}
              className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-emerald-400"
              style={{ left: -9999, width: 0 }}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-emerald-400 px-1 text-[8px] font-black tracking-wider text-ink">
                DRS
              </span>
            </div>
          ))}

          {/* Banner sorpassi */}
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[70] flex flex-col items-center gap-1.5">
            {overtakes.map((event) => (
              <div
                key={event.id}
                className="animate-overtake-banner flex items-center gap-2 overflow-hidden rounded-md border border-yellow-300/60 bg-white py-1 pl-0 pr-3 shadow-sm"
              >
                <span className="h-6 w-1.5" style={{ backgroundColor: event.teamColour }} />
                <span className="text-xs font-black tracking-wide text-ink">
                  {event.acronym}
                </span>
                {event.kind === "pit" ? (
                  <>
                    <span className="text-[10px] font-semibold uppercase text-ink">
                      {t(locale, "pitBanner")}
                    </span>
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white text-[9px] font-black text-ink"
                      style={{ borderColor: TYRE_COLOURS[event.compound ?? ""] ?? "#a3a3a3" }}
                    >
                      {tyreLetter(event.compound)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-semibold uppercase text-ink">
                      {t(locale, "gapLadderOvertake")}
                    </span>
                    {event.victimAcronym ? (
                      <span className="text-xs font-black text-ink">{event.victimAcronym}</span>
                    ) : null}
                    <span className="rounded bg-yellow-300 px-1.5 text-[10px] font-black text-ink">
                      ↗ P{event.position}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Tacche della scala (posizionate dal loop rAF) */}
          {tickValues.map((value) => (
            <div
              key={`${scaleStep}-${value}`}
              ref={(node) => {
                if (node) {
                  tickNodes.current.set(value, node);
                } else {
                  tickNodes.current.delete(value);
                }
              }}
              // left/top sono di proprieta' del loop rAF; parte fuori vista.
              className="pointer-events-none absolute -translate-x-1/2 text-center"
              style={{ left: -9999, top: 0 }}
            >
              <div className="mx-auto h-2 w-px bg-line/70" />
              <div className="mt-0.5 text-[10px] font-semibold text-muted">
                {value === 0 ? "0s" : `+${value}s`}
              </div>
            </div>
          ))}

          {/* Pillole piloti (transform di proprieta' del loop rAF) */}
          {racers.map((row) => {
            const active =
              hoveredDriver === row.driverNumber ||
              selectedDriverNumber === row.driverNumber;
            const dimmed = hoveredDriver !== null && !active;
            const trend = trends.get(row.driverNumber);
            const flashing = overtakes.some(
              (event) => event.kind === "overtake" && event.driverNumber === row.driverNumber,
            );
            const inPit = row.status === "PIT";

            return (
              <button
                key={row.driverNumber}
                type="button"
                ref={(node) => {
                  if (node) {
                    markerNodes.current.set(row.driverNumber, node);
                  } else {
                    markerNodes.current.delete(row.driverNumber);
                  }
                }}
                title={`${row.fullName} — ${row.gap} (${row.interval})`}
                aria-pressed={selectedDriverNumber === row.driverNumber}
                onMouseEnter={() => onHoverDriver(row.driverNumber)}
                onMouseLeave={() => onHoverDriver(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectDriver(
                    selectedDriverNumber === row.driverNumber ? null : row.driverNumber,
                  );
                }}
                className={`absolute left-0 top-1/2 flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-left transition-[opacity,box-shadow] duration-150 ${flashing ? "animate-overtake-flash border-yellow-300/80" : ""} focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
                  active
                    ? "border-ink bg-white shadow-md"
                    : "border-line bg-white hover:border-muted"
                } ${inPit ? "border-dashed" : ""}`}
                style={{
                  // transform intenzionalmente mai impostato qui: e' del loop rAF.
                  willChange: "transform",
                  zIndex: active ? 60 : 40 - (row.position ?? 30),
                  opacity: dimmed ? 0.45 : 1,
                }}
              >
                <span
                  className="h-2.5 w-2.5 flex-none rounded-full"
                  style={{ backgroundColor: row.teamColour }}
                />
                <span className="text-[10px] font-semibold text-muted">
                  {row.position}
                </span>
                <span className="text-[11px] font-black tracking-wide text-ink">
                  {row.acronym}
                </span>
                {row.tyre ? (
                  <span
                    className="flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full border-[1.5px] text-[7px] font-black text-ink"
                    style={{ borderColor: TYRE_COLOURS[row.tyre.compound] ?? "#a3a3a3" }}
                    title={row.tyre.compound}
                  >
                    {tyreLetter(row.tyre.compound)}
                  </span>
                ) : null}
                {inPit ? (
                  <span className="rounded bg-cyan-400 px-1 text-[8px] font-black text-ink">
                    {t(locale, "gapLadderPit")}
                  </span>
                ) : null}
                {active && row.position !== 1 ? (
                  <span className="text-[9px] font-semibold text-ink">
                    {row.interval}
                  </span>
                ) : null}
                {trend === "gaining" ? (
                  <ArrowUp
                    className="h-3 w-3 flex-none text-emerald-600"
                    aria-label={t(locale, "gapLadderGaining")}
                  />
                ) : trend === "losing" ? (
                  <ArrowDown
                    className="h-3 w-3 flex-none text-red-600"
                    aria-label={t(locale, "gapLadderLosing")}
                  />
                ) : null}
              </button>
            );
          })}

          {!hasLane ? (
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-lg border border-line bg-white p-4 text-sm text-muted">
              <div className="flex items-center gap-2 font-semibold text-ink">
                <MousePointer2 className="h-4 w-4 flex-none text-cyan-600" aria-hidden="true" />
                {t(locale, isRace ? "gapLadderEmpty" : "gapLadderRaceOnly")}
              </div>
            </div>
          ) : null}
        </div>

        {sidelined.length > 0 ? (
          <aside className="flex w-28 flex-none flex-col border-l border-dashed border-line px-2 py-3">
            <div className="px-1 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-muted">
              {t(locale, "gapLadderLapped")}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
              {sidelined.map((row) => {
                const active =
                  hoveredDriver === row.driverNumber ||
                  selectedDriverNumber === row.driverNumber;

                return (
                  <button
                    key={row.driverNumber}
                    type="button"
                    title={`${row.fullName} — ${row.gap}`}
                    aria-pressed={selectedDriverNumber === row.driverNumber}
                    onMouseEnter={() => onHoverDriver(row.driverNumber)}
                    onMouseLeave={() => onHoverDriver(null)}
                    onClick={() =>
                      onSelectDriver(
                        selectedDriverNumber === row.driverNumber ? null : row.driverNumber,
                      )
                    }
                    className={`flex flex-none cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
                      active
                        ? "border-line bg-line/70"
                        : "border-line bg-white hover:border-line"
                    }`}
                  >
                    <span
                      className="h-2 w-2 flex-none rounded-full"
                      style={{ backgroundColor: row.teamColour }}
                    />
                    <span className="text-[10px] font-black text-ink">{row.acronym}</span>
                    {row.lappedCount !== null ? (
                      <span className="ml-auto text-[9px] font-semibold text-ink">
                        {t(locale, "gapLadderLappedShort", { laps: row.lappedCount })}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </aside>
        ) : null}
      </div>

      {catchEstimate ? (
        <div className="pointer-events-none absolute left-4 top-3 z-[65] max-w-xs rounded-md border border-line bg-white px-3 py-2 shadow-sm">
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-muted">
            {t(locale, "catchTitle")} · {catchEstimate.chaser.acronym} → {catchEstimate.ahead.acronym}
          </div>
          <div
            className={`mt-0.5 text-xs font-bold ${
              catchEstimate.tone === "good"
                ? "text-emerald-600"
                : catchEstimate.tone === "bad"
                  ? "text-red-600"
                  : "text-ink"
            }`}
          >
            {catchEstimate.text}
          </div>
        </div>
      ) : null}

      {selectedRow ? (
        <DriverProfileCard
          driver={selectedRow}
          locale={locale}
          onClose={() => onSelectDriver(null)}
        />
      ) : null}
    </section>
  );
}
