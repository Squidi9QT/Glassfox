const $ = (s) => document.querySelector(s);

const DEFAULT_SITES = [
  { name: "YouTube", url: "https://www.youtube.com/" },
  { name: "Gmail", url: "https://mail.google.com/" },
  { name: "Claude", url: "https://claude.ai/" },
  { name: "ChatGPT", url: "https://chatgpt.com/" },
  { name: "GitHub", url: "https://github.com/" },
  { name: "Telegram", url: "https://web.telegram.org/" },
  { name: "Переводчик", url: "https://translate.google.com/" },
  { name: "Карты", url: "https://yandex.ru/maps/" }
];

const ICON_X = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="m2 2 6 6M8 2 2 8"/></svg>';
const ICON_SOUND = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 6h2.5L8 3v10L4.5 10H2z"/><path d="M10.5 5.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

let view = "tabs";
let tabs = [];
let sites = [];
let currentWindowId = null;
let focusIndex = 0;

// ---------- Помощники ----------

function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hueOf(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function iconEl(src, label, cls) {
  const letter = () => {
    const d = document.createElement("div");
    d.className = cls + " letter";
    d.style.setProperty("--h", hueOf(label || "?"));
    d.textContent = (label || "?").trim().charAt(0).toUpperCase();
    return d;
  };
  // Страницы браузера (about:, chrome:) не отдают иконки расширениям.
  if (!src || !/^(https?:|data:)/.test(src)) return letter();
  const img = document.createElement("img");
  img.className = cls;
  img.src = src;
  img.alt = "";
  img.addEventListener("error", () => img.replaceWith(letter()), { once: true });
  return img;
}

function matches(text, q) {
  return text.toLowerCase().includes(q);
}

// ---------- Вкладки ----------

async function loadTabs() {
  const win = await browser.windows.getCurrent();
  currentWindowId = win.id;
  tabs = await browser.tabs.query({});
  // Сначала текущее окно, внутри окна — по порядку вкладок.
  tabs.sort((a, b) =>
    (a.windowId === currentWindowId ? 0 : 1) - (b.windowId === currentWindowId ? 0 : 1) ||
    a.windowId - b.windowId || a.index - b.index);
  $("#tab-count").textContent = tabs.length;
}

function visibleTabs() {
  const q = $("#query").value.trim().toLowerCase();
  if (!q) return tabs;
  return tabs.filter((t) => matches(t.title || "", q) || matches(t.url || "", q));
}

function renderTabs() {
  const list = $("#tab-list");
  list.textContent = "";
  const shown = visibleTabs();
  if (!shown.length) {
    list.innerHTML = '<li class="empty">Ничего не найдено</li>';
    return;
  }
  focusIndex = Math.min(focusIndex, shown.length - 1);
  const windows = new Set(shown.map((t) => t.windowId));
  let lastWindow = null;
  let windowNo = 0;

  shown.forEach((tab, i) => {
    if (windows.size > 1 && tab.windowId !== lastWindow) {
      windowNo++;
      lastWindow = tab.windowId;
      const title = document.createElement("li");
      title.className = "window-title";
      title.textContent = tab.windowId === currentWindowId ? "Это окно" : "Окно " + windowNo;
      list.append(title);
    }

    const li = document.createElement("li");
    li.className = "row";
    if (tab.active && tab.windowId === currentWindowId) li.classList.add("current");
    if (i === focusIndex) li.classList.add("focus");

    const text = document.createElement("div");
    text.className = "row-text";
    const t = document.createElement("div");
    t.className = "row-title";
    t.textContent = tab.title || "Без названия";
    const h = document.createElement("div");
    h.className = "row-host";
    h.textContent = host(tab.url) || tab.url;
    text.append(t, h);

    li.append(iconEl(tab.favIconUrl, tab.title, "favicon"), text);

    if (tab.audible) {
      const s = document.createElement("span");
      s.className = "audible";
      s.innerHTML = ICON_SOUND;
      li.append(s);
    }

    const close = document.createElement("button");
    close.className = "close";
    close.title = "Закрыть вкладку";
    close.innerHTML = ICON_X;
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab, li);
    });
    li.append(close);

    li.addEventListener("click", () => openTab(tab));
    li.addEventListener("mousemove", () => {
      if (focusIndex !== i) {
        focusIndex = i;
        list.querySelectorAll(".row").forEach((r, j) => r.classList.toggle("focus", j === i));
      }
    });
    list.append(li);
  });
}

async function openTab(tab) {
  await browser.tabs.update(tab.id, { active: true });
  if (tab.windowId !== currentWindowId) await browser.windows.update(tab.windowId, { focused: true });
  window.close();
}

