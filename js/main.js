// Renders the games grid and hero stat bar from data/games.json (static
// metadata) + data/stats.json (written by the GitHub Action that polls
// Roblox's API). Never invents numbers: anything missing renders as "—".

function formatNumber(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("en-US");
}

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "updated just now";
  if (mins < 60) return `updated ${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `updated ${days}d ago`;
}

function gameCard(game, stats) {
  const isLive = game.status === "live";
  const s = stats?.games?.[game.slug];

  const badge = isLive
    ? '<span class="badge badge-live">Live</span>'
    : '<span class="badge badge-dev">Coming Soon</span>';

  const statsBlock =
    isLive && s
      ? `
      <div class="game-stats">
        <div><div class="g-value">${formatNumber(s.playing)}</div><div class="g-label">Playing</div></div>
        <div><div class="g-value">${formatNumber(s.visits)}</div><div class="g-label">Visits</div></div>
      </div>`
      : "";

  const media = game.image
    ? `<div class="game-media"><img src="${game.image}" alt="" loading="lazy" /></div>`
    : "";

  const hasLink = Boolean(game.robloxUrl && game.robloxUrl !== "REPLACE_ME");
  const tag = hasLink ? "a" : "div";
  const hrefAttr = hasLink
    ? `href="${game.robloxUrl}" target="_blank" rel="noopener"`
    : "";

  return `
    <${tag} class="game-card${game.image ? " has-media" : ""}" ${hrefAttr}>
      ${media}
      <div class="game-body">
        ${badge}
        <h3>${game.name}</h3>
        <p class="blurb">${game.blurb ?? ""}</p>
        ${statsBlock}
      </div>
    </${tag}>`;
}

async function main() {
  document.getElementById("year").textContent = new Date().getFullYear();

  const [gamesRes, statsRes] = await Promise.all([
    fetch("data/games.json"),
    fetch("data/stats.json"),
  ]);
  const { games } = await gamesRes.json();
  const stats = await statsRes.json();

  const grid = document.getElementById("game-grid");
  grid.innerHTML = games.map((g) => gameCard(g, stats)).join("");

  const updatedEl = document.getElementById("games-updated");
  if (updatedEl) updatedEl.textContent = timeAgo(stats.generatedAt);

  // Aggregate hero numbers across all live-tracked games.
  const liveGames = games.filter((g) => g.status === "live");
  const liveStats = liveGames.map((g) => stats.games?.[g.slug]).filter(Boolean);

  const sum = (key) =>
    liveStats.some((s) => typeof s[key] === "number")
      ? liveStats.reduce((acc, s) => acc + (typeof s[key] === "number" ? s[key] : 0), 0)
      : null;

  document.getElementById("stat-games").textContent = String(liveGames.length);
  document.getElementById("stat-ccu").textContent = formatNumber(sum("playing"));
  document.getElementById("stat-visits").textContent = formatNumber(sum("visits"));
}

main().catch((err) => {
  console.error("Failed to load stats:", err);
});
