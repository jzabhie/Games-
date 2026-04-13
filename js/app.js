import { normalizeName, states } from "./data.js";
import { districtsEnriched } from "./districts-enriched.js";
import { worldCountries } from "./world-data.js";

const MAX_GUESSES = 6;

const els = {
  stateModeBtn: document.getElementById("stateModeBtn"),
  districtModeBtn: document.getElementById("districtModeBtn"),
  worldModeBtn: document.getElementById("worldModeBtn"),
  guessInput: document.getElementById("guessInput"),
  guessOptions: document.getElementById("guessOptions"),
  guessBtn: document.getElementById("guessBtn"),
  resetBtn: document.getElementById("resetBtn"),
  guessBoard: document.getElementById("guessBoard"),
  status: document.getElementById("status"),
  questionTitle: document.getElementById("questionTitle"),
  questionText: document.getElementById("questionText"),
  questionHints: document.getElementById("questionHints"),
  targetInfo: document.getElementById("targetInfo"),
  mapStatus: document.getElementById("mapStatus"),
  mapView: document.getElementById("mapView"),
  atlasSearch: document.getElementById("atlasSearch"),
  atlasGrid: document.getElementById("atlasGrid"),
  knowledgeProvider: document.getElementById("knowledgeProvider")
};

const modeConfig = {
  state: { items: states, label: "State / UT" },
  district: { items: districtsEnriched, label: "District" },
  world: { items: worldCountries, label: "Country" }
};

const game = {
  mode: "state",
  target: null,
  guesses: [],
  won: false
};

let leafletMap;
let guessLayer;
let targetLayer;

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function dateSeed() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return hashString(`${year}-${month}-${day}`);
}

function millisecondsUntilNextIstMidnight() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const nextIstMidnightUtcMs = Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0) - istOffsetMs;
  return Math.max(1000, nextIstMidnightUtcMs - Date.now());
}

function scheduleDailyRefreshAtIstMidnight() {
  window.setTimeout(() => {
    setMode(game.mode, false);
    scheduleDailyRefreshAtIstMidnight();
  }, millisecondsUntilNextIstMidnight());
}

function pickTarget(mode, random = false) {
  const list = modeConfig[mode].items;
  const idx = random ? Math.floor(Math.random() * list.length) : dateSeed() % list.length;
  return list[idx];
}

function setMode(mode, random = false) {
  game.mode = mode;
  game.target = pickTarget(mode, random);
  game.guesses = [];
  game.won = false;

  els.stateModeBtn.classList.toggle("active", mode === "state");
  els.districtModeBtn.classList.toggle("active", mode === "district");
  els.worldModeBtn.classList.toggle("active", mode === "world");
  els.guessInput.value = "";
  els.guessInput.placeholder = mode === "world" ? "Type a country name" : mode === "district" ? "Type a district name" : "Type a state or UT name";

  renderOptions();
  renderBoard();
  renderStatus();
  renderQuestion();
  renderTargetInfo();
  renderMap();
  renderAtlas();
  renderKnowledgeProvider();
}

function renderOptions() {
  els.guessOptions.innerHTML = modeConfig[game.mode].items
    .map((item) => `<option value="${item.name}"></option>`)
    .join("");
}

function findItemByName(inputName) {
  const normalized = normalizeName(inputName);
  return modeConfig[game.mode].items.find((item) => normalizeName(item.name) === normalized);
}

