(() => {
  const REGION = "toshkent";

  const els = {
    statusPill: document.querySelector(".status-pill"),
    statusLabel: document.getElementById("statusLabel"),
    clockLabel: document.getElementById("clockLabel"),
    cacheLabel: document.getElementById("cacheLabel"),
    prayerMeta: document.getElementById("prayerMeta"),
    prayerGrid: document.getElementById("prayerGrid"),
    dayTrack: document.getElementById("dayTrack"),
    currentIntervalLabel: document.getElementById("currentIntervalLabel"),
    habitsBox: document.getElementById("habitsBox"),
    habitsList: document.getElementById("habitsList"),
    output: document.getElementById("output"),
  };

  const PRAYER_LABELS = [
    ["fajr", "Фаджр"],
    ["dhuhr", "Зухр"],
    ["asr", "Аср"],
    ["maghrib", "Магриб"],
    ["isha", "Иша"],
  ];

  function setStatus(state, label) {
    els.statusPill.dataset.state = state;
    els.statusLabel.textContent = label;
  }

  function fmtTime(value) {
    if (!value) return "—";
    return String(value).slice(0, 5);
  }

  function print(title, payload, meta = {}) {
    const header = [
      `// ${title}`,
      meta.status != null ? `// HTTP ${meta.status}` : null,
      meta.ms != null ? `// ${meta.ms} ms` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const body =
      typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    els.output.textContent = `${header}\n\n${body}`;
  }

  async function apiGet(path) {
    const started = performance.now();
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    const ms = Math.round(performance.now() - started);
    let data;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const err = new Error(typeof data === "object" ? data.detail || res.statusText : res.statusText);
      err.status = res.status;
      err.data = data;
      err.ms = ms;
      throw err;
    }
    return { data, status: res.status, ms };
  }

  function renderPrayers(prayer) {
    els.prayerMeta.textContent = [
      `Регион: ${prayer.region}`,
      `дата: ${prayer.date}`,
      prayer.source ? `источник: ${prayer.source}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    els.cacheLabel.textContent = `кэш: ${prayer.cached ? "да (сутки)" : "нет (свежий запрос)"}`;

    const now = els.clockLabel.textContent;
    els.prayerGrid.innerHTML = PRAYER_LABELS.map(([key, label]) => {
      const t = fmtTime(prayer[key]);
      const isNext = now !== "--:--:--" && t >= now.slice(0, 5);
      return `<li class="${isNext ? "is-next" : ""}"><span>${label}</span><strong>${t}</strong></li>`;
    }).join("");
  }

  function renderTimeline(timeline) {
    const current = timeline.current_interval;
    els.currentIntervalLabel.textContent = current
      ? `Сейчас: ${current.label} (${fmtTime(current.start_time)}–${fmtTime(current.end_time)})`
      : "Текущий блок не определён";

    const intervals = timeline.intervals || [];
    let seenCurrent = false;

    els.dayTrack.innerHTML = intervals
      .map((item) => {
        if (item.is_current) seenCurrent = true;
        const state = item.is_current ? "is-current" : seenCurrent ? "" : "is-past";
        return `
          <div class="interval ${state}" role="listitem">
            <div class="when">${fmtTime(item.start_time)}–${fmtTime(item.end_time)}</div>
            <div class="label">${item.label}${item.is_current ? " · сейчас" : ""}</div>
            <div class="bar" aria-hidden="true"><i></i></div>
          </div>
        `;
      })
      .join("");

    // Trigger bar width animation after paint
    requestAnimationFrame(() => {
      els.dayTrack.querySelectorAll(".interval.is-past .bar > i, .interval.is-current .bar > i")
        .forEach((el) => {
          el.style.width = "100%";
        });
    });

    const habits = current?.habits || [];
    if (habits.length) {
      els.habitsBox.hidden = false;
      els.habitsList.innerHTML = habits
        .map(
          (h) => `
          <li>
            <span>${h.title}</span>
            <span class="${h.is_done ? "done" : "todo"}">${h.is_done ? "сделано" : "не сделано"}</span>
          </li>`
        )
        .join("");
    } else {
      els.habitsBox.hidden = true;
      els.habitsList.innerHTML = "";
    }
  }

  async function loadDashboard() {
    setStatus("idle", "Загрузка…");
    try {
      const health = await apiGet("/health");
      if (health.data?.status !== "ok") {
        throw new Error("Сервис не в статусе ok");
      }

      const timeline = await apiGet(`/api/day-timeline?region=${encodeURIComponent(REGION)}`);
      renderPrayers(timeline.data.prayer_times);
      renderTimeline(timeline.data);
      if (timeline.data.current_time) {
        els.clockLabel.textContent = String(timeline.data.current_time).slice(0, 8);
      }
      setStatus("ok", "Сервис работает");
      return timeline;
    } catch (err) {
      setStatus("error", "Ошибка связи");
      print("Ошибка загрузки дашборда", err.data || err.message, {
        status: err.status,
        ms: err.ms,
      });
      throw err;
    }
  }

  async function runAction(action, button) {
    button.disabled = true;
    try {
      if (action === "refresh") {
        const result = await loadDashboard();
        print("GET /api/day-timeline (обновление панели)", result.data, {
          status: result.status,
          ms: result.ms,
        });
        return;
      }

      const map = {
        health: "/health",
        prayer: `/api/prayer-times?region=${encodeURIComponent(REGION)}`,
        timeline: `/api/day-timeline?region=${encodeURIComponent(REGION)}`,
      };
      const path = map[action];
      if (!path) return;

      const result = await apiGet(path);
      print(`GET ${path}`, result.data, { status: result.status, ms: result.ms });

      if (action === "prayer") {
        renderPrayers(result.data);
        setStatus("ok", "Сервис работает");
      }
      if (action === "timeline") {
        renderPrayers(result.data.prayer_times);
        renderTimeline(result.data);
        if (result.data.current_time) {
          els.clockLabel.textContent = String(result.data.current_time).slice(0, 8);
        }
        setStatus("ok", "Сервис работает");
      }
      if (action === "health") {
        setStatus(result.data?.status === "ok" ? "ok" : "error", "Сервис работает");
      }
    } catch (err) {
      setStatus("error", "Ошибка запроса");
      print("Ошибка", err.data || err.message, { status: err.status, ms: err.ms });
    } finally {
      button.disabled = false;
    }
  }

  function tickClock() {
    const now = new Date();
    els.clockLabel.textContent = now.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  document.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => runAction(btn.dataset.action, btn));
  });

  tickClock();
  setInterval(tickClock, 1000);
  loadDashboard().catch(() => {});
})();
