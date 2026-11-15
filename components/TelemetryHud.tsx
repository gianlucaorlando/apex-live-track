"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import type { LiveStandingRow } from "@/types/f1";
import type { CarTelemetrySample } from "@/types/f1Insights";

interface TelemetryHudProps {
  driver: LiveStandingRow;
  samples: CarTelemetrySample[];
  locale: Locale;
  onClose: () => void;
}

const MAX_RPM = 13000;
// I campioni arrivano a blocchi ogni ~1.2 s: si riproducono gli ultimi in sequenza
// cosi' la lancetta si muove invece di saltare una volta al secondo.
const PLAYBACK_WINDOW_MS = 1300;

/** HUD telemetria stile onboard F1: velocita', marcia, giri, acceleratore/freno, DRS. */
export function TelemetryHud({ driver, samples, locale, onClose }: TelemetryHudProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (samples.length === 0) return;

    const lastMs = new Date(samples.at(-1)!.date).getTime();
    const start = Math.max(
      0,
      samples.findIndex((sample) => new Date(sample.date).getTime() >= lastMs - PLAYBACK_WINDOW_MS),
    );
    setIndex(start);

    const timer = window.setInterval(() => {
      setIndex((current) => Math.min(current + 1, samples.length - 1));
    }, 270);

    return () => window.clearInterval(timer);
  }, [samples]);

  const sample = samples[Math.min(index, samples.length - 1)];
  const rpmFraction = sample ? Math.min(sample.rpm / MAX_RPM, 1) : 0;
  // Arco del tachimetro: 240° da -210° a +30°.
  const arcLength = 2 * Math.PI * 44 * (240 / 360);

  return (
    <div className="panel-neon pointer-events-auto w-64 overflow-hidden rounded-xl">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2" style={{ boxShadow: `inset 3px 0 0 ${driver.teamColour}` }}>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#e10600]">
          {t(locale, "telemetryTitle")}
        </span>
        <span className="text-sm font-black italic text-white">{driver.acronym}</span>
        <span className="truncate text-[10px] text-white/45">{driver.teamName}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white"
          aria-label={t(locale, "closeDriverCard")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {sample ? (
        <div className="grid grid-cols-[7rem_1fr] items-center gap-3 px-3 py-3">
          <div className="relative h-28 w-28">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-[210deg]">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" strokeDasharray={`${arcLength} 999`} strokeLinecap="round" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke={rpmFraction > 0.92 ? "#e10600" : driver.teamColour}
                strokeWidth="7"
                strokeDasharray={`${arcLength * rpmFraction} 999`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 250ms linear", filter: `drop-shadow(0 0 4px ${driver.teamColour})` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-3xl font-black leading-none tabular-nums text-white">{sample.speed}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/45">km/h</span>
              <span className="mt-1 font-mono text-[10px] text-white/50 tabular-nums">{sample.rpm} rpm</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-white/5 font-mono text-2xl font-black italic text-white">
                {sample.gear === 0 ? "N" : sample.gear}
              </div>
              <span
                className={`rounded px-2 py-1 text-[10px] font-black tracking-widest transition ${
                  sample.drs ? "bg-emerald-400 text-neutral-950 shadow-[0_0_14px_rgba(52,211,153,0.7)]" : "bg-white/5 text-white/30"
                }`}
              >
                DRS
              </span>
            </div>
            <Bar label={t(locale, "throttle")} value={sample.throttle} colour="#22c55e" />
            <Bar label={t(locale, "brake")} value={sample.brake} colour="#e10600" />
          </div>
        </div>
      ) : (
        <div className="px-3 py-6 text-center text-xs text-white/45">{t(locale, "telemetryLoading")}</div>
      )}
    </div>
  );
}

function Bar({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div>
      <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-white/45">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{Math.round(value)}%</span>
      </div>
      <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, backgroundColor: colour, transition: "width 250ms linear", boxShadow: `0 0 8px ${colour}` }}
        />
      </div>
    </div>
  );
}
