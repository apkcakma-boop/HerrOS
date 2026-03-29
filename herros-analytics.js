// ══════════════════════════════════════════════════════════════════
//  HerrOS — Google Analytics 4 TAM İzləmə Sistemi  v2.0
// ══════════════════════════════════════════════════════════════════
//
//  QURAŞDIRMA:
//  1. analytics.google.com → Yeni GA4 "Web" mülkü yarat
//  2. "G-XXXXXXXXXX" formatındakı Measurement ID-ni aşağıya yaz
//  3. HerrOS HTML-nin </head> etiketindən BİRBAŞA ƏVVƏL yapışdır:
//       <script src="herros-analytics.js"></script>
//
//  İZLƏNƏN HƏR ŞEY:
//  ✅ Hər bölmədə keçirilən vaxt (saniyə dəqiqliyi)
//  ✅ Gündəlik ümumi aktiv vaxt (localStorage + GA4)
//  ✅ Haradan gəldiyi (direct, PWA, bookmark, Telegram, Google...)
//  ✅ Cihaz növü (mobil/tablet/desktop/PWA), OS, brauzer
//  ✅ Bütün bölmə ziyarətləri
//  ✅ Hər hərəkət (todo, maliyyə, kitab, oyun, vərdiş...)
//  ✅ Scroll dərinliyi (hər bölmə üçün ayrıca)
//  ✅ Session müddəti (başlanğıc → bağlanış)
//  ✅ İlk ziyarət vs. qayıdan istifadəçi
//  ✅ Gün/saat heatmap üçün timestamp
//  ✅ Əvvəlki günün xülaməsi (sabah göndərilir)
// ══════════════════════════════════════════════════════════════════

const MEASUREMENT_ID = 'G-XXXXXXXXXX'; // ← ÖZ GA4 ID'NİZİ YAZIN

// ── GA4 Script yüklə ────────────────────────────────────────────
(function () {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID, {
    send_page_view: false,
    anonymize_ip: true,
  });
})();

// ── Mərkəzi event göndərici ──────────────────────────────────────
function gaEvent(name, params) {
  if (typeof gtag !== 'function') return;
  gtag('event', name, Object.assign({
    app_name:        'HerrOS',
    app_version:     '4.0',
    hour_of_day:     new Date().getHours(),     // 0–23  (hansı saatda istifadə edir?)
    day_of_week:     new Date().getDay(),        // 0=Bazar … 6=Şənbə
  }, params || {}));
}

