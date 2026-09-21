(() => {
  // Local FastAPI; on Firebase Hosting use same-origin rewrites → Cloud Run
  const isLocal =
    typeof location !== "undefined" &&
    (location.hostname === "127.0.0.1" ||
      location.hostname === "localhost" ||
      location.protocol === "file:");
  const API_BASE = isLocal ? "http://127.0.0.1:8001" : "";

  const BLOCKS = [
    { code: "suhoor", short: "Сухур", label: "Сухур", start: "04:10", end: "04:50", wraps: false },
    { code: "bomdod", short: "Бомдод", label: "Бомдод", start: "04:50", end: "06:09", wraps: false },
    { code: "avvalo", short: "Аввало", label: "Аввало", start: "06:09", end: "12:21", wraps: false },
    { code: "peshin", short: "Пешин", label: "Пешин", start: "12:21", end: "16:33", wraps: false },
    { code: "asr", short: "Аср", label: "Аср", start: "16:33", end: "18:23", wraps: false },
    { code: "shom", short: "Шом", label: "Шом", start: "18:23", end: "19:37", wraps: false },
    { code: "xufton", short: "Хуфтон", label: "Хуфтон", start: "19:37", end: "22:00", wraps: false },
    { code: "son", short: "Сон", label: "Сон", start: "22:00", end: "04:10", wraps: true },
  ];

  const VISUAL_ORDER = BLOCKS.map((b) => b.code);

  const PRAYERS = [
    { code: "fajr", label: "Бомдод", time: "04:50" },
    { code: "dhuhr", label: "Пешин", time: "12:21" },
    { code: "asr", label: "Аср", time: "16:33" },
    { code: "maghrib", label: "Шом", time: "18:23" },
    { code: "isha", label: "Хуфтон", time: "19:37" },
  ];

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function formatCardWhen(t) {
    const date = t.date || todayKey();
    const [y, m, day] = date.split("-").map(Number);
    const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    const label = `${day} ${months[(m || 1) - 1] || ""}`;
    if (t.time) return `${label} · ${String(t.time).slice(0, 5)}`;
    return label;
  }

  const TASK_TYPE_META = {
    call: { icon: "📞", label: "Звонок" },
    meeting: { icon: "👥", label: "Встреча" },
    task: { icon: "💻", label: "Задача" },
    focus: { icon: "🎯", label: "Фокус" },
  };
  const TASK_VECTOR_META = {
    work: { icon: "🏢", label: "Рабочее" },
    personal: { icon: "👤", label: "Личное" },
    growth: { icon: "🚀", label: "Развитие" },
    home: { icon: "🏠", label: "Быт" },
  };

  function typeIcon(code) {
    return (TASK_TYPE_META[code] || TASK_TYPE_META.task).icon;
  }
  function vectorIcon(code) {
    return (TASK_VECTOR_META[code] || TASK_VECTOR_META.work).icon;
  }
  function typeLabel(code) {
    return (TASK_TYPE_META[code] || TASK_TYPE_META.task).label;
  }
  function vectorLabel(code) {
    return (TASK_VECTOR_META[code] || TASK_VECTOR_META.work).label;
  }
  function taskMetaChips(t) {
    return `<span class="prio prio-${t.priority}">P${t.priority}</span><span class="tag-chip type-${t.type || "task"}">${typeIcon(t.type)} ${typeLabel(t.type)}</span><span class="tag-chip vec-${t.vector || "work"}">${vectorIcon(t.vector)} ${vectorLabel(t.vector)}</span>`;
  }
  function emptyStateHtml({ icon, title, text, cta, ctaId }) {
    return `<div class="empty-state">
      <div class="empty-ico">${icon}</div>
      <h4>${title}</h4>
      <p>${text}</p>
      ${cta ? `<button type="button" class="empty-cta" id="${ctaId}">${cta}</button>` : ""}
    </div>`;
  }

  /** @type {{id:number,title:string,notes:string,priority:number,intervalCode:string,date:string,time:string|null,type:string,vector:string,done:boolean,subtasks:{id:string,title:string,completed:boolean}[]}[]} */
  let tasks = [
    { id: 1, title: "Спланировать 3 главных дела", notes: "", priority: 2, intervalCode: "avvalo", date: todayKey(), time: "09:30", type: "focus", vector: "work", done: false, subtasks: [{ id: "a1", title: "Выписать цели", completed: true }, { id: "a2", title: "Оценить время", completed: false }] },
    { id: 2, title: "Созвон с командой", notes: "Повестка: статус спринта", priority: 1, intervalCode: "avvalo", date: todayKey(), time: "11:30", type: "call", vector: "work", done: false, subtasks: [] },
    { id: 3, title: "Черновик предложения", notes: "", priority: 3, intervalCode: "peshin", date: todayKey(), time: "14:00", type: "task", vector: "work", done: false, subtasks: [] },
    { id: 4, title: "Оплата счетов", notes: "", priority: 2, intervalCode: "asr", date: todayKey(), time: null, type: "task", vector: "home", done: false, subtasks: [] },
    { id: 5, title: "Семейный ужин", notes: "", priority: 3, intervalCode: "shom", date: todayKey(), time: "19:00", type: "meeting", vector: "personal", done: false, subtasks: [] },
    { id: 6, title: "Итоги дня в дневник", notes: "", priority: 4, intervalCode: "xufton", date: todayKey(), time: null, type: "focus", vector: "growth", done: false, subtasks: [] },
    { id: 7, title: "Сухур / вода", notes: "", priority: 2, intervalCode: "suhoor", date: todayKey(), time: "04:20", type: "task", vector: "personal", done: true, subtasks: [] },
    { id: 8, title: "Отключить экраны", notes: "", priority: 3, intervalCode: "son", date: todayKey(), time: "22:15", type: "task", vector: "personal", done: false, subtasks: [] },
  ];

  /** @type {{id:number,habitId?:number,slug?:string,title:string,description?:string,color:string,intervalCode:string,timingMode?:string,startOffset?:number|null,duration?:number|null,vector?:string,level?:number,streak:number,doneToday:boolean,timingHint?:string,windowStart?:string|null,windowEnd?:string|null,isActiveWindow?:boolean,trackingId?:number}[]} */
  let habits = [
    { id: 1, slug: "taxorat", title: "taxorat", description: "Первые 20 минут Сухура", icon: "💧", color: "#B85C38", intervalCode: "suhoor", timingMode: "first_n", startOffset: 0, duration: 20, vector: "spiritual", level: 2, streak: 1, doneToday: false, timingHint: "первые 20 мин" },
    { id: 2, slug: "taxajud", title: "taxajud", description: "Последние 20 минут Сухура", icon: "🌙", color: "#2A3A5C", intervalCode: "suhoor", timingMode: "last_n", startOffset: null, duration: 20, vector: "spiritual", level: 1, streak: 1, doneToday: false, timingHint: "последние 20 мин" },
    { id: 3, slug: "nafisbot", title: "nafisbot", description: "Первые 20 минут Бомдода", icon: "☀️", color: "#1F6B54", intervalCode: "bomdod", timingMode: "first_n", startOffset: 0, duration: 20, vector: "spiritual", level: 2, streak: 1, doneToday: false, timingHint: "первые 20 мин" },
    { id: 4, slug: "tilovat", title: "tilovat", description: "После nafisbot", icon: "📖", color: "#C47B2D", intervalCode: "bomdod", timingMode: "after_start", startOffset: 20, duration: 5, vector: "spiritual", level: 2, streak: 1, doneToday: false, timingHint: "+20 мин · 5 мин" },
    { id: 5, slug: "jamoat", title: "jamoat", description: "После tilovat", icon: "👥", color: "#2F6F8F", intervalCode: "bomdod", timingMode: "after_start", startOffset: 25, duration: 20, vector: "spiritual", level: 1, streak: 1, doneToday: false, timingHint: "+25 мин · 20 мин" },
    { id: 6, slug: "ishroq", title: "ishroq", description: "Через 15 мин Аввало", icon: "🌅", color: "#C47B2D", intervalCode: "avvalo", timingMode: "after_start", startOffset: 15, duration: null, vector: "spiritual", level: 3, streak: 1, doneToday: false, timingHint: "с +15 мин" },
    { id: 7, slug: "qiroat", title: "qiroat", description: "Гибко в Аввало", icon: "📗", color: "#4A5D4E", intervalCode: "avvalo", timingMode: "anytime", startOffset: null, duration: null, vector: "growth", level: 3, streak: 1, doneToday: false, timingHint: "в течение блока" },
    { id: 8, slug: "zeekr", title: "zeekr", description: "Гибко в Аввало", icon: "📿", color: "#8B4D6B", intervalCode: "avvalo", timingMode: "anytime", startOffset: null, duration: null, vector: "spiritual", level: 4, streak: 1, doneToday: false, timingHint: "в течение блока" },
  ];

  const HABIT_LEVEL_META = {
    1: { label: "Критично", icon: "🔴", short: "Крит.", xpWeight: 3, missWeight: 3, honorBonus: 2 },
    2: { label: "Важно", icon: "🟠", short: "Важно", xpWeight: 2, missWeight: 2, honorBonus: 1 },
    3: { label: "Рекомендовано", icon: "🔵", short: "Реком.", xpWeight: 1.25, missWeight: 1.25, honorBonus: 0 },
    4: { label: "Желательно", icon: "⚪", short: "Желат.", xpWeight: 1, missWeight: 1, honorBonus: 0 },
  };
  function habitLevelOf(h) {
    const n = Number(h?.level);
    return HABIT_LEVEL_META[n] ? n : 3;
  }
  function habitLevelMeta(hOrLevel) {
    const n = typeof hOrLevel === "object" ? habitLevelOf(hOrLevel) : Number(hOrLevel) || 3;
    return HABIT_LEVEL_META[n] || HABIT_LEVEL_META[3];
  }

  const HABIT_VECTOR_META = {
    spiritual: { icon: "🕌", label: "Духовное" },
    health: { icon: "💚", label: "Здоровье" },
    growth: { icon: "🚀", label: "Развитие" },
  };

  const HABIT_TIMING = {
    first_20: { mode: "first_n", offset: 0, duration: 20, hint: "первые 20 мин" },
    last_20: { mode: "last_n", offset: null, duration: 20, hint: "последние 20 мин" },
    after_15: { mode: "after_start", offset: 15, duration: null, hint: "с +15 мин" },
    anytime: { mode: "anytime", offset: null, duration: null, hint: "в течение блока" },
  };

  const HABIT_ICON_CATS = [
    { id: "spiritual", label: "Духовное", icons: ["🕌", "📿", "🕋", "🤲", "🌙", "✨", "🕯️", "📖", "☪️", "🙏"] },
    { id: "health", label: "Здоровье", icons: ["💚", "🧘", "🏃", "💧", "🥗", "😴", "🧠", "❤️", "🩺", "🍎"] },
    { id: "sport", label: "Спорт", icons: ["🏋️", "🚴", "⚽", "🏊", "🧗", "🤸", "🥊", "🏸", "⛷️", "🎯"] },
    { id: "productivity", label: "Продуктивность", icons: ["💻", "📝", "📚", "⏱️", "✅", "📌", "🗂️", "💡", "📊", "🗓️"] },
    { id: "quran", label: "Коран / Учёба", icons: ["📗", "✍️", "🗣️", "🎧", "📜", "🎓", "🔤", "🖊️", "📓", "🌟"] },
    { id: "home", label: "Быт / Дом", icons: ["🏠", "🧹", "🧺", "🍳", "🪴", "🛏️", "🔑", "🛠️", "🛒", "☕"] },
  ];

  /** @type {Record<string, {titles:string[], suhoor:boolean}>} date -> day log */
  let habitLogs = {};
  try {
    habitLogs = JSON.parse(localStorage.getItem("dayline-habit-logs") || "{}") || {};
  } catch {
    habitLogs = {};
  }

  const RIGHTEOUS_GOAL = 40;
  const STREAK_GOAL = 40;
  const XP_BASE = 10;
  const XP_DAY_SOLID = 28;
  const MISS_UNIT = 6;

  function saveHabitLogs() {
    localStorage.setItem("dayline-habit-logs", JSON.stringify(habitLogs));
  }

  function normalizeLogEntry(raw) {
    if (Array.isArray(raw)) return { titles: raw, suhoor: false };
    if (raw && Array.isArray(raw.titles)) return { titles: raw.titles, suhoor: !!raw.suhoor };
    return { titles: [], suhoor: false };
  }

  function seedHabitLogsIfEmpty() {
    if (Object.keys(habitLogs).length > 0) return;
    const today = new Date();
    for (let ago = 28; ago >= 1; ago -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - ago);
      const seed = (d.getDate() * 13 + d.getMonth() * 7 + ago) % 100;
      if (seed > 55 && ago > 12) continue;
      const solid = ago <= 10 || seed < 35;
      const n = solid ? Math.max(2, Math.ceil(habits.length * 0.8)) : 1 + (seed % 2);
      const titles = [];
      for (let i = 0; i < n && i < habits.length; i += 1) titles.push(habits[i].title);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const suhoor = titles.some((t) => {
        const h = habits.find((x) => x.title === t);
        return h && h.intervalCode === "suhoor";
      });
      habitLogs[key] = { titles, suhoor };
    }
    syncTodayHabitLog();
    saveHabitLogs();
  }

  function syncTodayHabitLog() {
    const tk = todayKey();
    const done = habits.filter((h) => h.doneToday);
    if (!done.length) {
      delete habitLogs[tk];
    } else {
      habitLogs[tk] = {
        titles: done.map((h) => h.title),
        suhoor: done.some((h) => h.intervalCode === "suhoor"),
      };
    }
    saveHabitLogs();
  }

  /** Continuous check-in streak ending today/yesterday; gap resets to 0. Cap 40. */
  function calcHabitStreak(habitTitle) {
    let streak = 0;
    const cursor = new Date();
    const today = todayKey();
    const todayEntry = normalizeLogEntry(habitLogs[today] || []);
    if (!todayEntry.titles.includes(habitTitle)) {
      cursor.setDate(cursor.getDate() - 1);
    }
    for (let i = 0; i < STREAK_GOAL; i += 1) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const entry = normalizeLogEntry(habitLogs[key] || []);
      if (!entry.titles.includes(habitTitle)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function refreshHabitStreaks() {
    habits.forEach((h) => {
      h.streak = calcHabitStreak(h.title);
    });
  }

  function xpToAdvance(level) {
    const L = Math.max(1, level);
    return Math.round(36 * Math.pow(L, 1.62) + 22 * L);
  }

  function levelFromTotalXp(totalXp) {
    let remaining = Math.max(0, Math.floor(totalXp));
    let level = 1;
    for (;;) {
      const need = xpToAdvance(level);
      if (remaining < need) return { level, xpIntoLevel: remaining, xpForNextLevel: need };
      remaining -= need;
      level += 1;
      if (level > 99) return { level: 99, xpIntoLevel: remaining, xpForNextLevel: xpToAdvance(99) };
    }
  }

  function levelTitle(level, unlocked) {
    if (unlocked || level >= 25) return "Праведный сон";
    if (level >= 18) return "Хранитель ночи";
    if (level >= 12) return "Мастер дня";
    if (level >= 8) return "Праведник";
    if (level >= 5) return "Хранитель";
    if (level >= 3) return "Странник";
    return "Ученик";
  }

  function streakFromDates(sortedAsc, today) {
    if (!sortedAsc.length) return { current: 0, best: 0 };
    let best = 1;
    let cur = 1;
    for (let i = 1; i < sortedAsc.length; i += 1) {
      const diff = Math.round((new Date(sortedAsc[i]) - new Date(sortedAsc[i - 1])) / 86400000);
      if (diff === 1) {
        cur += 1;
        best = Math.max(best, cur);
      } else cur = 1;
    }
    best = Math.max(best, cur);
    const set = new Set(sortedAsc);
    let current = 0;
    let cursor = new Date(today);
    if (!set.has(today)) cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 400; i += 1) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      if (!set.has(key)) break;
      current += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { current, best };
  }

  function honorFromBestStreak(best) {
    let honor = 0;
    [
      [7, 5],
      [14, 8],
      [21, 12],
      [30, 18],
      [40, 40],
    ].forEach(([at, h]) => {
      if (best >= at) honor += h;
    });
    return honor;
  }

  function computeRpgProfile() {
    seedHabitLogsIfEmpty();
    const today = todayKey();
    const weightTotal = Math.max(
      1,
      habits.reduce((s, h) => s + habitLevelMeta(h).xpWeight, 0)
    );
    const fullMiss = Math.round(
      habits.reduce((s, h) => s + MISS_UNIT * habitLevelMeta(h).missWeight, 0)
    );
    const byDate = {};
    Object.keys(habitLogs).forEach((date) => {
      const entry = normalizeLogEntry(habitLogs[date]);
      if (!entry.titles.length) return;
      const doneHabits = entry.titles
        .map((t) => habits.find((h) => h.title === t))
        .filter(Boolean);
      const titles = new Set(entry.titles);
      let weightedDone = 0;
      let xpEarned = 0;
      let honorFromLevels = 0;
      doneHabits.forEach((h) => {
        const m = habitLevelMeta(h);
        weightedDone += m.xpWeight;
        xpEarned += Math.round(XP_BASE * m.xpWeight);
        honorFromLevels += m.honorBonus;
      });
      byDate[date] = {
        titles,
        count: doneHabits.length || entry.titles.length,
        weightedDone,
        xpEarned,
        honorFromLevels,
        suhoorDone:
          entry.suhoor ||
          doneHabits.some((h) => h.intervalCode === "suhoor"),
      };
    });
    const activeDates = Object.keys(byDate).sort();
    const firstDate = activeDates[0] || today;
    let totalXp = 0;
    let honor = 0;
    const righteousDates = [];

    const start = new Date(firstDate);
    const end = new Date(today);
    const lookback = new Date(end);
    lookback.setDate(lookback.getDate() - 120);
    let cursor = start < lookback ? lookback : start;
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const day = byDate[key];
      const isPast = key < today;
      if (day && day.count > 0) {
        const ratio = day.weightedDone / weightTotal;
        totalXp += day.xpEarned + Math.min(12, Math.floor(day.count * 1.2));
        if (ratio >= 0.75) totalXp += XP_DAY_SOLID;
        else if (isPast && ratio < 0.4) {
          habits.forEach((h) => {
            if (!day.titles.has(h.title)) {
              totalXp -= Math.round(MISS_UNIT * habitLevelMeta(h).missWeight * 0.45);
            }
          });
        }
        honor += 1 + day.honorFromLevels;
        if (ratio >= 0.75 && (day.suhoorDone || habits.length <= 2)) {
          righteousDates.push(key);
          honor += 3;
          totalXp += 15;
        }
      } else if (isPast && activeDates.length && key >= firstDate && habits.length) {
        totalXp -= fullMiss;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    totalXp = Math.max(0, totalXp);
    const { current: currentStreak, best: bestStreak } = streakFromDates(activeDates, today);
    honor += honorFromBestStreak(Math.min(bestStreak, RIGHTEOUS_GOAL));
    const { best: righteousBest } = streakFromDates(righteousDates, today);
    const capped = Math.min(righteousBest, RIGHTEOUS_GOAL);
    const unlocked = capped >= RIGHTEOUS_GOAL;
    if (unlocked) honor += 25;
    const { level, xpIntoLevel, xpForNextLevel } = levelFromTotalXp(totalXp);
    const todayDay = byDate[today];
    return {
      level,
      xpIntoLevel,
      xpForNextLevel,
      progressRatio: xpForNextLevel ? xpIntoLevel / xpForNextLevel : 0,
      honor,
      currentStreak: Math.min(currentStreak, RIGHTEOUS_GOAL),
      bestStreak: Math.min(bestStreak, RIGHTEOUS_GOAL),
      righteousBest: capped,
      righteousGoal: RIGHTEOUS_GOAL,
      righteousRatio: capped / RIGHTEOUS_GOAL,
      righteousUnlocked: unlocked,
      todayXpPreview:
        (todayDay?.xpEarned || 0) +
        ((todayDay?.weightedDone || 0) / weightTotal >= 0.75 ? XP_DAY_SOLID : 0),
      title: levelTitle(level, unlocked),
      subtitle: unlocked
        ? "Цикл дня закрыт · трофей открыт"
        : `До праведного сна · ${capped}/${RIGHTEOUS_GOAL} дн.`,
    };
  }

  function renderRpgHeader(p) {
    const xpPct = Math.max(4, Math.min(100, Math.round(p.progressRatio * 100)));
    const sleepPct = Math.max(4, Math.min(100, Math.round(p.righteousRatio * 100)));
    return `
      <section class="rpg-card">
        <div class="rpg-top">
          <div class="rpg-level"><strong>${p.level}</strong><span>ур.</span></div>
          <div class="rpg-meta">
            <h3>${escapeHtml(p.title)}</h3>
            <p>${escapeHtml(p.subtitle)}</p>
          </div>
          <div class="rpg-honor"><span class="rpg-honor-icon">✦</span><strong>${p.honor}</strong><span>честь</span></div>
        </div>
        <div class="rpg-bar">
          <div class="rpg-bar-labels"><span>Опыт</span><span>${p.xpIntoLevel} / ${p.xpForNextLevel} XP</span></div>
          <div class="rpg-track"><i style="width:${xpPct}%"></i></div>
        </div>
        <div class="rpg-bar">
          <div class="rpg-bar-labels"><span>Праведный сон</span><span>${p.righteousBest}/${p.righteousGoal}${p.righteousUnlocked ? " · открыто" : ""}</span></div>
          <div class="rpg-track rpg-track-sleep"><i style="width:${sleepPct}%"></i></div>
          <p class="rpg-hint">Сухур + 75% дня · Сон до 22:00 · стрик до ${p.righteousGoal} дн.</p>
        </div>
        <div class="rpg-stats">
          <div><strong>${p.currentStreak}</strong><span>серия</span></div>
          <div><strong>${p.bestStreak}</strong><span>рекорд</span></div>
          <div><strong>+${p.todayXpPreview}</strong><span>XP сегодня</span></div>
        </div>
      </section>`;
  }

  function renderHabits() {
    const done = habits.filter((h) => h.doneToday).length;
    const rpg = computeRpgProfile();
    return `
      <h2 class="brand">Привычки</h2>
      <p class="muted">Сегодня ${done}/${habits.length} · XP, уровни и праведный сон</p>
      ${renderRpgHeader(rpg)}
      ${
        habits.length
          ? `<button type="button" class="habit-add-btn" id="habitAddBtn">+ Новая привычка</button>
             <div class="habit-grid">${habits.map((h) => habitCardHtml(h)).join("")}</div>`
          : emptyStateHtml({
              icon: "🕌",
              title: "Пока нет привычек",
              text: "Соберите дневной ритуал — от Сухура до праведного сна",
              cta: "Добавить первую привычку",
              ctaId: "habitAddBtn",
            })
      }
    `;
  }

  const HABIT_COLORS = {
    taxorat: "#B85C38",
    taxajud: "#2A3A5C",
    nafisbot: "#1F6B54",
    tilovat: "#C47B2D",
    jamoat: "#2F6F8F",
    ishroq: "#D4A017",
    qiroat: "#4A5D4E",
    zeekr: "#8B4D6B",
  };

  const state = {
    tab: "day",
    theme: localStorage.getItem("dayline-theme") || "light",
    source: localStorage.getItem("dayline-source") || "mock",
    selectedBlock: null,
    liveTimeline: null,
    tick: 0,
    editingTaskId: null,
    editDraft: null,
    editingHabitId: null,
    habitDraft: null,
    taskFilter: "all",
    taskScope: localStorage.getItem("dayline-task-scope") || "today",
  };

  const els = {
    body: document.getElementById("appBody"),
    clock: document.getElementById("clock"),
    themeToggle: document.getElementById("themeToggle"),
    sourceToggle: document.getElementById("sourceToggle"),
    apiNote: document.getElementById("apiNote"),
    taskModal: document.getElementById("taskModal"),
    taskEditTitle: document.getElementById("taskEditTitle"),
    taskEditNotes: document.getElementById("taskEditNotes"),
    taskEditDate: document.getElementById("taskEditDate"),
    taskEditTime: document.getElementById("taskEditTime"),
    taskEditPriority: document.getElementById("taskEditPriority"),
    taskEditBlock: document.getElementById("taskEditBlock"),
    taskEditType: document.getElementById("taskEditType"),
    taskEditVector: document.getElementById("taskEditVector"),
    taskEditSubtasks: document.getElementById("taskEditSubtasks"),
    taskEditSubInput: document.getElementById("taskEditSubInput"),
    taskModalDelete: document.getElementById("taskModalDelete"),
    habitModal: document.getElementById("habitModal"),
    habitEditTitle: document.getElementById("habitEditTitle"),
    habitEditNotes: document.getElementById("habitEditNotes"),
    habitEditBlock: document.getElementById("habitEditBlock"),
    habitEditTiming: document.getElementById("habitEditTiming"),
    habitEditLevel: document.getElementById("habitEditLevel"),
    habitEditVector: document.getElementById("habitEditVector"),
    habitModalDelete: document.getElementById("habitModalDelete"),
    habitIconPick: document.getElementById("habitIconPick"),
    habitIconPreview: document.getElementById("habitIconPreview"),
    habitIconSheet: document.getElementById("habitIconSheet"),
    habitIconCats: document.getElementById("habitIconCats"),
    habitIconGrid: document.getElementById("habitIconGrid"),
  };

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    els.themeToggle.textContent = state.theme === "dark" ? "Светлая тема" : "Тёмная тема";
    els.themeToggle.setAttribute("aria-pressed", String(state.theme === "dark"));
  }

  function applySourceChip() {
    const live = state.source === "live";
    els.sourceToggle.dataset.source = state.source;
    els.sourceToggle.textContent = live ? "Источник: Live API" : "Источник: Mock";
    els.sourceToggle.classList.toggle("chip-accent", !live);
    els.apiNote.textContent = live
      ? isLocal
        ? "Live · http://127.0.0.1:8001/api/day-timeline"
        : "Live · /api/day-timeline (Cloud Run)"
      : "Mock-режим · API не обязателен";
  }

  function nowHm() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function toMinutes(hm) {
    const [h, m] = hm.slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  }

  function detectCurrentBlock(hm = nowHm()) {
    const t = toMinutes(hm);
    for (const b of BLOCKS) {
      const start = toMinutes(b.start);
      const end = toMinutes(b.end);
      if (b.wraps || b.code === "son") {
        if (t >= start || t < end) return b.code;
        continue;
      }
      if (b.code === "xufton") {
        if (t >= start && t < end) return b.code;
        continue;
      }
      if (t >= start && t < end) return b.code;
    }
    return "son";
  }

  function nextPrayer(hm = nowHm()) {
    const t = toMinutes(hm);
    for (const p of PRAYERS) {
      const pt = toMinutes(p.time);
      if (t < pt) {
        return { ...p, minutes: pt - t };
      }
    }
    const fajr = toMinutes(PRAYERS[0].time) + 24 * 60;
    return { ...PRAYERS[0], label: "Бомдод (завтра)", minutes: fajr - t };
  }

  function formatCountdown(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
  }

  function activeBlockCode() {
    return state.selectedBlock || detectCurrentBlock();
  }

  function blockMeta(code) {
    return BLOCKS.find((b) => b.code === code) || BLOCKS[2];
  }

  function isTaskForToday(t) {
    return !t.date || t.date === todayKey();
  }

  function tasksFor(code) {
    return tasks.filter(
      (t) => isTaskForToday(t) && t.intervalCode === code
    );
  }

  function habitsFor(code) {
    return habits.filter((h) => h.intervalCode === code);
  }

  function blockProgress(code) {
    return taskStatsFor(code).rate;
  }

  function timeProgress(block, hm = nowHm()) {
    const start = toMinutes(block.start);
    const end = toMinutes(block.end);
    const now = toMinutes(hm);
    if (block.wraps || block.code === "son" || start > end) {
      const duration = 24 * 60 - start + end;
      if (duration <= 0) return 0;
      let elapsed = 0;
      if (now >= start) elapsed = now - start;
      else if (now < end) elapsed = 24 * 60 - start + now;
      else return 1;
      return Math.max(0, Math.min(1, elapsed / duration));
    }
    const duration = end - start;
    if (duration <= 0) return 0;
    if (now <= start) return 0;
    if (now >= end) return 1;
    return (now - start) / duration;
  }

  function taskStatsFor(code) {
    const ts = tasksFor(code);
    const hs = habitsFor(code);
    const total = ts.length + hs.length;
    if (!total) return { rate: 1, done: 0, total: 0, label: "Задачи: нет элементов" };
    const done = ts.filter((t) => t.done).length + hs.filter((h) => h.doneToday).length;
    const rate = done / total;
    return {
      rate,
      done,
      total,
      label: `Задачи: ${done} из ${total} (${Math.round(rate * 100)}%)`,
    };
  }

  function habitCardHtml(h) {
    const win =
      h.windowStart && h.windowEnd
        ? `${String(h.windowStart).slice(0, 5)}–${String(h.windowEnd).slice(0, 5)}`
        : "";
    const hint = h.timingHint || "";
    const vec = HABIT_VECTOR_META[h.vector || "spiritual"]?.icon || "";
    const lvl = habitLevelMeta(h);
    const streak = Math.min(Math.max(0, Number(h.streak) || 0), STREAK_GOAL);
    const maxed = streak >= STREAK_GOAL;
    const pct = Math.max(4, Math.round((streak / STREAK_GOAL) * 100));
    const meta = [lvl.short, vec, hint, win].filter(Boolean).join(" · ");
    const active = h.isActiveWindow ? " is-window" : "";
    const maxedCls = maxed ? " is-streak-max" : "";
    return `
      <div class="habit ${h.doneToday ? "is-done" : ""}${active}${maxedCls}" style="--habit:${h.color}">
        <button type="button" class="habit-main" data-open-habit="${h.id}">
          <div class="habit-card-top">
            <div class="habit-dot" style="background:${h.color}">${h.icon || h.title.slice(0, 1)}</div>
            <span class="habit-badges">
              ${maxed ? `<span class="habit-crown" title="Серия 40/40">👑</span>` : ""}
              <span class="habit-level" title="${lvl.label}">${lvl.icon}</span>
            </span>
          </div>
          <p class="habit-title">${escapeHtml(h.title)}</p>
          ${meta ? `<p class="habit-meta">${escapeHtml(meta)}</p>` : ""}
          <div class="habit-streak-block">
            <div class="habit-streak-labels">
              <span class="${maxed ? "is-max" : ""}">${maxed ? "👑 Максимум" : "Стрик"}</span>
              <span class="${maxed ? "is-max" : ""}">${streak} / ${STREAK_GOAL}</span>
            </div>
            <div class="habit-streak-track"><i style="width:${pct}%;background:${maxed ? "#C47B2D" : h.color}"></i></div>
          </div>
        </button>
        <button type="button" class="habit-cta" data-habit="${h.id}">${h.doneToday ? "Готово" : "Отметить"}</button>
      </div>`;
  }

  function toast(msg) {
    let node = document.querySelector(".toast");
    if (!node) {
      node = document.createElement("div");
      node.className = "toast";
      document.querySelector(".phone-screen").appendChild(node);
    }
    node.textContent = msg;
    node.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => node.classList.remove("show"), 1600);
  }

  function blockStatus(code, nowCode, hm = nowHm()) {
    if (code === nowCode) return "current";
    const nowMin = toMinutes(hm);
    if (nowCode === "son") return nowMin >= toMinutes("22:00") ? "past" : "future";
    const nowIdx = VISUAL_ORDER.indexOf(nowCode);
    const idx = VISUAL_ORDER.indexOf(code);
    if (nowIdx < 0 || idx < 0) return "future";
    return idx < nowIdx ? "past" : "future";
  }

  function getBlockStyle(block) {
    const status = block.status;
    const rate = block.completionRate;
    if (status === "current") return "tone-current";
    if (status === "past" && rate >= 1) return "tone-past-done";
    if (status === "past") return "tone-past-open";
    return "tone-future";
  }

  function renderBlockChips(selectedCode) {
    const nowCode = state.liveTimeline?.current_interval?.code || detectCurrentBlock();
    return `
      <div class="block-scroll" role="tablist" aria-label="Намазные блоки">
        ${BLOCKS.map((b) => {
          const status = blockStatus(b.code, nowCode);
          const rate = blockProgress(b.code);
          const tone = getBlockStyle({ status, completionRate: rate, code: b.code });
          const selected = b.code === selectedCode;
          return `
          <button type="button" class="block-chip ${tone} ${selected ? "is-selected" : ""}" data-block="${b.code}" data-status="${status}">
            <span>${b.short}</span>
            ${status === "current" ? `<i class="chip-bar" style="width:${Math.round(rate * 100)}%"></i>` : ""}
          </button>`;
        }).join("")}
      </div>`;
  }

  function renderDay() {
    const code = activeBlockCode();
    const block = blockMeta(code);
    const nxt = state.liveTimeline?.next_prayer
      ? {
          label: state.liveTimeline.next_prayer.label,
          time: String(state.liveTimeline.next_prayer.time).slice(0, 5),
          minutes: state.liveTimeline.next_prayer.minutes_remaining,
        }
      : nextPrayer();
    const progress = Math.round(blockProgress(code) * 100);
    const timePct = Math.round(timeProgress(block) * 100);
    const tasksInfo = taskStatsFor(code);
    const nowCode = state.liveTimeline?.current_interval?.code || detectCurrentBlock();
    const heroTone = getBlockStyle({
      status: blockStatus(code, nowCode),
      completionRate: tasksInfo.rate,
    });
    const ts = tasksFor(code);
    const hs = habitsFor(code);

    return `
      <div class="brand-row">
        <h2 class="brand">Dayline</h2>
        <span class="muted" style="margin:0">${nowHm()}</span>
      </div>
      <p class="muted">Toshkent · namozvaqti</p>

      <section class="hero ${heroTone}">
        <p class="hero-label">Текущее окно</p>
        <h3 class="hero-title">${block.label}</h3>
        <p class="hero-count">${
          block.wraps || block.code === "son"
            ? `${block.start} → ${block.end} (через полночь)`
            : `${block.start}–${block.end}`
        }</p>
        <p class="hero-count" style="margin-top:10px;font-size:0.82rem">
          Следующий: ${nxt.label} · ${nxt.time} · через ${formatCountdown(nxt.minutes)}
        </p>

        <p class="bar-caption">Время блока: ${timePct}%</p>
        <div class="progress progress-time" aria-label="Прогресс времени">
          <i style="width:${timePct}%"></i>
        </div>

        <p class="bar-caption">${tasksInfo.label}</p>
        <div class="progress progress-tasks" aria-label="Прогресс задач">
          <i style="width:${Math.round(tasksInfo.rate * 100)}%"></i>
        </div>
      </section>

      ${renderBlockChips(code)}

      <h3 class="section">Привычки окна</h3>
      ${
        hs.length
          ? `<div class="habit-grid">${hs.map((h) => habitCardHtml(h)).join("")}</div>`
          : emptyStateHtml({
              icon: "🌱",
              title: "Нет привычек в этом блоке",
              text: "Добавьте привычку с привязкой к намазному окну",
            })
      }

      <h3 class="section">Задачи окна</h3>
      ${
        ts.length
          ? ts
              .map(
                (t) => `
          <article class="card ${t.done ? "is-done" : ""}" data-task="${t.id}">
            <button type="button" class="check ${t.done ? "is-on" : ""}" data-toggle-task="${t.id}" aria-label="Выполнить"></button>
            <div class="card-body" data-open-task="${t.id}">
              <p class="card-title">${escapeHtml(t.title)}</p>
              <p class="card-meta">${taskMetaChips(t)} · ${formatCardWhen(t)} · ${block.short}${(t.subtasks || []).length ? ` · ${(t.subtasks || []).filter((s) => s.completed).length}/${t.subtasks.length}` : ""}</p>
            </div>
          </article>`
              )
              .join("")
          : emptyStateHtml({
              icon: "✓",
              title: "Окно чистое",
              text: "Всё сделано — или добавьте задачу в этот блок",
              cta: "Добавить задачу",
              ctaId: "emptyAddTask",
            })
      }

      <div class="composer">
        <input id="quickTask" placeholder="Быстрая задача в этот блок…" maxlength="80">
        <button type="button" id="quickAdd">+</button>
      </div>
    `;
  }

  function renderTasks() {
    const filter = state.taskFilter || "all";
    const scope = state.taskScope || "today";
    const scoped = scope === "today" ? tasks.filter(isTaskForToday) : tasks.slice();
    const list =
      filter === "all" ? scoped : scoped.filter((t) => t.intervalCode === filter);
    const open = list.filter((t) => !t.done);
    const done = list.filter((t) => t.done);

    return `
      <h2 class="brand">Задачи</h2>
      <p class="muted">На сегодня или весь список · блок · приоритет</p>
      <div class="scope-row" role="tablist" aria-label="Область задач">
        <button type="button" class="scope-btn ${scope === "today" ? "is-on" : ""}" data-task-scope="today">На сегодня</button>
        <button type="button" class="scope-btn ${scope === "all" ? "is-on" : ""}" data-task-scope="all">Все задачи</button>
      </div>
      <div class="filter-row">
        <button type="button" class="block-chip ${filter === "all" ? "is-selected tone-current" : "tone-future"}" data-task-filter="all">Все блоки</button>
        ${BLOCKS.map(
          (b) =>
            `        <button type="button" class="block-chip ${
          filter === b.code ? "is-selected tone-current" : "tone-future"
        }" data-task-filter="${b.code}">${b.short}</button>`
        ).join("")}
      </div>
      <div class="composer">
        <input id="newTaskTitle" placeholder="Что нужно сделать?" maxlength="80">
        <button type="button" id="newTaskBtn">Добавить</button>
      </div>
      <h3 class="section">Открытые · ${open.length}</h3>
      ${
        open.length
          ? open.map((t) => taskCard(t)).join("")
          : emptyStateHtml({
              icon: "📝",
              title: scope === "today" ? "На сегодня задач нет" : "Список пуст",
              text: "Сформулируйте первую задачу — и день станет яснее",
              cta: "Добавить первую задачу",
              ctaId: "emptyAddTask",
            })
      }
      ${
        done.length
          ? `<h3 class="section">Готово · ${done.length}</h3>${done.map((t) => taskCard(t)).join("")}`
          : ""
      }
    `;
  }

  function taskCard(t) {
    const block = blockMeta(t.intervalCode);
    const subDone = (t.subtasks || []).filter((s) => s.completed).length;
    const subTotal = (t.subtasks || []).length;
    const subMeta = subTotal ? ` · ${subDone}/${subTotal}` : "";
    return `
      <article class="card ${t.done ? "is-done" : ""}" data-task="${t.id}">
        <button type="button" class="check ${t.done ? "is-on" : ""}" data-toggle-task="${t.id}"></button>
        <div class="card-body" data-open-task="${t.id}">
          <p class="card-title">${escapeHtml(t.title)}</p>
          <p class="card-meta">
            ${taskMetaChips(t)}
            · ${formatCardWhen(t)} · ${block.label}${subMeta}
          </p>
        </div>
      </article>`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    els.clock.textContent = nowHm();
    seedHabitLogsIfEmpty();
    refreshHabitStreaks();
    if (state.tab === "day") els.body.innerHTML = renderDay();
    else if (state.tab === "tasks") els.body.innerHTML = renderTasks();
    else els.body.innerHTML = renderHabits();

    // reflow progress bar animation
    requestAnimationFrame(() => {
      const bar = els.body.querySelector(".progress > i");
      if (bar) {
        const w = bar.style.width;
        bar.style.width = "0";
        requestAnimationFrame(() => {
          bar.style.width = w;
        });
      }
    });
  }

  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    toast(task.done ? "Задача закрыта" : "Задача открыта");
    render();
  }

  async function toggleHabit(id) {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;
    const nextDone = !habit.doneToday;
    if (state.source === "live" && habit.trackingId) {
      try {
        const res = await fetch(`${API_BASE}/api/habit-trackings/${habit.trackingId}`, {
          method: "PATCH",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ is_done: nextDone }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        toast(`Не удалось сохранить: ${err.message}`);
        return;
      }
    }
    habit.doneToday = nextDone;
    syncTodayHabitLog();
    refreshHabitStreaks();
    if (nextDone) {
      toast(
        habit.streak >= STREAK_GOAL
          ? `👑 Серия ${STREAK_GOAL}/${STREAK_GOAL}`
          : `Стрик · ${habit.streak} / ${STREAK_GOAL}`
      );
    } else {
      toast(habit.streak > 0 ? `Стрик · ${habit.streak} / ${STREAK_GOAL}` : "Чекин снят · серия сброшена");
    }
    render();
  }

  function addTask(title, intervalCode) {
    const clean = title.trim();
    if (!clean) return;
    tasks.unshift({
      id: Date.now(),
      title: clean,
      notes: "",
      priority: 3,
      intervalCode: intervalCode || activeBlockCode(),
      date: todayKey(),
      time: null,
      type: "task",
      vector: "work",
      done: false,
      subtasks: [],
    });
    toast("Задача добавлена");
    render();
  }

  function openTaskEditor(id, presets = {}) {
    const task = id == null ? null : tasks.find((t) => t.id === id);
    state.editingTaskId = id;
    state.editDraft = task
      ? {
          title: task.title,
          notes: task.notes || "",
          priority: task.priority || 4,
          intervalCode: task.intervalCode,
          date: task.date || todayKey(),
          time: task.time || "",
          type: task.type || "task",
          vector: task.vector || "work",
          subtasks: (task.subtasks || []).map((s) => ({ ...s })),
        }
      : {
          title: presets.title || "",
          notes: "",
          priority: presets.priority || 3,
          intervalCode:
            presets.intervalCode ||
            (state.taskFilter && state.taskFilter !== "all"
              ? state.taskFilter
              : activeBlockCode()),
          date: presets.date || todayKey(),
          time: presets.time || "",
          type: presets.type || "task",
          vector: presets.vector || "work",
          subtasks: [],
        };
    syncTaskEditorUi();
    els.taskModal.hidden = false;
    document.getElementById("taskModalTitle").textContent = task ? "Задача" : "Новая задача";
    els.taskModalDelete.hidden = !task;
    setTimeout(() => els.taskEditTitle.focus(), 50);
  }

  function closeTaskEditor() {
    els.taskModal.hidden = true;
    state.editingTaskId = null;
    state.editDraft = null;
  }

  function syncTaskEditorUi() {
    const d = state.editDraft;
    if (!d) return;
    els.taskEditTitle.value = d.title;
    els.taskEditNotes.value = d.notes;
    els.taskEditDate.value = d.date || todayKey();
    els.taskEditTime.value = d.time ? String(d.time).slice(0, 5) : "";
    els.taskEditPriority.querySelectorAll(".prio-btn").forEach((btn) => {
      btn.classList.toggle("is-on", Number(btn.dataset.prio) === d.priority);
    });
    els.taskEditBlock.innerHTML = BLOCKS.map(
      (b) =>
        `<button type="button" class="${d.intervalCode === b.code ? "is-on" : ""}" data-edit-block="${b.code}">${b.short}</button>`
    ).join("");
    els.taskEditType.querySelectorAll("[data-type]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.type === d.type);
    });
    els.taskEditVector.querySelectorAll("[data-vector]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.vector === d.vector);
    });
    els.taskEditSubtasks.innerHTML = (d.subtasks || [])
      .map(
        (s) => `
      <div class="subtask-row ${s.completed ? "is-done" : ""}" data-sub="${s.id}">
        <button type="button" class="check ${s.completed ? "is-on" : ""}" data-toggle-sub="${s.id}"></button>
        <span>${escapeHtml(s.title)}</span>
        <button type="button" class="sub-del" data-del-sub="${s.id}" aria-label="Удалить">×</button>
      </div>`
      )
      .join("");
  }

  function saveTaskEditor() {
    const d = state.editDraft;
    if (!d) return;
    const title = els.taskEditTitle.value.trim();
    if (!title) {
      toast("Введите название");
      return;
    }
    d.title = title;
    d.notes = els.taskEditNotes.value.trim();
    d.date = els.taskEditDate.value || todayKey();
    d.time = els.taskEditTime.value ? els.taskEditTime.value.slice(0, 5) : null;
    if (state.editingTaskId == null) {
      tasks.unshift({
        id: Date.now(),
        title: d.title,
        notes: d.notes,
        priority: d.priority,
        intervalCode: d.intervalCode,
        date: d.date,
        time: d.time,
        type: d.type || "task",
        vector: d.vector || "work",
        done: false,
        subtasks: d.subtasks,
      });
      toast("Задача создана");
    } else {
      const task = tasks.find((t) => t.id === state.editingTaskId);
      if (task) {
        task.title = d.title;
        task.notes = d.notes;
        task.priority = d.priority;
        task.intervalCode = d.intervalCode;
        task.date = d.date;
        task.time = d.time;
        task.type = d.type || "task";
        task.vector = d.vector || "work";
        task.subtasks = d.subtasks;
      }
      toast("Сохранено");
    }
    closeTaskEditor();
    render();
  }

  function deleteTaskFromEditor() {
    if (state.editingTaskId == null) return;
    if (!confirm("Удалить задачу?")) return;
    tasks = tasks.filter((t) => t.id !== state.editingTaskId);
    closeTaskEditor();
    toast("Задача удалена");
    render();
  }

  function timingKeyFromHabit(h) {
    if (h.timingMode === "first_n" && h.duration === 20) return "first_20";
    if (h.timingMode === "last_n" && h.duration === 20) return "last_20";
    if (h.timingMode === "after_start" && h.startOffset === 15) return "after_15";
    if (h.timingMode === "anytime") return "anytime";
    return "anytime";
  }

  function openHabitEditor(id) {
    const habit = id == null ? null : habits.find((h) => h.id === id);
    state.editingHabitId = id;
    state.habitDraft = habit
      ? {
          title: habit.title,
          description: habit.description || "",
          intervalCode: habit.intervalCode || "suhoor",
          timingKey: timingKeyFromHabit(habit),
          vector: habit.vector || "spiritual",
          level: habitLevelOf(habit),
          color: habit.color,
          icon: habit.icon || "✨",
          iconCat: "spiritual",
        }
      : {
          title: "",
          description: "",
          intervalCode: "suhoor",
          timingKey: "anytime",
          vector: "spiritual",
          level: 3,
          color: "#1F6B54",
          icon: "✨",
          iconCat: "spiritual",
        };
    if (els.habitIconSheet) els.habitIconSheet.hidden = true;
    syncHabitEditorUi();
    els.habitModal.hidden = false;
    document.getElementById("habitModalTitle").textContent = habit ? "Привычка" : "Новая привычка";
    els.habitModalDelete.hidden = !habit;
    setTimeout(() => els.habitEditTitle.focus(), 50);
  }

  function closeHabitEditor() {
    els.habitModal.hidden = true;
    state.editingHabitId = null;
    state.habitDraft = null;
  }

  function syncHabitEditorUi() {
    const d = state.habitDraft;
    if (!d) return;
    els.habitEditTitle.value = d.title;
    els.habitEditNotes.value = d.description;
    if (els.habitIconPreview) els.habitIconPreview.textContent = d.icon || "✨";
    els.habitEditBlock.innerHTML = BLOCKS.map(
      (b) =>
        `<button type="button" class="${d.intervalCode === b.code ? "is-on" : ""}" data-habit-block="${b.code}">${b.short}</button>`
    ).join("");
    els.habitEditTiming.querySelectorAll("[data-timing]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.timing === d.timingKey);
    });
    if (els.habitEditLevel) {
      els.habitEditLevel.querySelectorAll("[data-habit-level]").forEach((btn) => {
        btn.classList.toggle("is-on", Number(btn.dataset.habitLevel) === Number(d.level || 3));
      });
    }
    els.habitEditVector.querySelectorAll("[data-habit-vector]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.habitVector === d.vector);
    });
    if (els.habitIconCats && els.habitIconGrid) {
      els.habitIconCats.innerHTML = HABIT_ICON_CATS.map(
        (c) =>
          `<button type="button" class="${d.iconCat === c.id ? "is-on" : ""}" data-icon-cat="${c.id}">${c.label}</button>`
      ).join("");
      const cat = HABIT_ICON_CATS.find((c) => c.id === d.iconCat) || HABIT_ICON_CATS[0];
      els.habitIconGrid.innerHTML = cat.icons
        .map(
          (emoji) =>
            `<button type="button" class="${d.icon === emoji ? "is-on" : ""}" data-habit-icon="${emoji}">${emoji}</button>`
        )
        .join("");
    }
  }

  function saveHabitEditor() {
    const d = state.habitDraft;
    if (!d) return;
    const title = els.habitEditTitle.value.trim();
    if (!title) {
      toast("Введите название");
      return;
    }
    const timing = HABIT_TIMING[d.timingKey] || HABIT_TIMING.anytime;
    d.title = title;
    d.description = els.habitEditNotes.value.trim();
    if (state.editingHabitId == null) {
      habits.push({
        id: Date.now(),
        slug: title.toLowerCase(),
        title,
        description: d.description,
        icon: d.icon || "✨",
        color: d.color || "#1F6B54",
        intervalCode: d.intervalCode,
        timingMode: timing.mode,
        startOffset: timing.offset,
        duration: timing.duration,
        vector: d.vector,
        level: habitLevelOf(d),
        streak: 0,
        doneToday: false,
        timingHint: timing.hint,
      });
      toast("Привычка создана");
    } else {
      const habit = habits.find((h) => h.id === state.editingHabitId);
      if (habit) {
        habit.title = title;
        habit.description = d.description;
        habit.icon = d.icon || "✨";
        habit.intervalCode = d.intervalCode;
        habit.timingMode = timing.mode;
        habit.startOffset = timing.offset;
        habit.duration = timing.duration;
        habit.vector = d.vector;
        habit.level = habitLevelOf(d);
        habit.timingHint = timing.hint;
      }
      toast("Сохранено");
    }
    closeHabitEditor();
    render();
  }

  function deleteHabitFromEditor() {
    if (state.editingHabitId == null) return;
    if (!confirm("Удалить привычку?")) return;
    habits = habits.filter((h) => h.id !== state.editingHabitId);
    closeHabitEditor();
    toast("Привычка удалена");
    render();
  }

  async function tryLiveTimeline() {
    try {
      const res = await fetch(`${API_BASE}/api/day-timeline?region=toshkent`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.liveTimeline = data;
      if (Array.isArray(data.intervals) && data.intervals.length) {
        data.intervals.forEach((iv) => {
          const local = BLOCKS.find((b) => b.code === iv.code);
          if (!local) return;
          local.start = String(iv.start_time).slice(0, 5);
          local.end = String(iv.end_time).slice(0, 5);
          local.label = iv.label || local.label;
          local.wraps = !!iv.wraps_midnight || iv.code === "son";
        });
        const current = data.intervals.find((i) => i.is_current);
        if (current && !state.selectedBlock) {
          state.selectedBlock = current.code;
        }
        const synced = [];
        data.intervals.forEach((iv) => {
          (iv.habits || []).forEach((h) => {
            const slug = h.slug || h.title;
            synced.push({
              id: h.id,
              trackingId: h.id,
              habitId: h.habit_id,
              slug,
              title: h.title,
              color: HABIT_COLORS[slug] || "#1F6B54",
              intervalCode: iv.code,
              streak: 1,
              doneToday: !!h.is_done,
              timingHint: h.timing_hint || "",
              windowStart: h.window_start,
              windowEnd: h.window_end,
              isActiveWindow: !!h.is_active_window,
            });
          });
        });
        if (synced.length) habits = synced;
      }
      els.apiNote.textContent = `Live OK · кэш: ${data.prayer_times?.cached ? "да" : "нет"}`;
      return true;
    } catch (err) {
      state.liveTimeline = null;
      els.apiNote.textContent = `Live недоступен (${err.message}) · остаёмся на mock`;
      state.source = "mock";
      localStorage.setItem("dayline-source", "mock");
      applySourceChip();
      return false;
    }
  }

  // Events
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      state.tab = btn.dataset.tab;
      render();
    });
  });

  els.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("dayline-theme", state.theme);
    applyTheme();
  });

  els.sourceToggle.addEventListener("click", async () => {
    if (state.source === "mock") {
      state.source = "live";
      localStorage.setItem("dayline-source", "live");
      applySourceChip();
      els.apiNote.textContent = "Подключение к API…";
      await tryLiveTimeline();
      render();
    } else {
      state.source = "mock";
      state.liveTimeline = null;
      localStorage.setItem("dayline-source", "mock");
      applySourceChip();
      render();
    }
  });

  els.body.addEventListener("click", (e) => {
    const blockBtn = e.target.closest("[data-block]");
    if (blockBtn) {
      state.selectedBlock = blockBtn.dataset.block;
      render();
      return;
    }
    const filterBtn = e.target.closest("[data-task-filter]");
    if (filterBtn) {
      state.taskFilter = filterBtn.dataset.taskFilter;
      render();
      return;
    }
    const scopeBtn = e.target.closest("[data-task-scope]");
    if (scopeBtn) {
      state.taskScope = scopeBtn.dataset.taskScope;
      localStorage.setItem("dayline-task-scope", state.taskScope);
      render();
      return;
    }
    const taskBtn = e.target.closest("[data-toggle-task]");
    if (taskBtn) {
      toggleTask(Number(taskBtn.dataset.toggleTask));
      return;
    }
    const openTask = e.target.closest("[data-open-task]");
    if (openTask) {
      openTaskEditor(Number(openTask.dataset.openTask));
      return;
    }
    const openHabit = e.target.closest("[data-open-habit]");
    if (openHabit) {
      openHabitEditor(Number(openHabit.dataset.openHabit));
      return;
    }
    const habitBtn = e.target.closest("[data-habit]");
    if (habitBtn) {
      toggleHabit(Number(habitBtn.dataset.habit));
      return;
    }
    if (e.target.id === "habitAddBtn") {
      openHabitEditor(null);
      return;
    }
    if (e.target.id === "quickAdd") {
      const input = document.getElementById("quickTask");
      const draft = (input?.value || "").trim();
      if (input) input.value = "";
      openTaskEditor(null, {
        title: draft,
        intervalCode: activeBlockCode(),
      });
      return;
    }
    if (e.target.id === "newTaskBtn" || e.target.id === "emptyAddTask") {
      const input = document.getElementById("newTaskTitle");
      const draft = (input?.value || "").trim();
      if (input) input.value = "";
      openTaskEditor(null, {
        title: draft,
        intervalCode:
          state.taskFilter && state.taskFilter !== "all"
            ? state.taskFilter
            : activeBlockCode(),
      });
      return;
    }
  });

  els.body.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (e.target.id === "quickTask") {
      e.preventDefault();
      const draft = e.target.value.trim();
      e.target.value = "";
      openTaskEditor(null, { title: draft, intervalCode: activeBlockCode() });
      return;
    }
    if (e.target.id === "newTaskTitle") {
      e.preventDefault();
      const draft = e.target.value.trim();
      e.target.value = "";
      openTaskEditor(null, {
        title: draft,
        intervalCode:
          state.taskFilter && state.taskFilter !== "all"
            ? state.taskFilter
            : activeBlockCode(),
      });
    }
  });

  document.getElementById("taskModalCancel").addEventListener("click", closeTaskEditor);
  document.getElementById("taskModalSave").addEventListener("click", saveTaskEditor);
  els.taskModalDelete.addEventListener("click", deleteTaskFromEditor);
  document.getElementById("taskEditClearTime").addEventListener("click", () => {
    if (!state.editDraft) return;
    els.taskEditTime.value = "";
    state.editDraft.time = "";
  });
  els.taskEditDate.addEventListener("change", () => {
    if (!state.editDraft) return;
    state.editDraft.date = els.taskEditDate.value || todayKey();
  });
  els.taskEditTime.addEventListener("change", () => {
    if (!state.editDraft) return;
    state.editDraft.time = els.taskEditTime.value || "";
  });
  els.taskModal.addEventListener("click", (e) => {
    if (e.target === els.taskModal) closeTaskEditor();
  });
  els.taskEditPriority.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-prio]");
    if (!btn || !state.editDraft) return;
    state.editDraft.priority = Number(btn.dataset.prio);
    syncTaskEditorUi();
  });
  els.taskEditBlock.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-edit-block]");
    if (!btn || !state.editDraft) return;
    state.editDraft.intervalCode = btn.dataset.editBlock;
    syncTaskEditorUi();
  });
  els.taskEditType.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-type]");
    if (!btn || !state.editDraft) return;
    state.editDraft.type = btn.dataset.type;
    syncTaskEditorUi();
  });
  els.taskEditVector.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-vector]");
    if (!btn || !state.editDraft) return;
    state.editDraft.vector = btn.dataset.vector;
    syncTaskEditorUi();
  });
  els.taskEditSubtasks.addEventListener("click", (e) => {
    if (!state.editDraft) return;
    const toggle = e.target.closest("[data-toggle-sub]");
    if (toggle) {
      const id = toggle.dataset.toggleSub;
      state.editDraft.subtasks = state.editDraft.subtasks.map((s) =>
        s.id === id ? { ...s, completed: !s.completed } : s
      );
      syncTaskEditorUi();
      return;
    }
    const del = e.target.closest("[data-del-sub]");
    if (del) {
      const id = del.dataset.delSub;
      state.editDraft.subtasks = state.editDraft.subtasks.filter((s) => s.id !== id);
      syncTaskEditorUi();
    }
  });
  document.getElementById("taskEditSubAdd").addEventListener("click", () => {
    if (!state.editDraft) return;
    const title = els.taskEditSubInput.value.trim();
    if (!title) return;
    state.editDraft.subtasks.push({
      id: `st-${Date.now()}`,
      title,
      completed: false,
    });
    els.taskEditSubInput.value = "";
    syncTaskEditorUi();
  });
  els.taskEditSubInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("taskEditSubAdd").click();
    }
  });

  document.getElementById("habitModalCancel").addEventListener("click", closeHabitEditor);
  document.getElementById("habitModalSave").addEventListener("click", saveHabitEditor);
  els.habitModalDelete.addEventListener("click", deleteHabitFromEditor);
  els.habitModal.addEventListener("click", (e) => {
    if (e.target === els.habitModal) closeHabitEditor();
  });
  els.habitEditBlock.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-habit-block]");
    if (!btn || !state.habitDraft) return;
    state.habitDraft.intervalCode = btn.dataset.habitBlock;
    syncHabitEditorUi();
  });
  els.habitEditTiming.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-timing]");
    if (!btn || !state.habitDraft) return;
    state.habitDraft.timingKey = btn.dataset.timing;
    syncHabitEditorUi();
  });
  els.habitEditLevel?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-habit-level]");
    if (!btn || !state.habitDraft) return;
    state.habitDraft.level = Number(btn.dataset.habitLevel) || 3;
    syncHabitEditorUi();
  });
  els.habitEditVector.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-habit-vector]");
    if (!btn || !state.habitDraft) return;
    state.habitDraft.vector = btn.dataset.habitVector;
    syncHabitEditorUi();
  });
  els.habitIconPick?.addEventListener("click", () => {
    if (!els.habitIconSheet) return;
    els.habitIconSheet.hidden = !els.habitIconSheet.hidden;
    if (!els.habitIconSheet.hidden) syncHabitEditorUi();
  });
  els.habitIconCats?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-icon-cat]");
    if (!btn || !state.habitDraft) return;
    state.habitDraft.iconCat = btn.dataset.iconCat;
    syncHabitEditorUi();
  });
  els.habitIconGrid?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-habit-icon]");
    if (!btn || !state.habitDraft) return;
    state.habitDraft.icon = btn.dataset.habitIcon;
    if (els.habitIconPreview) els.habitIconPreview.textContent = state.habitDraft.icon;
    if (els.habitIconSheet) els.habitIconSheet.hidden = true;
    syncHabitEditorUi();
  });

  // Init
  state.selectedBlock = detectCurrentBlock();
  applyTheme();
  applySourceChip();
  render();

  setInterval(() => {
    state.tick += 1;
    els.clock.textContent = nowHm();
    if (state.tab === "day" && state.tick % 30 === 0) render();
  }, 1000);

  if (state.source === "live") {
    tryLiveTimeline().then(() => render());
  }
})();
