"use client";

import { Crown, Trophy } from "lucide-react";
import { titleStatus, type TitleStatus } from "@/lib/f1Points";
import { countryName, t, type Locale } from "@/lib/i18n";
import type { SeasonStandingsPayload } from "@/types/seasonStandings";

interface ChampionsBannerProps {
  standings: SeasonStandingsPayload;
  locale: Locale;
  teamColor: (name: string) => string;
}

// Nazionalita' Jolpica (in inglese) -> nome del paese nella lingua dell'interfaccia.
const NATIONALITY_COUNTRY: Record<string, string> = {
  German: "Germany",
  Italian: "Italy",
  British: "United Kingdom",
  Austrian: "Austria",
  Swiss: "Switzerland",
  American: "United States",
  French: "France",
};

function nationalityLabel(value: string | null, locale: Locale): string {
  if (!value) return "";
  return NATIONALITY_COUNTRY[value] ? countryName(locale, NATIONALITY_COUNTRY[value]) : value;
}

/** Banner stile grafica TV F1: campioni del mondo (o leader se il titolo e' aperto). */
export function ChampionsBanner({ standings, locale, teamColor }: ChampionsBannerProps) {
  const [leader, second] = standings.drivers;
  const [team, teamSecond] = standings.constructors;

  if (!leader || !team) {
    return null;
  }

  const driverTitle = titleStatus(
    leader.points,
    second?.points ?? 0,
    standings.constructorPointsAvailable,
    standings.round,
    "driver",
  );
  const teamTitle = titleStatus(
    team.points,
    teamSecond?.points ?? 0,
    standings.constructorPointsAvailable,
    standings.round,
    "constructor",
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChampionCard
        status={driverTitle}
        label={t(locale, driverTitle.decided ? "worldChampionDriver" : "championshipLeaderDriver", {
          season: standings.season,
        })}
        name={[leader.givenName, leader.familyName].filter(Boolean).join(" ")}
        sub={leader.constructorName}
        badge={leader.permanentNumber ?? leader.code}
        points={leader.points}
        wins={leader.wins}
        colour={teamColor(leader.constructorName)}
        rival={second?.code ?? null}
        locale={locale}
      />
      <ChampionCard
        status={teamTitle}
        label={t(locale, teamTitle.decided ? "worldChampionConstructor" : "championshipLeaderConstructor", {
          season: standings.season,
        })}
        name={team.name}
        sub={nationalityLabel(team.nationality, locale)}
        badge={null}
        points={team.points}
        wins={team.wins}
        colour={teamColor(team.name)}
        rival={teamSecond?.name ?? null}
        locale={locale}
      />
    </div>
  );
}

function ChampionCard({
  status,
  label,
  name,
  sub,
  badge,
  points,
  wins,
  colour,
  rival,
  locale,
}: {
  status: TitleStatus;
  label: string;
  name: string;
  sub: string;
  badge: string | null;
  points: number;
  wins: number;
  colour: string;
  rival: string | null;
  locale: Locale;
}) {
  const decided = status.decided;
  const Icon = decided ? Crown : Trophy;

  return (
    <div className="panel relative flex flex-col gap-2 rounded-md px-5 py-3.5" style={{ borderLeft: `5px solid ${colour}` }}>
      <div className="flex items-center gap-4">
        <div
          className={`grid h-11 w-11 flex-none place-items-center rounded-full bg-ink ${decided ? "text-[#d4af37]" : "text-white/80"}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className={`text-[10px] font-bold uppercase tracking-[0.14em] ${decided ? "text-[#a07d00]" : "text-f1red"}`}>
            {label}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="truncate font-display text-[22px] font-black uppercase leading-tight tracking-[0.02em]">{name}</span>
            {badge ? (
              <span className="font-display text-sm font-bold" style={{ color: colour }}>
                {badge}
              </span>
            ) : null}
          </div>
          <div className="truncate text-[11px] text-muted">{sub}</div>
        </div>

        {rival ? (
          <div className="hidden border-l border-line pl-4 text-right text-[10px] text-muted sm:block">
            {t(locale, "leadOver", { lead: status.lead, name: rival })}
          </div>
        ) : null}

        <div className="flex-none text-right">
          <div className="font-display text-[28px] font-bold leading-none">{points}</div>
          <div className="mt-1 text-[10px] text-muted">
            {t(locale, "pointsShort")} · {wins} {t(locale, "winsShort")}
          </div>
        </div>
      </div>

      {!decided && Number.isFinite(status.pointsRemaining) ? (
        <div className="flex items-center justify-between gap-2 border-t border-line pt-2 text-[11px] text-muted">
          <span>{t(locale, "titleLead", { lead: status.lead })}</span>
          <span>{t(locale, "titlePointsLeft", { points: status.pointsRemaining })}</span>
        </div>
      ) : null}
    </div>
  );
}
