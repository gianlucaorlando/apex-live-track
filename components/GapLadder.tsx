"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, MousePointer2 } from "lucide-react";
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
}

// Geometria della corsia, in pixel del contenitore.
const START_X = 34;
const END_PAD = 30;
const PILL_MIN_GAP_PX = 60;
// Fondo scala "a gradini": si passa al gradino successivo quando il distacco massimo
// cresce, e le posizioni si riassestano in modo animato (mai un salto secco).
const SCALE_STEPS = [8, 12, 18, 27, 40, 60, 90, 135, 200, 300];
const NICE_TICKS = [1, 2, 3, 5, 8, 12, 20, 30, 45, 60, 90, 120, 180, 240];

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

        for (const [driverNumber, target] of targets) {
          let state = smoothRef.current.get(driverNumber);

          if (!state) {
            state = { gap: target, y: 0 };
            smoothRef.current.set(driverNumber, state);
          }

          state.gap += (target - state.gap) * ease;
          const fraction = Math.min(Math.sqrt(Math.max(state.gap, 0) / scale), 1);
          items.push({ driverNumber, x: START_X + fraction * usable });
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

  return (
    <section
      aria-label={t(locale, "gapLadderAria")}
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/18 shadow-2xl backdrop-blur-[2px]"
    >
      <div className="flex flex-none items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-red-300" aria-hidden="true" />
          <h2 className="truncate text-sm font-black uppercase tracking-[0.16em] text-white">
            {t(locale, "gapLadderTitle")}
          </h2>
        </div>
        <div className="flex min-w-0 items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
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
            className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.09] via-white/[0.05] to-white/[0.02]"
            style={{ height: "clamp(6rem, 62%, 11rem)" }}
          >
            <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-white/15" />
            {/* Blocco di partenza a scacchi in corrispondenza del leader */}
            <div
              className="absolute bottom-1 top-1 w-2 rounded-sm opacity-70 [background:repeating-conic-gradient(#e5e5e5_0%_25%,#0a0a0a_0%_50%)_0_0/8px_8px]"
              style={{ left: START_X - 12 - 4 }}
            />
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
              <div className="mx-auto h-2 w-px bg-white/25" />
              <div className="mt-0.5 font-mono text-[10px] font-semibold text-white/45">
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
            const inBattle =
              row.intervalSeconds !== null &&
              row.intervalSeconds < 1 &&
              row.position !== 1;

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
                className={`absolute left-0 top-1/2 flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-left backdrop-blur-sm transition-[opacity,box-shadow] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                  active
                    ? "border-white/70 bg-white/15 shadow-lg shadow-black/40"
                    : "border-white/15 bg-neutral-950/85 hover:border-white/40"
                }`}
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
                <span className="font-mono text-[10px] font-semibold text-neutral-400">
                  {row.position}
                </span>
                <span className="text-[11px] font-black tracking-wide text-white">
                  {row.acronym}
                </span>
                {active && row.position !== 1 ? (
                  <span className="font-mono text-[9px] font-semibold text-cyan-100/80">
                    {row.interval}
                  </span>
                ) : null}
                {inBattle ? (
                  <span
                    className="h-1.5 w-1.5 flex-none animate-pulse rounded-full bg-red-400 motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })}

          {!hasLane ? (
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-neutral-950/74 p-4 text-sm text-neutral-300 backdrop-blur">
              <div className="flex items-center gap-2 font-semibold text-white">
                <MousePointer2 className="h-4 w-4 flex-none text-cyan-300" aria-hidden="true" />
                {t(locale, isRace ? "gapLadderEmpty" : "gapLadderRaceOnly")}
              </div>
            </div>
          ) : null}
        </div>

        {sidelined.length > 0 ? (
          <aside className="flex w-28 flex-none flex-col border-l border-dashed border-white/15 px-2 py-3">
            <div className="px-1 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
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
                    className={`flex flex-none cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                      active
                        ? "border-white/70 bg-white/15"
                        : "border-white/15 bg-neutral-950/85 hover:border-white/40"
                    }`}
                  >
                    <span
                      className="h-2 w-2 flex-none rounded-full"
                      style={{ backgroundColor: row.teamColour }}
                    />
                    <span className="text-[10px] font-black text-white">{row.acronym}</span>
                    {row.lappedCount !== null ? (
                      <span className="ml-auto font-mono text-[9px] font-semibold text-amber-200/80">
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
    </section>
  );
}