async function closeTab(tab, li) {
  li.classList.add("leaving");
  await browser.tabs.remove(tab.id);
  tabs = tabs.filter((t) => t.id !== tab.id);
  $("#tab-count").textContent = tabs.length;
  setTimeout(renderTabs, 200);
}

// ---------- Сайты ----------

async function loadSites() {
  const saved = await browser.storage.local.get("sites");
  sites = Array.isArray(saved.sites) ? saved.sites : DEFAULT_SITES;
}

function saveSites() {
  return browser.storage.local.set({ sites });
}

function renderSites() {
  const grid = $("#site-grid");
  grid.textContent = "";
  const q = $("#query").value.trim().toLowerCase();
  const shown = sites.filter((s) => !q || matches(s.name, q) || matches(s.url, q));
  if (!shown.length) {
    grid.innerHTML = '<div class="empty" style="grid-column: 1 / -1">Ничего не найдено</div>';
    return;
  }
  for (const site of shown) {
    const tile = document.createElement("button");
    tile.className = "tile";
    tile.title = site.url;
    const name = document.createElement("span");
    name.className = "tile-name";
    name.textContent = site.name;
    const remove = document.createElement("span");
    remove.className = "tile-remove";
    remove.title = "Убрать";
    remove.innerHTML = ICON_X;
    remove.addEventListener("click", async (e) => {
      e.stopPropagation();
      sites = sites.filter((s) => s !== site);
      await saveSites();
      renderSites();
    });
    const icon = site.icon || new URL("/favicon.ico", site.url).href;
    tile.append(iconEl(icon, site.name, "tile-icon"), name, remove);
    tile.addEventListener("click", () => openSite(site));
    grid.append(tile);
  }
}

async function openSite(site) {
  // Если сайт уже открыт — переходим в его вкладку, а не плодим новую.
  const h = host(site.url);
  const existing = tabs.find((t) => host(t.url) === h);
  if (existing) return openTab(existing);
  await browser.tabs.create({ url: site.url });
  window.close();
}

async function addCurrentSite() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url)) return;
  const origin = new URL(tab.url).origin + "/";
  if (sites.some((s) => host(s.url) === host(origin))) return;
  const name = (tab.title || host(origin)).split(/[—|\-–·:]/)[0].trim().slice(0, 18) || host(origin);
  sites.push({ name, url: origin, icon: tab.favIconUrl || "" });
  await saveSites();
  renderSites();
}

// ---------- Переключение и клавиатура ----------

function setView(next) {
  view = next;
  const sw = $("#tabs-switch");
  sw.dataset.index = next === "tabs" ? "0" : "1";
  sw.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === next)));
  $("#view-tabs").hidden = next !== "tabs";
  $("#view-sites").hidden = next !== "sites";
  render();
  $("#query").focus();
}

function render() {
  if (view === "tabs") renderTabs();
  else renderSites();
}

$("#tabs-switch").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) setView(b.dataset.view);
});

$("#query").addEventListener("input", () => {
  focusIndex = 0;
  render();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && !e.shiftKey && document.activeElement === $("#query")) {
    e.preventDefault();
    setView(view === "tabs" ? "sites" : "tabs");
    return;
  }
  if (view !== "tabs") {
    if (e.key === "Enter") {
      const first = $("#site-grid .tile");
      if (first) first.click();
    }
    return;
  }
  const shown = visibleTabs();
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    focusIndex = (focusIndex + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
    renderTabs();
    const el = $("#tab-list .row.focus");
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } else if (e.key === "Enter" && shown[focusIndex]) {
    openTab(shown[focusIndex]);
  }
});

$("#add-site").addEventListener("click", addCurrentSite);

// ---------- Мини-плеер ----------

function renderPlayer(s) {
  const footer = $("#mini-player");
  footer.classList.toggle("playing", s.playing);
  footer.classList.toggle("loading", s.loading);
  const station = s.stations.find((x) => x.id === s.stationId) || s.stations[0];
  $("#mini-name").textContent = station ? station.name : "Музыка";
  $("#mini-status").textContent = s.error
    ? s.error
    : s.loading ? "Подключение…" : s.playing ? station.genre : "Не играет";
}

$("#mini-play").addEventListener("click", async () => {
  renderPlayer(await browser.runtime.sendMessage({ type: "toggle" }));
});

$("#open-sidebar").addEventListener("click", () => {
  browser.sidebarAction.open();
  window.close();
});

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === "state") renderPlayer(msg.state);
});

// ---------- Старт ----------

Promise.all([loadTabs(), loadSites()]).then(() => {
  const i = visibleTabs().findIndex((t) => t.active && t.windowId === currentWindowId);
  focusIndex = Math.max(0, i);
  render();
  const el = $("#tab-list .row.focus");
  if (el) el.scrollIntoView({ block: "center" });
});
browser.runtime.sendMessage({ type: "get" }).then(renderPlayer);