function formatNumber(num) {
  return new Intl.NumberFormat("en-IN").format(num || 0);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function directionHint(fromLat, fromLon, toLat, toLon) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const y = Math.sin(toRad(toLon - fromLon)) * Math.cos(toRad(toLat));
  const x =
    Math.cos(toRad(fromLat)) * Math.sin(toRad(toLat)) -
    Math.sin(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.cos(toRad(toLon - fromLon));
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return labels[Math.round(bearing / 45) % 8];
}

function compareGuess(guess, target) {
  const distance = haversineKm(guess.lat, guess.lon, target.lat, target.lon);
  const direction = directionHint(guess.lat, guess.lon, target.lat, target.lon);
  const areaHint = guess.areaKm2 === target.areaKm2 ? "equal" : guess.areaKm2 < target.areaKm2 ? "higher" : "lower";
  const popHint = guess.population === target.population ? "equal" : guess.population < target.population ? "higher" : "lower";

  return {
    exact: guess.name === target.name,
    distance,
    direction,
    areaHint,
    popHint,
    sameRegion: guess.region === target.region,
    sameState: game.mode === "district" ? guess.state === target.state : null,
    coastMatch: game.mode === "state" ? guess.coastal === target.coastal : null,
    capitalMatch: game.mode === "world" ? normalizeName(guess.capital || "") === normalizeName(target.capital || "") : null
  };
}

function renderBoard() {
  const extraHeader = game.mode === "state" ? "Coastal" : game.mode === "district" ? "Parent State" : "Capital Match";

  if (!game.guesses.length) {
    els.guessBoard.innerHTML = `<table class="guess-table"><thead><tr><th>#</th><th>Guess</th><th>Distance</th><th>Direction</th><th>Region</th><th>Area</th><th>Population</th><th>${extraHeader}</th><th>Result</th></tr></thead><tbody><tr><td colspan="9">No guesses yet. Start with any name from the suggestion list.</td></tr></tbody></table>`;
    return;
  }

  const rows = game.guesses.map(({ item, result }, idx) => {
    const extra = game.mode === "state" ? (result.coastMatch ? "Match" : "No") : game.mode === "district" ? (result.sameState ? "Match" : "No") : (result.capitalMatch ? "Match" : "No");
    const tone = result.exact ? "row-ok" : result.distance <= 1200 ? "row-warn" : "row-bad";
    return `<tr><td>${idx + 1}</td><td>${item.name}</td><td>${result.distance} km</td><td>${result.direction}</td><td>${result.sameRegion ? "Match" : "No"}</td><td>${result.areaHint}</td><td>${result.popHint}</td><td>${extra}</td><td class="${tone}">${result.exact ? "Correct" : "Try"}</td></tr>`;
  }).join("");

  els.guessBoard.innerHTML = `<table class="guess-table"><thead><tr><th>#</th><th>Guess</th><th>Distance</th><th>Direction</th><th>Region</th><th>Area</th><th>Population</th><th>${extraHeader}</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderStatus() {
  const label = modeConfig[game.mode].label;
  const left = MAX_GUESSES - game.guesses.length;
  if (game.won) {
    els.status.textContent = `Excellent. You solved the ${label} puzzle in ${game.guesses.length} guesses.`;
    return;
  }
  if (left <= 0) {
    els.status.textContent = `No guesses left. The answer was ${game.target.name}.`;
    return;
  }
  els.status.textContent = `Mode: ${label}. ${left} guesses left.`;
}

function renderQuestion() {
  if (!game.target) return;

  let clues = [];
  if (game.mode === "state") {
    clues = [
      `Region: ${game.target.region}`,
      `Capital starts with: ${(game.target.capital || "?").charAt(0)}`,
      `Language starts with: ${(game.target.language || "?").charAt(0)}`,
      `Coastal: ${game.target.coastal ? "Yes" : "No"}`,
      `Population band: ${game.target.population > 70000000 ? "High" : "Medium"}`
    ];
    els.questionTitle.textContent = "Today's Question: Which State or UT is this?";
    els.questionText.textContent = "Decode the clues and use direction hints from your guesses.";
  } else if (game.mode === "district") {
    clues = [
      `Parent state: ${game.target.state}`,
      `Region: ${game.target.region}`,
      `Headquarters starts with: ${(game.target.headquarters || "?").charAt(0)}`,
      `Area band: ${game.target.areaKm2 > 5000 ? "Large" : "Medium/Compact"}`,
      `Population band: ${game.target.population > 2500000 ? "High" : "Medium"}`
    ];
    els.questionTitle.textContent = "Today's Question: Which District is this?";
    els.questionText.textContent = "Use parent-state, area/population, and map-distance clues to identify the district.";
  } else {
    clues = [
      `Region: ${game.target.region}`,
      `Subregion: ${game.target.subregion}`,
      `Capital starts with: ${(game.target.capital || "?").charAt(0)}`,
      `Currency code starts with: ${(game.target.currency || "?").charAt(0)}`,
      `Population band: ${game.target.population > 100000000 ? "Very High" : game.target.population > 30000000 ? "High" : "Medium/Low"}`
    ];
    els.questionTitle.textContent = "Today's Question: Which Country is this?";
    els.questionText.textContent = "Global mode: use world-region clues plus directional distance from each guess.";
  }

  const visibleCount = game.won || game.guesses.length >= MAX_GUESSES ? clues.length : Math.min(clues.length, 2 + Math.floor(game.guesses.length / 2));
  els.questionHints.innerHTML = clues.slice(0, visibleCount).map((c) => `<li>${c}</li>`).join("");
}

function renderTargetInfo() {
  if (!game.won && game.guesses.length < MAX_GUESSES) {
    els.targetInfo.className = "target-info empty";
    els.targetInfo.textContent = "Solve the puzzle (or use all guesses) to reveal full details.";
    return;
  }

  const t = game.target;
  let details = [];
  if (game.mode === "state") {
    details = [
      `Capital: ${t.capital}`,
      `Region: ${t.region}`,
      `Area: ${formatNumber(t.areaKm2)} sq km`,
      `Population: ${formatNumber(t.population)}`,
      `Language: ${t.language}`,
      `Literacy: ${t.literacy}%`,
      `Coastal: ${t.coastal ? "Yes" : "No"}`
    ];
  } else if (game.mode === "district") {
    details = [
      `State: ${t.state}`,
      `Headquarters: ${t.headquarters}`,
      `Region: ${t.region}`,
      `Area: ${formatNumber(t.areaKm2)} sq km`,
      `Population: ${formatNumber(t.population)}`,
      `Physiography: ${t.physiography}`,
      `Climate: ${t.climate}`,
      `River System: ${t.riverSystem}`,
      `Economy: ${t.economy}`,
      `Heritage: ${t.heritage}`,
      `Coordinates: ${t.lat}, ${t.lon}`
    ];
  } else {
    details = [
      `Capital: ${t.capital}`,
      `Currency: ${t.currency}`,
      `Region: ${t.region} / ${t.subregion}`,
      `Area: ${formatNumber(t.areaKm2)} sq km`,
      `Population: ${formatNumber(t.population)}`,
      `Longest River: ${t.longestRiver}`,
      `Highest Mountain: ${t.highestMountain}`,
      `Famous Cities: ${(t.famousCities || []).join(", ")}`,
      `Famous Architecture: ${(t.famousArchitecture || []).join(", ")}`,
      `Famous Personalities: ${(t.famousPersonalities || []).join(", ")}`
    ];
  }

  const title = game.mode === "world" && t.flagPng ? `<img class="flag" src="${t.flagPng}" alt="${t.name} flag"/>${t.name}` : t.name;

  els.targetInfo.className = "target-info";
  els.targetInfo.innerHTML = `<article class="target-card"><h3>${title}</h3><p>${t.fact}</p><div class="target-grid">${details.map((d) => `<div class="fact">${d}</div>`).join("")}</div></article>`;
}

function renderMap() {
  if (!leafletMap && window.L && els.mapView) {
    leafletMap = L.map(els.mapView, { center: [22.6, 79.5], zoom: 4, minZoom: 2, maxZoom: 12 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(leafletMap);
    guessLayer = L.layerGroup().addTo(leafletMap);
    targetLayer = L.layerGroup().addTo(leafletMap);
  }

  if (!leafletMap) {
    els.mapStatus.textContent = "Map library failed to load.";
    return;
  }

  guessLayer.clearLayers();
  targetLayer.clearLayers();

  const bounds = [];
  game.guesses.forEach((g, i) => {
    L.circleMarker([g.item.lat, g.item.lon], {
      radius: 6,
      color: "#0a7fcb",
      weight: 2,
      fillColor: "#52b6ff",
      fillOpacity: 0.9
    }).bindPopup(`<strong>Guess ${i + 1}:</strong> ${g.item.name}`).addTo(guessLayer);
    bounds.push([g.item.lat, g.item.lon]);
  });

  if (game.won || game.guesses.length >= MAX_GUESSES) {
    L.circleMarker([game.target.lat, game.target.lon], {
      radius: 8,
      color: "#8f1d1d",
      weight: 2,
      fillColor: "#d43a3a",
      fillOpacity: 0.95
    }).bindPopup(`<strong>Target:</strong> ${game.target.name}`).addTo(targetLayer);
    bounds.push([game.target.lat, game.target.lon]);
  }

  if (bounds.length) {
    leafletMap.fitBounds(bounds, { padding: [28, 28], maxZoom: game.mode === "world" ? 4 : 6 });
  } else {
    leafletMap.setView(game.mode === "world" ? [20, 0] : [22.6, 79.5], game.mode === "world" ? 2 : 4);
  }

  els.mapStatus.textContent = game.won || game.guesses.length >= MAX_GUESSES
    ? `Blue markers are guesses. Red marker is target: ${game.target.name}.`
    : "Blue markers are your guesses. Red target marker appears at end of round.";
}

function renderAtlas() {
  const q = normalizeName(els.atlasSearch.value || "");
  const list = modeConfig[game.mode].items.filter((item) => {
    const blob = normalizeName([
      item.name,
      item.region,
      item.state || "",
      item.capital || "",
      item.headquarters || "",
      item.currency || "",
      item.fact,
      (item.famousCities || []).join(" "),
      (item.famousArchitecture || []).join(" "),
      (item.famousPersonalities || []).join(" ")
    ].join(" "));
    return blob.includes(q);
  });

  els.atlasGrid.innerHTML = list.slice(0, 180).map((item) => {
    const title = game.mode === "world" && item.flagPng ? `<img class="flag" src="${item.flagPng}" alt="${item.name} flag"/>${item.name}` : item.name;
    const topLine = game.mode === "state"
      ? `${item.capital} | ${item.language}`
      : game.mode === "district"
        ? `${item.state} | HQ ${item.headquarters}`
        : `${item.capital} | ${item.currency}`;
    const extra = game.mode === "world"
      ? `<p>Longest River: ${item.longestRiver}</p><p>Highest Mountain: ${item.highestMountain}</p><p>Famous Cities: ${(item.famousCities || []).join(", ")}</p>`
      : "";

    return `<article class="atlas-card"><h3>${title}</h3><p>${topLine}</p><p>Region: ${item.region}</p><p>Area: ${formatNumber(item.areaKm2)} sq km</p><p>Population: ${formatNumber(item.population)}</p>${extra}<p>${item.fact}</p></article>`;
  }).join("");
}

function renderKnowledgeProvider() {
  const t = game.target;
  if (!t || !els.knowledgeProvider) return;

  const cards = game.mode === "world"
    ? [
        { title: "Capital & Currency", text: `${t.name}: ${t.capital} | ${t.currency}` },
        { title: "Natural Markers", text: `River: ${t.longestRiver} | Mountain: ${t.highestMountain}` },
        { title: "Culture Snapshot", text: `Cities: ${(t.famousCities || []).join(", ")}` },
        { title: "People", text: `Known personalities: ${(t.famousPersonalities || []).join(", ")}` }
      ]
    : game.mode === "district"
      ? [
          { title: "District Context", text: `${t.name} belongs to ${t.state} in ${t.region} India.` },
          { title: "Administrative Core", text: `Headquarters: ${t.headquarters}` },
          { title: "Geo-Environment", text: `${t.physiography} | ${t.climate}` },
          { title: "Economy & Heritage", text: `${t.economy} | ${t.heritage}` }
        ]
      : [
          { title: "State Core", text: `${t.name} has capital ${t.capital} in ${t.region}.` },
          { title: "Language & Literacy", text: `${t.language} | Literacy ${t.literacy}%` },
          { title: "Population Scale", text: `Population ${formatNumber(t.population)}` },
          { title: "Terrain Signal", text: t.coastal ? "Coastal state/UT geography" : "Inland state/UT geography" }
        ];

  els.knowledgeProvider.innerHTML = cards.map((c) => `<article class="knowledge-card"><h3>${c.title}</h3><p>${c.text}</p></article>`).join("");
}

function makeGuess() {
  if (game.won || game.guesses.length >= MAX_GUESSES) return;

  const item = findItemByName(els.guessInput.value);
  if (!item) {
    els.status.textContent = `Name not found in ${modeConfig[game.mode].label} list. Use suggestions.`;
    return;
  }

  if (game.guesses.some((g) => g.item.name === item.name)) {
    els.status.textContent = "You already guessed that one. Try another.";
    return;
  }

  const result = compareGuess(item, game.target);
  game.guesses.push({ item, result });
  if (result.exact) game.won = true;

  els.guessInput.value = "";
  renderBoard();
  renderStatus();
  renderQuestion();
  renderTargetInfo();
  renderMap();
  renderKnowledgeProvider();
}

els.stateModeBtn.addEventListener("click", () => setMode("state"));
els.districtModeBtn.addEventListener("click", () => setMode("district"));
els.worldModeBtn.addEventListener("click", () => setMode("world"));
els.guessBtn.addEventListener("click", makeGuess);
els.guessInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    makeGuess();
  }
});
els.resetBtn.addEventListener("click", () => setMode(game.mode, true));
els.atlasSearch.addEventListener("input", renderAtlas);

setMode("state");
scheduleDailyRefreshAtIstMidnight();