// ══════════════════════════════════════════════════════════════════
//  MODUL A — TRAFFİK MƏNBƏYİ
//  GA4-də "traffic_source" custom dimensionunda görünəcək
// ══════════════════════════════════════════════════════════════════
const _src = (function () {
  const ref = document.referrer;
  const ua  = navigator.userAgent;

  // PWA olaraq açılıb?
  const isPWA = window.matchMedia('(display-mode: standalone)').matches
             || window.navigator.standalone === true;

  // Cihaz növü
  const mob   = /Mobi|Android/i.test(ua);
  const tab   = /iPad|Tablet/i.test(ua) || (mob && Math.min(screen.width, screen.height) >= 600);
  const device = isPWA ? 'pwa' : tab ? 'tablet' : mob ? 'mobile' : 'desktop';

  // Əməliyyat sistemi
  let os = 'other';
  if (/Windows/i.test(ua))          os = 'windows';
  else if (/Android/i.test(ua))     os = 'android';
  else if (/iPhone|iPad/i.test(ua)) os = 'ios';
  else if (/Mac OS X/i.test(ua))    os = 'macos';
  else if (/Linux/i.test(ua))       os = 'linux';

  // Brauzer
  let browser = 'other';
  if (/Edg\//i.test(ua))        browser = 'edge';
  else if (/OPR\//i.test(ua))   browser = 'opera';
  else if (/Chrome/i.test(ua))  browser = 'chrome';
  else if (/Firefox/i.test(ua)) browser = 'firefox';
  else if (/Safari/i.test(ua))  browser = 'safari';

  // Giriş mənbəyi
  let source = 'direct';
  if (isPWA)                                    source = 'pwa';
  else if (!ref || ref.includes(location.hostname)) source = 'direct';
  else if (/google\./i.test(ref))               source = 'google';
  else if (/t\.me|telegram/i.test(ref))         source = 'telegram';
  else if (/whatsapp/i.test(ref))               source = 'whatsapp';
  else if (/instagram/i.test(ref))              source = 'instagram';
  else if (/twitter|x\.com/i.test(ref))         source = 'twitter';
  else if (/facebook/i.test(ref))               source = 'facebook';
  else                                          source = 'external_link';

  // İlk ziyarət yoxsa qayıdan?
  const visits = parseInt(localStorage.getItem('_ha_vc') || '0') + 1;
  localStorage.setItem('_ha_vc', visits);
  const userType = visits === 1 ? 'new_user' : 'returning_user';

  // Ekran ölçüsü qrupu
  const w = screen.width;
  const scr = w < 360 ? 'xs' : w < 480 ? 'sm' : w < 768 ? 'md' : w < 1024 ? 'lg' : 'xl';

  return { source, device, os, browser, userType, visits, scr, isPWA };
})();

// ══════════════════════════════════════════════════════════════════
//  MODUL B — GÜNDƏLİK AKTİV VAXT
//  - Hər saniyə localStorage-a yazır
//  - Hər 5 dəqiqədə GA4-ə göndərir
//  - Tab gizlənəndə avtomatik dayandırır
// ══════════════════════════════════════════════════════════════════
const _daily = (function () {
  const K_DAY  = '_ha_day';
  const K_SEC  = '_ha_dsec';
  const K_TOT  = '_ha_tsec';
  const today  = new Date().toISOString().slice(0, 10);

  if (localStorage.getItem(K_DAY) !== today) {
    localStorage.setItem(K_DAY, today);
    localStorage.setItem(K_SEC, '0');
  }

  let active   = true;
  let lastTick = Date.now();

  function getSec()  { return parseInt(localStorage.getItem(K_SEC)  || '0'); }
  function getTot()  { return parseInt(localStorage.getItem(K_TOT)  || '0'); }
  function getMin()  { return Math.round(getSec() / 60); }

  function tick() {
    if (!active) return;
    const now = Date.now();
    const d   = Math.round((now - lastTick) / 1000);
    lastTick  = now;
    if (d < 1 || d > 60) return;
    localStorage.setItem(K_SEC, getSec() + d);
    localStorage.setItem(K_TOT, getTot() + d);
  }

  function flush() {
    gaEvent('daily_time_heartbeat', {
      daily_sec:      getSec(),
      daily_min:      getMin(),
      total_sec:      getTot(),
      total_min:      Math.round(getTot() / 60),
      date:           today,
      event_category: 'Time',
    });
  }

  setInterval(tick,  1000);
  setInterval(flush, 5 * 60 * 1000);

  document.addEventListener('visibilitychange', function () {
    active = document.visibilityState === 'visible';
    if (!active) { tick(); flush(); }
    else lastTick = Date.now();
  });
  window.addEventListener('pagehide', function () { tick(); flush(); });

  return { getSec, getMin, getTot };
})();

// ══════════════════════════════════════════════════════════════════
//  MODUL C — BÖLMƏDƏ KEÇƏN VAXT (saniyə dəqiqliyi)
// ══════════════════════════════════════════════════════════════════
const _timer = (function () {
  let cur   = null;
  let start = null;
  const totals = {};

  function enter(id) {
    leave();
    cur   = id;
    start = Date.now();
  }

  function leave() {
    if (!cur || !start) return;
    const sec = Math.round((Date.now() - start) / 1000);
    totals[cur] = (totals[cur] || 0) + sec;
    if (sec >= 3) {
      gaEvent('section_time', {
        section_id:    cur,
        seconds:       sec,
        minutes:       parseFloat((sec / 60).toFixed(2)),
        total_in_sec:  totals[cur],
        event_category:'Time',
      });
    }
    cur = null; start = null;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') leave();
    else if (cur) start = Date.now();
  });
  window.addEventListener('pagehide', leave);

  return { enter, leave, totals: () => totals };
})();

// ══════════════════════════════════════════════════════════════════
//  MODUL D — NAVİQASİYA (navTo wrap + scroll reset)
// ══════════════════════════════════════════════════════════════════
const PAGE_NAMES = {
  dash:'Ana Panel', todo:'Vəzifələr', finance:'Maliyyə',
  notes:'Qeydlər', books:'Kitablar', films:'Filmlər',
  serials:'Seriallar', games:'Oyunlar', puzzle:'Bulmacalar',
  workout:'Məşqlər', goals:'Hədəflər', links:'Linklər',
  calendar:'Təqvim', passmgr:'Şifrə Meneceri',
  pomodo:'Pomodoro', tools:'Alətlər', habits:'Vərdişlər',
  achieve:'Nailiyyətlər',
};

// Scroll izləyici — hər bölmə üçün ayrıca
const _scroll = (function () {
  const reached = {};
  let cur = 'dash';
  const el = document.getElementById('content');

  function reset(id) {
    cur = id;
    if (!reached[id]) reached[id] = new Set();
  }

  if (el) {
    el.addEventListener('scroll', function () {
      const sh = el.scrollHeight - el.clientHeight;
      if (sh <= 0) return;
      const pct = Math.round((el.scrollTop / sh) * 100);
      if (!reached[cur]) reached[cur] = new Set();
      [25, 50, 75, 100].forEach(t => {
        if (pct >= t && !reached[cur].has(t)) {
          reached[cur].add(t);
          gaEvent('scroll_depth', {
            section_id: cur, pct: t, event_category: 'Engagement',
          });
        }
      });
    }, { passive: true });
  }

  return { reset };
})();

window.addEventListener('load', function () {

  // ── İlk açılış ─────────────────────────────────────────────────
  gaEvent('app_open', {
    source:          _src.source,
    device:          _src.device,
    os:              _src.os,
    browser:         _src.browser,
    user_type:       _src.userType,
    visit_number:    _src.visits,
    screen:          _src.scr,
    is_pwa:          _src.isPWA,
    daily_min_today: _daily.getMin(),
    event_category:  'Session',
  });

  // Performans
  if (window.performance) {
    gaEvent('load_performance', {
      load_ms:        Math.round(performance.now()),
      event_category: 'Performance',
    });
  }

  // User properties (GA4 "User Explorer"da görünür)
  gtag('set', 'user_properties', {
    device_type:  _src.device,
    os:           _src.os,
    browser:      _src.browser,
    is_pwa:       String(_src.isPWA),
    user_type:    _src.userType,
    visit_count:  String(_src.visits),
  });

  // ── navTo wrap ──────────────────────────────────────────────────
  const _orig = window.navTo;
  if (typeof _orig !== 'function') return;

  window.navTo = function (id) {
    _orig.call(this, id);
    const name = PAGE_NAMES[id] || id;

    _timer.enter(id);
    _scroll.reset(id);

    gtag('event', 'page_view', {
      page_title:    name,
      page_location: location.href,
      page_path:     '/herros/' + id,
    });

    gaEvent('section_visit', {
      section_id:   id,
      section_name: name,
      daily_min:    _daily.getMin(),
      event_category: 'Navigation',
    });
  };

  // İlk bölmə
  _timer.enter('dash');
  _scroll.reset('dash');
  gtag('event', 'page_view', {
    page_title: 'Ana Panel', page_location: location.href, page_path: '/herros/dash',
  });
});

// ══════════════════════════════════════════════════════════════════
//  MODUL E — GİRİŞ & ONBOARDING
// ══════════════════════════════════════════════════════════════════
window.addEventListener('load', function () {
  document.querySelector('.gbtn')?.addEventListener('click', function () {
    gaEvent('login_click', { method: 'google', event_category: 'Auth' });
  });

  const _og = window.goScr;
  if (typeof _og === 'function') {
    window.goScr = function (id) {
      _og.call(this, id);
      if (id === 'sApp') {
        gaEvent('login_success', {
          source: _src.source, device: _src.device,
          user_type: _src.userType, event_category: 'Auth',
        });
      }
    };
  }

  document.querySelectorAll('.mcard').forEach(c => {
    c.addEventListener('click', function () {
      gaEvent('module_select', {
        module:         this.querySelector('.mname')?.textContent || '',
        action:         this.classList.contains('on') ? 'deselect' : 'select',
        event_category: 'Onboarding',
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════
//  MODUL F — VƏZİFƏLƏR
// ══════════════════════════════════════════════════════════════════
window.addEventListener('load', function () {
  const _os = window.saveTd;
  if (typeof _os === 'function') {
    window.saveTd = function () {
      const edit = !!window.editTdId;
      _os.call(this);
      gaEvent(edit ? 'todo_edit' : 'todo_add', {
        category: document.getElementById('tc')?.value || '',
        priority: document.getElementById('tp')?.value || '',
        event_category: 'Todo',
      });
    };
  }

  const _ot = window.togTd;
  if (typeof _ot === 'function') {
    window.togTd = function (id) {
      const was = !!(window.S?.todos || []).find(t => t.id === id)?.done;
      _ot.call(this, id);
      gaEvent('todo_complete', { was_done: was, event_category: 'Todo' });
    };
  }

  const _od = window.delTd;
  if (typeof _od === 'function') {
    window.delTd = function (id) {
      _od.call(this, id);
      gaEvent('todo_delete', { event_category: 'Todo' });
    };
  }
});

// ══════════════════════════════════════════════════════════════════
//  MODUL G — MALİYYƏ
// ══════════════════════════════════════════════════════════════════
window.addEventListener('load', function () {
  const _oa = window.addTr;
  if (typeof _oa === 'function') {
    window.addTr = function () {
      const type = document.getElementById('ft')?.value || '';
      const cat  = document.getElementById('fc')?.value || '';
      const amt  = parseFloat(document.getElementById('fa')?.value) || 0;
      _oa.call(this);
      gaEvent('finance_add', {
        txn_type: type, category: cat,
        amount_range: amt < 10 ? '0-10' : amt < 50 ? '10-50' : amt < 200 ? '50-200' : '200+',
        event_category: 'Finance',
      });
    };
  }

  const _od = window.delTr;
  if (typeof _od === 'function') {
    window.delTr = function (id) { _od.call(this, id); gaEvent('finance_delete', { event_category: 'Finance' }); };
  }
});

// ══════════════════════════════════════════════════════════════════
//  MODUL H — QEYDLƏRİ İZLƏ
// ══════════════════════════════════════════════════════════════════
window.addEventListener('load', function () {
  const _os = window.saveNote;
  if (typeof _os === 'function') {
    window.saveNote = function () {
      const tag = document.getElementById('ntag')?.value || '';
      _os.call(this);
      gaEvent('note_add', { tag, event_category: 'Notes' });
    };
  }
  const _od = window.delNote;
  if (typeof _od === 'function') {
    window.delNote = function (id) { _od.call(this, id); gaEvent('note_delete', { event_category: 'Notes' }); };
  }
});

// ══════════════════════════════════════════════════════════════════
//  MODUL I — OYUNLAR & BULMACALAR
// ══════════════════════════════════════════════════════════════════
window.addEventListener('load', function () {
  const _ol = window.loadGame;
  if (typeof _ol === 'function') {
    window.loadGame = function (id) { _ol.call(this, id); gaEvent('game_start', { game_id: id, event_category: 'Games' }); };
  }

  const _og = window.saveGH;
  if (typeof _og === 'function') {
    window.saveGH = function (game, score) {
      const prev = window.S?.ghi?.[game] || 0;
      _og.call(this, game, score);
      gaEvent('game_finish', { game_id: game, score, is_record: score > prev, event_category: 'Games' });
    };
  }

  const _op = window.openPuz;
  if (typeof _op === 'function') {
    window.openPuz = function (id) { _op.call(this, id); gaEvent('puzzle_open', { puzzle_id: id, event_category: 'Puzzle' }); };
  }
});

// ══════════════════════════════════════════════════════════════════
//  MODUL J — KİTABLAR
// ══════════════════════════════════════════════════════════════════
window.addEventListener('load', function () {
  const _oa = window.addBook;
  if (typeof _oa === 'function') {
    window.addBook = function () {
      _oa.call(this);
      gaEvent('book_add', {
        status: document.getElementById('bk-status')?.value || '',
        genre:  document.getElementById('bk-genre')?.value  || '',
        event_category: 'Books',
      });
    };
  }
});

// ══════════════════════════════════════════════════════════════════
//  MODUL K — FİLMLƏR & SERİALLAR
// ══════════════════════════════════════════════════════════════════
window.addEventListener('load', function () {
  const _oaf = window.addFilm;
  if (typeof _oaf === 'function') {
    window.addFilm = function () {
      _oaf.call(this);
      gaEvent('film_add', {
        status: document.getElementById('fm-status')?.value || '',
        genre:  document.getElementById('fm-genre')?.value  || '',
        event_category: 'Films',
      });
    };
  }

  const _oas = window.addSerial;
  if (typeof _oas === 'function') {
    window.addSerial = function () {
      _oas.call(this);
      gaEvent('serial_add', { status: document.getElementById('sr-status')?.value || '', event_category: 'Serials' });
    };
  }

  const _ote = window.togEp;
  if (typeof _ote === 'function') {
    window.togEp = function (srId, s, e) {
      _ote.call(this, srId, s, e);
      gaEvent('episode_watched', { season: s, episode: e, event_category: 'Serials' });
    };
  }
});

// ══════════════════════════════════════════════════════════════════
//  MODUL L — HƏDƏFLƏR
// ══════════════════════════════════════════════════════════════════
window.addEventListener('load', function () {
  const _oa = window.addGoal;
  if (typeof _oa === 'function') {
    window.addGoal = function () { _oa.call(this); gaEvent('goal_add', { event_category: 'Goals' }); };
  }
  const _ou = window.updateGoalProgress;
  if (typeof _ou === 'function') {
    window.updateGoalProgress = function (id, val) {
      _ou.call(this, id, val);
      gaEvent('goal_update', {
        range: val < 25 ? '0-25' : val < 50 ? '25-50' : val < 75 ? '50-75' : '75-100',
        event_category: 'Goals',
      });
    };
  }
});

// ══════════════════════════════════════════════════════════════════
//  MODUL M — VƏRDİŞLƏR
// ══════════════════════════════════════════════════════════════════
window.addEventListener('load', function () {
  const _oa = window.addHabit;
  if (typeof _oa === 'function') {
    window.addHabit = function () { _oa.call(this); gaEvent('habit_add', { event_category: 'Habits' }); };
  }
  const _ot = window.toggleHabitDay;
  if (typeof _ot === 'function') {
    window.toggleHabitDay = function (hid, date) {
      _ot.call(this, hid, date);
      gaEvent('habit_check', {
        is_today:       date === new Date().toISOString().slice(0, 10),
        event_category: 'Habits',
      });
    };
  }
});

// ══════════════════════════════════════════════════════════════════
//  MODUL N — POMODORO, ALƏTLƏR, AXTARIŞ
// ══════════════════════════════════════════════════════════════════
window.addEventListener('load', function () {
  const _ops = window.pomoStart;
  if (typeof _ops === 'function') {
    window.pomoStart = function () { _ops.call(this); gaEvent('pomo_start', { event_category: 'Pomodoro' }); };
  }

  const _oot = window.openTool;
  if (typeof _oot === 'function') {
    window.openTool = function (id) { _oot.call(this, id); gaEvent('tool_open', { tool_id: id, event_category: 'Tools' }); };
  }

  const _oogs = window.openGlobalSearch;
  if (typeof _oogs === 'function') {
    window.openGlobalSearch = function () { _oogs.call(this); gaEvent('search_open', { event_category: 'Search' }); };
  }

  let _gst = null;
  const _ogs = window.runGlobalSearch;
  if (typeof _ogs === 'function') {
    window.runGlobalSearch = function () {
      _ogs.call(this);
      clearTimeout(_gst);
      _gst = setTimeout(() => {
        const q = document.getElementById('gs-input')?.value?.trim() || '';
        if (q.length >= 2) {
          gaEvent('search_query', {
            length: q.length, filter: window._gsFilter || 'all', event_category: 'Search',
          });
        }
      }, 800);
    };
  }
});

// ══════════════════════════════════════════════════════════════════
//  MODUL O — NAİLİYYƏTLƏR, MƏŞQLƏR, ŞİFRƏ, DASHBOARD
// ══════════════════════════════════════════════════════════════════
window.addEventListener('load', function () {
  const _oca = window.checkNewAchievements;
  if (typeof _oca === 'function') {
    window.checkNewAchievements = function () {
      const b = window._prevUnlocked ? [...window._prevUnlocked] : null;
      _oca.call(this);
      if (b && window._prevUnlocked) {
        window._prevUnlocked.filter(id => !b.includes(id)).forEach(id => {
          gaEvent('achievement_unlock', { id, event_category: 'Achievements' });
        });
      }
    };
  }

  const _oaw = window.addWorkout;
  if (typeof _oaw === 'function') {
    window.addWorkout = function () {
      _oaw.call(this);
      gaEvent('workout_add', { type: document.getElementById('wo-type')?.value || '', event_category: 'Workout' });
    };
  }

  const _osp = window.savePass;
  if (typeof _osp === 'function') {
    window.savePass = function () { _osp.call(this); gaEvent('pass_saved', { event_category: 'PassManager' }); };
  }

  const _odt = window.dashToggle;
  if (typeof _odt === 'function') {
    window.dashToggle = function (id) {
      const was = (typeof getDashWidgetCfg === 'function' ? getDashWidgetCfg() : {})[id] !== false;
      _odt.call(this, id);
      gaEvent('widget_toggle', { widget: id, action: was ? 'hide' : 'show', event_category: 'Dashboard' });
    };
  }
});

// ══════════════════════════════════════════════════════════════════
//  MODUL P — SESSION SONU
// ══════════════════════════════════════════════════════════════════
const _sessStart = Date.now();

window.addEventListener('pagehide', function () {
  const sec = Math.round((Date.now() - _sessStart) / 1000);
  gaEvent('session_end', {
    session_sec:         sec,
    session_min:         Math.round(sec / 60),
    daily_total_sec:     _daily.getSec(),
    daily_total_min:     _daily.getMin(),
    last_section:        window.curPage || 'dash',
    sections_count:      Object.keys(_timer.totals()).length,
    event_category:      'Session',
  });
});

// ══════════════════════════════════════════════════════════════════
//  MODUL Q — ƏVVƏLKİ GÜNÜN XÜLASƏSİ (sabah göndərilir)
// ══════════════════════════════════════════════════════════════════
(function () {
  const pd = localStorage.getItem('_ha_pd');
  const ps = parseInt(localStorage.getItem('_ha_ps') || '0');
  if (pd && ps > 0) {
    gaEvent('prev_day_summary', {
      date: pd, total_sec: ps, total_min: Math.round(ps / 60),
      event_category: 'DailySummary',
    });
    localStorage.removeItem('_ha_pd');
    localStorage.removeItem('_ha_ps');
  }
  window.addEventListener('pagehide', function () {
    localStorage.setItem('_ha_pd', new Date().toISOString().slice(0, 10));
    localStorage.setItem('_ha_ps', _daily.getSec());
  });
})();

// ── Konsol bildirişi ─────────────────────────────────────────────
window.addEventListener('load', function () {
  console.log(
    '%c📊 HerrOS Analytics v2.0',
    'color:#d4a843;font-weight:bold;font-size:13px',
    '\n▸ Mənbə:',    _src.source,
    '| Cihaz:',      _src.device,
    '| OS:',         _src.os,
    '| Brauzer:',    _src.browser,
    '\n▸ Ziyarət №:', _src.visits,
    '| Bu gün:',     _daily.getMin(), 'dəq',
    '| Cəmi:',       Math.round(_daily.getTot() / 60), 'dəq'
  );
});
