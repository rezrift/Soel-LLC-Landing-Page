#!/usr/bin/env node
// Pulls live player counts + visit totals from Roblox's public games API,
// tracks a running "peak since we started tracking" per game, and writes
// data/stats.json. Run by .github/workflows/update-stats.yml on a schedule.
//
// Never fabricates numbers: any game whose placeId isn't filled in yet, or
// whose API call fails, is left as-is (previous value or null) rather than
// guessed. Numbers only ever come from Roblox's own API responses.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAMES_PATH = path.join(__dirname, "..", "data", "games.json");
const STATS_PATH = path.join(__dirname, "..", "data", "stats.json");

async function readJson(p) {
  return JSON.parse(await readFile(p, "utf8"));
}

async function resolveUniverseId(placeId) {
  const res = await fetch(
    `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
  );
  if (!res.ok) {
    throw new Error(`universe lookup failed for place ${placeId}: HTTP ${res.status}`);
  }
  const body = await res.json();
  if (!body.universeId) {
    throw new Error(`no universeId returned for place ${placeId}`);
  }
  return body.universeId;
}

async function fetchGameData(universeIds) {
  if (universeIds.length === 0) return [];
  const res = await fetch(
    `https://games.roblox.com/v1/games?universeIds=${universeIds.join(",")}`
  );
  if (!res.ok) {
    throw new Error(`games API failed: HTTP ${res.status}`);
  }
  const body = await res.json();
  return body.data ?? [];
}

function isValidPlaceId(placeId) {
  return typeof placeId === "number" && Number.isFinite(placeId);
}

async function main() {
  const { games } = await readJson(GAMES_PATH);
  const prevStats = await readJson(STATS_PATH);

  const trackable = games.filter(
    (g) => g.status === "live" && isValidPlaceId(g.placeId)
  );

  if (trackable.length === 0) {
    console.warn(
      "No games with a valid numeric placeId yet — nothing to fetch. " +
        "Fill in data/games.json to start tracking."
    );
  }

  // Resolve universe IDs (placeId -> universeId), tolerating per-game failure.
  const universeBySlug = {};
  for (const g of trackable) {
    try {
      universeBySlug[g.slug] = await resolveUniverseId(g.placeId);
    } catch (err) {
      console.error(`[${g.slug}] ${err.message}`);
    }
  }

  const universeIds = Object.values(universeBySlug);
  let gameData = [];
  try {
    gameData = await fetchGameData(universeIds);
  } catch (err) {
    console.error(err.message);
  }

  const now = new Date().toISOString();
  const nextGames = { ...prevStats.games };

  for (const g of trackable) {
    const universeId = universeBySlug[g.slug];
    const prev = prevStats.games?.[g.slug] ?? {
      playing: null,
      visits: null,
      peakPlaying: null,
      peakTrackingStartedAt: null,
    };

    if (!universeId) {
      // Couldn't resolve this game this run — keep whatever we had.
      nextGames[g.slug] = prev;
      continue;
    }

    const match = gameData.find((d) => d.id === universeId);
    if (!match) {
      console.error(`[${g.slug}] no data returned for universe ${universeId}`);
      nextGames[g.slug] = prev;
      continue;
    }

    const playing = typeof match.playing === "number" ? match.playing : prev.playing;
    const visits = typeof match.visits === "number" ? match.visits : prev.visits;

    const peakTrackingStartedAt = prev.peakTrackingStartedAt ?? now;
    const peakPlaying =
      typeof playing === "number"
        ? Math.max(playing, prev.peakPlaying ?? 0)
        : prev.peakPlaying;

    nextGames[g.slug] = {
      playing,
      visits,
      peakPlaying,
      peakTrackingStartedAt,
    };
  }

  const nextStats = {
    generatedAt: now,
    games: nextGames,
  };

  await writeFile(STATS_PATH, JSON.stringify(nextStats, null, 2) + "\n");
  console.log("Wrote", STATS_PATH);
  console.log(JSON.stringify(nextStats, null, 2));
}

main().catch((err) => {
  console.error("Fatal error in fetch-stats:", err);
  // Exit 0 on purpose: a bad run should not block the commit step from
  // running with whatever data we already had. Check the Action logs if
  // numbers look stale.
  process.exit(0);
});
