const $ = (s) => document.querySelector(s);
const ICON_X = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="m2 2 6 6M8 2 2 8"/></svg>';

let last = null;
let draggingVolume = false;

const send = (msg) => browser.runtime.sendMessage(msg).then(render);

function render(s) {
  last = s;
  const station = s.stations.find((x) => x.id === s.stationId) || s.stations[0];

  document.body.classList.toggle("playing", s.playing);
  document.body.classList.toggle("loading", s.loading);

  if (station) {
    $("#art").style.setProperty("--h", station.hue);
    $("#now-name").textContent = station.name;
  }
  $("#now-genre").textContent = s.loading ? "Подключение…" : station ? station.genre : "";
  if (!draggingVolume) $("#volume").value = s.volume;

  const err = $("#error");
  err.hidden = !s.error;
  err.textContent = s.error || "";

  renderStations(s);
}

function renderStations(s) {
  const list = $("#stations");
  list.textContent = "";
  for (const st of s.stations) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "station";
    if (st.id === s.stationId && (s.playing || s.loading)) btn.classList.add("current");

    const art = document.createElement("span");
    art.className = "station-art";
    art.style.setProperty("--h", st.hue);
    art.innerHTML = '<span class="bars"><i></i><i></i><i></i></span>';

    const text = document.createElement("span");
    text.className = "station-text";
    const name = document.createElement("div");
    name.className = "station-name";
    name.textContent = st.name;
    const genre = document.createElement("div");
    genre.className = "station-genre";
    genre.textContent = st.genre;
    text.append(name, genre);

    btn.append(art, text);

    if (st.custom) {
      const rm = document.createElement("span");
      rm.className = "station-remove";
      rm.title = "Удалить станцию";
      rm.innerHTML = ICON_X;
      rm.addEventListener("click", (e) => {
        e.stopPropagation();
        send({ type: "removeStation", id: st.id });
      });
      btn.append(rm);
    }

    btn.addEventListener("click", () => {
      const isCurrent = st.id === s.stationId && (s.playing || s.loading);
      send(isCurrent ? { type: "toggle" } : { type: "play", id: st.id });
    });

    li.append(btn);
    list.append(li);
  }
}

$("#play").addEventListener("click", () => send({ type: "toggle" }));

const volume = $("#volume");
volume.addEventListener("pointerdown", () => (draggingVolume = true));
volume.addEventListener("pointerup", () => (draggingVolume = false));
volume.addEventListener("input", () => {
  browser.runtime.sendMessage({ type: "volume", value: Number(volume.value) });
});

$("#add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#add-name").value.trim();
  const url = $("#add-url").value.trim();
  if (!name || !/^https?:\/\//.test(url)) return;
  send({ type: "addStation", name, url });
  e.target.reset();
  e.target.closest("details").open = false;
});

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === "state") render(msg.state);
});

send({ type: "get" });
