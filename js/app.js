import { districts, normalizeName, states } from "./data.js";

const MAX_GUESSES = 6;

const els = {
  stateModeBtn: document.getElementById("stateModeBtn"),
  districtModeBtn: document.getElementById("districtModeBtn"),
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
  atlasGrid: document.getElementById("atlasGrid")
};

const modeConfig = {
  state: { items: states, label: "State / UT" },
  district: { items: districts, label: "District" }
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

function dateSeed() {
  const now = new Date();
  const key = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  return hashString(key);
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
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
  els.guessInput.value = "";
  renderOptions();
  renderBoard();
  renderStatus();
  renderQuestion();
  renderTargetInfo();
  renderMap();
  renderAtlas();
}

function renderQuestion() {
  if (!game.target) {
    return;
  }

  const clueItems = game.mode === "state"
    ? [
        `Region: ${game.target.region}`,
        `Capital starts with: ${game.target.capital.charAt(0)}`,
        `Primary language starts with: ${game.target.language.charAt(0)}`,
        `Area band: ${game.target.areaKm2 > 200000 ? "Very Large" : game.target.areaKm2 > 70000 ? "Medium" : "Compact"}`,
        `Coastal: ${game.target.coastal ? "Yes" : "No"}`
      ]
    : [
        `Parent state: ${game.target.state}`,
        `Region: ${game.target.region}`,
        `Headquarters starts with: ${game.target.headquarters.charAt(0)}`,
        `Area band: ${game.target.areaKm2 > 8000 ? "Large" : game.target.areaKm2 > 2500 ? "Medium" : "Compact"}`,
        `Population band: ${game.target.population > 4000000 ? "Very High" : game.target.population > 1500000 ? "High" : "Moderate"}`
      ];

  const visibleClues = game.won || game.guesses.length >= MAX_GUESSES
    ? clueItems
    : clueItems.slice(0, Math.min(2 + Math.floor(game.guesses.length / 2), clueItems.length));

  els.questionTitle.textContent = game.mode === "state" ? "Today's Question: Which State or UT is this?" : "Today's Question: Which District is this?";
  els.questionText.textContent = game.mode === "state"
    ? "Use clues, map distance hints, and comparative stats to identify the hidden State or UT."
    : "Use clues, parent-state hints, and distance direction feedback to identify the hidden district.";

  els.questionHints.innerHTML = visibleClues.map((clue) => `<li>${clue}</li>`).join("");
}

function initMap() {
  if (leafletMap || !window.L || !els.mapView) {
    return;
  }

  leafletMap = L.map(els.mapView, {
    center: [22.6, 79.5],
    zoom: 5,
    minZoom: 4,
    maxZoom: 10
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(leafletMap);

  guessLayer = L.layerGroup().addTo(leafletMap);
  targetLayer = L.layerGroup().addTo(leafletMap);
}

function hasRoundEnded() {
  return game.won || game.guesses.length >= MAX_GUESSES;
}

function renderMap() {
  initMap();

  if (!leafletMap) {
    if (els.mapStatus) {
      els.mapStatus.textContent = "Map library failed to load. Check internet access for Leaflet CDN.";
    }
    return;
  }

  guessLayer.clearLayers();
  targetLayer.clearLayers();

  const bounds = [];
  game.guesses.forEach((guess, idx) => {
    const marker = L.circleMarker([guess.item.lat, guess.item.lon], {
      radius: 7,
      color: "#0a7fcb",
      weight: 2,
      fillColor: "#52b6ff",
      fillOpacity: 0.9
    });
    marker.bindPopup(`<strong>Guess ${idx + 1}:</strong> ${guess.item.name}`);
    marker.addTo(guessLayer);
    bounds.push([guess.item.lat, guess.item.lon]);
  });

  if (hasRoundEnded()) {
    const targetMarker = L.circleMarker([game.target.lat, game.target.lon], {
      radius: 8,
      color: "#8f1d1d",
      weight: 2,
      fillColor: "#d43a3a",
      fillOpacity: 0.95
    });
    targetMarker.bindPopup(`<strong>Target:</strong> ${game.target.name}`);
    targetMarker.addTo(targetLayer);
    bounds.push([game.target.lat, game.target.lon]);
  }

  if (bounds.length) {
    leafletMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 6 });
  } else {
    leafletMap.setView([22.6, 79.5], 5);
  }

  if (els.mapStatus) {
    els.mapStatus.textContent = hasRoundEnded()
      ? `Blue markers are your guesses. Red marker is the target: ${game.target.name}.`
      : "Blue markers are your guesses. The red target marker appears after you solve or finish all guesses.";
  }
}

function renderOptions() {
  const options = modeConfig[game.mode].items
    .map((item) => `<option value="${item.name}"></option>`)
    .join("");
  els.guessOptions.innerHTML = options;
}

function findItemByName(inputName) {
  const normalized = normalizeName(inputName);
  return modeConfig[game.mode].items.find((item) => normalizeName(item.name) === normalized);
}

function formatNumber(num) {
  return new Intl.NumberFormat("en-IN").format(num);
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
  const sameRegion = guess.region === target.region;
  const areaHint = guess.areaKm2 === target.areaKm2 ? "equal" : guess.areaKm2 < target.areaKm2 ? "higher" : "lower";
  const popHint = guess.population === target.population ? "equal" : guess.population < target.population ? "higher" : "lower";

  return {
    exact: guess.name === target.name,
    sameRegion,
    areaHint,
    popHint,
    distance,
    direction,
    sameState: game.mode === "district" ? guess.state === target.state : null,
    coastMatch: game.mode === "state" ? guess.coastal === target.coastal : null
  };
}

function chip(text, tone = "") {
  const css = tone ? `chip ${tone}` : "chip";
  return `<span class="${css}">${text}</span>`;
}

function renderBoard() {
  if (!game.guesses.length) {
    els.guessBoard.innerHTML = "<p>No guesses yet. Start with any name from the suggestion list.</p>";
    return;
  }

  els.guessBoard.innerHTML = game.guesses
    .map(({ item, result }, index) => {
      const distanceTone = result.distance <= 200 ? "ok" : result.distance <= 700 ? "warn" : "bad";
      const chips = [
        chip(`Distance ${result.distance} km ${result.direction}`, distanceTone),
        chip(`Region ${result.sameRegion ? "match" : "no"}`, result.sameRegion ? "ok" : "bad"),
        chip(`Area ${result.areaHint}`),
        chip(`Population ${result.popHint}`)
      ];

      if (game.mode === "state") {
        chips.push(chip(`Coastal ${result.coastMatch ? "match" : "no"}`, result.coastMatch ? "ok" : "warn"));
      }

      if (game.mode === "district") {
        chips.push(chip(`Parent state ${result.sameState ? "match" : "no"}`, result.sameState ? "ok" : "warn"));
      }

      if (result.exact) {
        chips.push(chip("Correct", "ok"));
      }

      return `
      <article class="guess-card">
        <div class="guess-top">
          <p class="guess-name">${index + 1}. ${item.name}</p>
        </div>
        <p class="guess-sub">${game.mode === "district" ? `${item.state} district` : `${item.capital} | ${item.language}`}</p>
        <div class="chips">${chips.join("")}</div>
      </article>`;
    })
    .join("");
}

function renderStatus() {
  const modeLabel = modeConfig[game.mode].label;
  const left = MAX_GUESSES - game.guesses.length;

  if (game.won) {
    els.status.textContent = `Great job. You solved the ${modeLabel} puzzle in ${game.guesses.length} guesses.`;
    return;
  }

  if (left <= 0) {
    els.status.textContent = `No guesses left. The answer was ${game.target.name}.`;
    return;
  }

  els.status.textContent = `Mode: ${modeLabel}. ${left} guesses left.`;
}

function renderTargetInfo() {
  if (!game.won && game.guesses.length < MAX_GUESSES) {
    els.targetInfo.className = "target-info empty";
    els.targetInfo.textContent = "Solve the puzzle (or use all guesses) to reveal full details.";
    return;
  }

  const t = game.target;
  const details = game.mode === "state"
    ? [
        `Capital: ${t.capital}`,
        `Region: ${t.region}`,
        `Area: ${formatNumber(t.areaKm2)} sq km`,
        `Population: ${formatNumber(t.population)}`,
        `Literacy: ${t.literacy}%`,
        `Primary Language: ${t.language}`,
        `Coastal: ${t.coastal ? "Yes" : "No"}`,
        `Coordinates: ${t.lat}, ${t.lon}`
      ]
    : [
        `State/UT: ${t.state}`,
        `Headquarters: ${t.headquarters}`,
        `Region: ${t.region}`,
        `Area: ${formatNumber(t.areaKm2)} sq km`,
        `Population: ${formatNumber(t.population)}`,
        `Coordinates: ${t.lat}, ${t.lon}`
      ];

  els.targetInfo.className = "target-info";
  els.targetInfo.innerHTML = `
    <article class="target-card">
      <h3>${t.name}</h3>
      <p>${t.fact}</p>
      <div class="target-grid">
        ${details.map((d) => `<div class="fact">${d}</div>`).join("")}
      </div>
    </article>
  `;
}

function makeGuess() {
  if (game.won || game.guesses.length >= MAX_GUESSES) {
    return;
  }

  const input = els.guessInput.value;
  const item = findItemByName(input);

  if (!item) {
    els.status.textContent = `Name not found in ${modeConfig[game.mode].label} list. Use suggestions.`;
    return;
  }

  const already = game.guesses.some((g) => g.item.name === item.name);
  if (already) {
    els.status.textContent = "You already guessed that one. Try another.";
    return;
  }

  const result = compareGuess(item, game.target);
  game.guesses.push({ item, result });

  if (result.exact) {
    game.won = true;
  }

  els.guessInput.value = "";
  renderBoard();
  renderStatus();
  renderQuestion();
  renderTargetInfo();
  renderMap();
}

function renderAtlas() {
  const query = normalizeName(els.atlasSearch.value || "");
  const list = modeConfig[game.mode].items.filter((item) => {
    const blob = normalizeName(
      [item.name, item.region, item.state || "", item.capital || "", item.headquarters || "", item.fact].join(" ")
    );
    return blob.includes(query);
  });

  els.atlasGrid.innerHTML = list
    .map((item) => {
      const topLine = game.mode === "state" ? `${item.capital} | ${item.language}` : `${item.state} | HQ ${item.headquarters}`;
      return `
      <article class="atlas-card">
        <h3>${item.name}</h3>
        <p>${topLine}</p>
        <p>Region: ${item.region}</p>
        <p>Area: ${formatNumber(item.areaKm2)} sq km</p>
        <p>Population: ${formatNumber(item.population)}</p>
        <p>${item.fact}</p>
      </article>`;
    })
    .join("");
}

els.stateModeBtn.addEventListener("click", () => setMode("state"));
els.districtModeBtn.addEventListener("click", () => setMode("district"));
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
