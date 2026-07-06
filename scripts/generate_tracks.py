#!/usr/bin/env python3
"""
Generates static F1 circuit track geometry files for the F1 Live Track app.
Uses the OpenF1 API directly — same coordinate system as the live telemetry,
so driver markers overlay the static SVG with zero calibration.

Output: public/tracks/{circuitKey}.json
  { circuitKey, circuitShortName, year, points: [{x, y}], finishLine?: {x, y} }

Usage:
    pip install requests
    python scripts/generate_tracks.py [--year YEAR]
"""

import argparse
import json
import math
import os
import time
import warnings
from pathlib import Path
from datetime import datetime as _dt
from typing import Optional

# Suppress urllib3 SSL warning on macOS with LibreSSL
warnings.filterwarnings("ignore", category=Warning, module="urllib3")

import requests

OPENF1_BASE = "https://api.openf1.org/v1"
OPENF1_TOKEN_URL = "https://api.openf1.org/token"

_session = requests.Session()


def get_token() -> Optional[str]:
    """Fetch a Bearer token using credentials from env or .env.local."""
    username = os.environ.get("OPENF1_USERNAME", "").strip()
    password = os.environ.get("OPENF1_PASSWORD", "").strip()

    # Fall back to parsing .env.local if env vars are not set
    if not username or not password:
        env_file = Path(__file__).parent.parent / ".env.local"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key, val = key.strip(), val.strip()
                if key == "OPENF1_USERNAME":
                    username = val
                elif key == "OPENF1_PASSWORD":
                    password = val

    if not username or not password:
        return None

    r = requests.post(
        OPENF1_TOKEN_URL,
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json().get("access_token")


def api_get(path, token: Optional[str] = None, retries=3, **params):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    for attempt in range(retries):
        r = _session.get(f"{OPENF1_BASE}/{path}", params=params, headers=headers, timeout=60)
        if r.status_code == 429 and attempt < retries - 1:
            wait = 15 * (attempt + 1)
            print(f"   ⏳ Rate limited, waiting {wait}s …")
            time.sleep(wait)
            continue
        r.raise_for_status()
        return r.json()
    r.raise_for_status()
    return r.json()


def is_valid(x, y):
    return math.isfinite(x) and math.isfinite(y) and not (x == 0 and y == 0)


def dedupe(points, tol=80):
    """Keep one point per `tol` metres — mirrors dedupeNearPoints in track.ts."""
    result, prev = [], None
    for p in points:
        x, y = p["x"], p["y"]
        if not is_valid(x, y):
            continue
        if prev is None or math.hypot(x - prev[0], y - prev[1]) >= tol:
            result.append(p)
            prev = (x, y)
    return result


def coverage_score(points):
    if not points:
        return 0
    xs = [p["x"] for p in points]
    ys = [p["y"] for p in points]
    return math.hypot(max(xs) - min(xs), max(ys) - min(ys)) + len(points) * 0.01


def extract_single_loop(points):
    """
    Finds the FIRST complete circuit loop in a multi-lap trace and returns only
    those points.  OpenF1 coordinates are in decimetres (1 unit = 0.1 m), so
    all tolerances here are in dm.
    """
    if len(points) < 30:
        return points

    xs = [p["x"] for p in points]
    ys = [p["y"] for p in points]
    diag = math.hypot(max(xs) - min(xs), max(ys) - min(ys))

    # Must travel at least 1.75× the bounding-box diagonal before looking for a
    # return — prevents false positives from the pit lane or chicane detours.
    min_travel = diag * 1.75
    # Mirrors extractSingleTrackLoop in TrackMap.tsx: 8% of bounding-box diagonal,
    # clamped to 50–200 m (in dm units: 500–2000).  The wider tolerance makes the
    # detection reliable even at circuits with poor GPS coverage (e.g. urban venues).
    return_tol = min(max(diag * 0.08, 500.0), 2000.0)

    start = points[0]
    travelled = 0.0

    for i in range(1, len(points)):
        dx = points[i]["x"] - points[i - 1]["x"]
        dy = points[i]["y"] - points[i - 1]["y"]
        travelled += math.hypot(dx, dy)

        if i < 30 or travelled < min_travel:
            continue

        dist_to_start = math.hypot(points[i]["x"] - start["x"], points[i]["y"] - start["y"])
        if dist_to_start <= return_tol:
            return points[:i + 1]  # Stop at the first valid loop closure

    return points  # No loop detected — return everything


def build_polyline(raw_locs):
    """
    Mirror of buildTrackPolyline in track.ts:
    group by driver, sort by date, pick the driver with best track coverage,
    then extract a single loop and deduplicate nearby points.

    Returns (polyline_points, best_driver_number).
    """
    by_driver: dict[int, list[dict]] = {}
    for loc in raw_locs:
        x = loc.get("x") or 0
        y = loc.get("y") or 0
        if not is_valid(x, y):
            continue
        dn = loc.get("driver_number", 0)
        by_driver.setdefault(dn, []).append({"x": x, "y": y, "date": loc.get("date", "")})

    if not by_driver:
        return [], None

    for pts in by_driver.values():
        pts.sort(key=lambda p: p["date"])

    candidates = [pts for pts in by_driver.values() if len(pts) >= 8]
    if not candidates:
        return [], None

    best = max(candidates, key=coverage_score)
    best_dn = next(dn for dn, pts in by_driver.items() if pts is best)
    single_loop = extract_single_loop(best)
    return dedupe(single_loop), best_dn


def compute_finish_line(laps: list, all_locs: list, preferred_driver: Optional[int]) -> Optional[dict]:
    """
    Infer the start/finish line position from lap-start timestamps.

    Uses the location data already fetched for track construction (all_locs) so
    no extra API calls are needed.  Returns {"x": ..., "y": ...} in OpenF1
    coordinates (decimetres), or None if the position cannot be determined.
    """
    # Prefer laps 2+ to avoid the race-start grid position for lap 1
    candidates = [
        lap for lap in laps
        if lap.get("date_start") and (lap.get("lap_number") or 0) >= 2
    ]
    if not candidates:
        candidates = [lap for lap in laps if lap.get("date_start")]
    if not candidates:
        return None

    # Sort: preferred driver first, then ascending lap number
    candidates.sort(
        key=lambda l: (
            0 if l.get("driver_number") == preferred_driver else 1,
            l.get("lap_number") or 0,
        )
    )

    for lap in candidates[:6]:
        try:
            target_ms = _dt.fromisoformat(
                lap["date_start"].replace("Z", "+00:00")
            ).timestamp() * 1000
        except Exception:
            continue

        driver_num = lap.get("driver_number")
        best_loc, best_delta, best_same = None, float("inf"), False

        for loc in all_locs:
            x, y = loc.get("x") or 0, loc.get("y") or 0
            if not is_valid(x, y):
                continue
            try:
                loc_ms = _dt.fromisoformat(
                    (loc.get("date") or "").replace("Z", "+00:00")
                ).timestamp() * 1000
            except Exception:
                continue
            delta = abs(loc_ms - target_ms)
            if delta > 6000:
                continue
            same = loc.get("driver_number") == driver_num
            if (
                not best_loc
                or (same and not best_same)
                or (same == best_same and delta < best_delta)
            ):
                best_loc, best_delta, best_same = loc, delta, same

        if best_loc:
            return {"x": round(best_loc["x"], 1), "y": round(best_loc["y"], 1)}

    return None


def main():
    parser = argparse.ArgumentParser(description="Generate F1 static track geometry files")
    parser.add_argument("--year", type=int, default=2024, help="F1 season year (default: 2024)")
    args = parser.parse_args()
    year = args.year

    out_dir = Path("public/tracks")
    out_dir.mkdir(parents=True, exist_ok=True)

    print("Authenticating with OpenF1 …")
    token = get_token()
    if token:
        print("  ✓ Token obtained\n")
    else:
        print("  ⚠  No credentials found — trying unauthenticated (may hit 401)\n")

    def get(path, **params):
        return api_get(path, token=token, **params)

    print(f"Fetching F1 {year} meetings from OpenF1 API …")
    meetings = get("meetings", year=year)

    # Deduplicate by circuit_key (pre-season testing reuses the same circuit)
    seen: set[int] = set()
    unique_meetings = []
    for m in meetings:
        ck = m.get("circuit_key")
        if ck and ck not in seen:
            seen.add(ck)
            unique_meetings.append(m)

    print(f"Found {len(unique_meetings)} unique circuits\n")

    for m in unique_meetings:
        ck = m["circuit_key"]
        name = m.get("circuit_short_name", "?")
        out_file = out_dir / f"{ck}.json"

        if out_file.exists():
            print(f"⏭  {name} (key={ck}): already exists, skipping")
            continue

        print(f"▶  {name} (circuit_key={ck})")

        try:
            # Prefer the Race session; fall back to whatever is available
            sessions = get("sessions", meeting_key=m["meeting_key"])
            race = next((s for s in sessions if s.get("session_type") == "Race"), None)
            session = race or (sessions[0] if sessions else None)

            if not session:
                print("   ✗ No sessions found")
                continue

            sk = session["session_key"]
            print(f"   Session: {session.get('session_name')} (key={sk})")

            # Fetch location data for the first 4 drivers — enough for full coverage
            drivers = get("drivers", session_key=sk)
            if not drivers:
                print("   ✗ No drivers found")
                continue

            all_locs: list[dict] = []
            for d in drivers[:4]:
                dn = d["driver_number"]
                time.sleep(2)  # Stay within rate limits
                locs = get("location", session_key=sk, driver_number=dn)
                all_locs.extend(locs)
                print(f"   Driver {dn}: {len(locs)} raw points")

            poly, best_dn = build_polyline(all_locs)

            if len(poly) < 50:
                print(f"   ✗ Only {len(poly)} polyline points — skipping")
                continue

            # Fetch lap-start times to locate the start/finish line
            time.sleep(2)
            laps = get("laps", session_key=sk)
            finish_line = compute_finish_line(laps or [], all_locs, best_dn)
            if finish_line:
                print(f"   Finish line: x={finish_line['x']}, y={finish_line['y']}")
            else:
                print("   Finish line: not found in lap data")

            data: dict = {
                "circuitKey": ck,
                "circuitShortName": name,
                "year": year,
                "points": [{"x": round(p["x"], 1), "y": round(p["y"], 1)} for p in poly],
            }
            if finish_line:
                data["finishLine"] = finish_line

            out_file.write_text(json.dumps(data, separators=(",", ":")))
            print(f"   ✓ {len(poly)} points saved → {out_file}\n")

        except requests.HTTPError as e:
            print(f"   ✗ HTTP {e.response.status_code}: {e}\n")
        except Exception as e:
            print(f"   ✗ {e}\n")

        time.sleep(10)  # Pause between circuits to respect the public API


if __name__ == "__main__":
    main()
