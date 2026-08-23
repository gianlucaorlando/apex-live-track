"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Trophy, X } from "lucide-react";
import { t, tyreCompound, type Locale } from "@/lib/i18n";
import { tyreCompoundColor } from "@/lib/tyres";
import type { DriverProfile, DriverProfileApiResponse } from "@/types/driver";
import type { DriverTyreInfo } from "@/types/f1";

/**
 * Sottoinsieme dei dati pilota necessari alla scheda: sia le righe della
 * classifica (LiveStandingRow) sia i marker della mappa
 * (NormalizedDriverPosition) lo soddisfano strutturalmente, cosi' la stessa
 * scheda si apre da mappa, corsia dei distacchi e vista arcade.
 */
export interface DriverCardInfo {
  driverNumber: number;
  acronym: string;
  fullName: string;
  headshotUrl: string | null;
  teamName: string;
  teamColour: string;
  position: number | null;
  gap: string;
  interval: string;
  tyre: DriverTyreInfo | null;
  currentLap: number | null;
  totalLaps: number | null;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(maxLength - 3, 0))}...`;
}

function shortExtract(profile: DriverProfile | null): string {
  if (!profile?.extract) {
    return "";
  }

  const sentences = profile.extract
    .split(/(?<=\.)\s+/)
    .filter((sentence) => sentence.length > 0)
    .slice(0, 2)
    .join(" ");

  return truncateText(sentences || profile.extract, 260);
}

export function DriverProfileCard({
  driver,
  locale,
  onClose,
}: {
  driver: DriverCardInfo;
  locale: Locale;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ name: driver.fullName, lang: locale });

    async function loadDriverProfile() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/driver-profile?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | DriverProfileApiResponse
          | null;

        if (controller.signal.aborted) {
          return;
        }

        if (!response.ok || !payload?.data) {
          setProfile(null);
          setError(t(locale, "profileNotFound"));
          return;
        }

        setProfile(payload.data);
      } catch {
        if (!controller.signal.aborted) {
          setProfile(null);
          setError(t(locale, "profileUnavailable"));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDriverProfile();

    return () => {
      controller.abort();
    };
  }, [driver.fullName, locale]);

  const tyreColor = tyreCompoundColor(driver.tyre?.compound);
  const lapValue = t(locale, "lapProgressValue", {
    current: driver.currentLap ? String(driver.currentLap) : "-",
    total: driver.totalLaps ? String(driver.totalLaps) : "-",
  });

  return (
    <aside
      className="absolute bottom-4 right-4 top-24 z-40 flex w-[22rem] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg border border-white/15 bg-slate-950/92 shadow-2xl shadow-black/45 backdrop-blur-xl"
      data-driver-profile-card
    >
      <div className="h-1.5 flex-none" style={{ backgroundColor: driver.teamColour }} />
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4">
        <div className="flex items-start gap-3">
          <div
            className="grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-lg border-2 bg-neutral-900"
            style={{ borderColor: driver.teamColour }}
          >
            {driver.headshotUrl ? (
              <img
                src={driver.headshotUrl}
                alt={driver.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-black text-white">{driver.acronym}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black text-white">{driver.fullName}</h3>
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                  #{driver.driverNumber} · {driver.acronym}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                title={t(locale, "closeDriverCard")}
                className="grid h-8 w-8 flex-none place-items-center rounded-md border border-white/10 bg-white/5 text-white transition hover:bg-white/12"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
            <div className="text-white/45">{t(locale, "position")}</div>
            <div className="mt-1 text-lg font-black text-white">
              {driver.position ? `P${driver.position}` : "P-"}
            </div>
            <div className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-cyan-100/70">
              {t(locale, "lapProgress")} {lapValue}
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
            <div className="flex items-center justify-between gap-2 text-white/45">
              <span>{t(locale, "tyre")}</span>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: tyreColor }}
              />
            </div>
            <div className="mt-1 text-lg font-black text-white">
              {driver.tyre ? tyreCompound(locale, driver.tyre.compound) : "n.d."}
            </div>
            {driver.tyre ? (
              <div className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-white/45">
                {t(locale, "tyreAge")} {driver.tyre.ageLaps ?? "-"} ·{" "}
                {t(locale, "tyreStint")} {driver.tyre.stintNumber}
              </div>
            ) : null}
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
            <div className="text-white/45">{t(locale, "f1Wins")}</div>
            <div className="mt-1 flex items-center gap-1.5 text-lg font-black text-white">
              <Trophy className="h-4 w-4 text-amber-300" aria-hidden="true" />
              {loading ? "..." : profile?.wins ?? "n.d."}
            </div>
          </div>
          {!loading && profile?.worldChampionships && profile.worldChampionships > 0 ? (
            <div className="rounded-md border border-amber-300/20 bg-amber-300/10 p-2">
              <div className="text-amber-100/60">{t(locale, "f1WorldTitles")}</div>
              <div className="mt-1 flex items-center gap-1.5 text-lg font-black text-amber-50">
                <Trophy className="h-4 w-4 text-amber-300" aria-hidden="true" />
                {profile.worldChampionships}
              </div>
            </div>
          ) : null}
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
            <div className="text-white/45">{t(locale, "team")}</div>
            <div className="mt-1 truncate font-bold text-white">{driver.teamName}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
            <div className="text-white/45">{t(locale, "gapInterval")}</div>
            <div className="mt-1 truncate font-bold text-white">
              {driver.gap} / {driver.interval}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-black/22 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-white/60">
              {t(locale, "wikipedia")}
            </div>
            {profile?.pageUrl ? (
              <a
                href={profile.pageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-white transition hover:bg-white/12"
              >
                {t(locale, "open")}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-3 text-sm font-semibold text-white/70">
              {t(locale, "profileLoading")}
            </div>
          ) : error ? (
            <div className="mt-3 text-sm font-semibold text-amber-100">{error}</div>
          ) : profile ? (
            <div className="mt-3 flex gap-3">
              {profile.thumbnailUrl ? (
                <img
                  src={profile.thumbnailUrl}
                  alt={profile.title}
                  className="h-20 w-16 flex-none rounded-md object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <div className="text-sm font-black text-white">{profile.title}</div>
                {profile.description ? (
                  <div className="mt-0.5 text-xs font-semibold text-white/48">
                    {profile.description}
                  </div>
                ) : null}
                <p className="mt-2 text-xs leading-relaxed text-white/72">
                  {shortExtract(profile)}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm font-semibold text-white/70">
              {t(locale, "profileMissing")}
            </div>
          )}
        </div>

        <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38">
          {profile?.attribution ?? t(locale, "wikiAttribution")}
        </div>
      </div>
    </aside>
  );
}
