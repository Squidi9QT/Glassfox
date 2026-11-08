// Плеер живёт здесь, в фоне: музыка играет, даже когда панель и меню закрыты.

const audio = new Audio();
audio.preload = "none";

const state = {
  stationId: null,
  playing: false,
  loading: false,
  volume: 0.6,
  error: null,
  custom: []
};

function allStations() {
  return [...DEFAULT_STATIONS, ...state.custom];
}

function findStation(id) {
  return allStations().find((s) => s.id === id) || null;
}

function snapshot() {
  return {
    stationId: state.stationId,
    playing: state.playing,
    loading: state.loading,
    volume: state.volume,
    error: state.error,
    stations: allStations()
  };
}

function broadcast() {
  browser.runtime.sendMessage({ type: "state", state: snapshot() }).catch(() => {});
  browser.browserAction.setBadgeText({ text: state.playing ? "♪" : "" });
}

function stopStream() {
  // У живого потока нельзя «поставить на паузу»: после паузы он играл бы
  // старый кусок. Поэтому останавливаем совсем и при запуске подключаемся заново.
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

async function play(id) {
  const station = findStation(id || state.stationId) || allStations()[0];
  if (!station) return;
  state.stationId = station.id;
  state.error = null;
  state.loading = true;
  broadcast();
  stopStream();
  audio.src = station.url;
  audio.volume = state.volume;
  try {
    await audio.play();
  } catch (e) {
    state.loading = false;
    state.playing = false;
    state.error = "Не удалось подключиться к станции";
    broadcast();
  }
  browser.storage.local.set({ stationId: state.stationId });
}

function pause() {
  stopStream();
  state.playing = false;
  state.loading = false;
  broadcast();
}

audio.addEventListener("playing", () => {
  state.playing = true;
  state.loading = false;
  state.error = null;
  broadcast();
});
audio.addEventListener("waiting", () => {
  if (state.playing) {
    state.loading = true;
    broadcast();
  }
});
audio.addEventListener("error", () => {
  if (!audio.getAttribute("src")) return; // это наша же остановка потока
  state.playing = false;
  state.loading = false;
  state.error = "Станция не отвечает";
  broadcast();
});

async function handle(msg) {
  switch (msg.type) {
    case "get":
      break;
    case "play":
      await play(msg.id);
      break;
    case "toggle":
      if (state.playing || state.loading) pause();
      else await play();
      break;
    case "volume":
      state.volume = Math.min(1, Math.max(0, msg.value));
      audio.volume = state.volume;
      browser.storage.local.set({ volume: state.volume });
      broadcast();
      break;
    case "addStation": {
      const station = {
        id: "custom-" + Date.now(),
        name: msg.name,
        genre: "Своя станция",
        url: msg.url,
        hue: Math.floor(Math.random() * 360),
        custom: true
      };
      state.custom.push(station);
      await browser.storage.local.set({ customStations: state.custom });
      broadcast();
      break;
    }
    case "removeStation":
      if (state.stationId === msg.id) pause();
      state.custom = state.custom.filter((s) => s.id !== msg.id);
      await browser.storage.local.set({ customStations: state.custom });
      broadcast();
      break;
  }
  return snapshot();
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type && msg.type !== "state") return handle(msg);
});

browser.browserAction.setBadgeBackgroundColor({ color: "#0A84FF" });

browser.storage.local.get(["volume", "stationId", "customStations"]).then((saved) => {
  if (typeof saved.volume === "number") state.volume = saved.volume;
  if (Array.isArray(saved.customStations)) state.custom = saved.customStations;
  state.stationId = saved.stationId || DEFAULT_STATIONS[0].id;
  audio.volume = state.volume;
});
