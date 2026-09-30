/* app.js - shared code for every page: database link, header, allocation rules.
   Load order on each page: supabase-js, config.js, then this file. */

// ---- Light / dark theme (remembered on this phone) ----
(function () {
  var t = null;
  try { t = localStorage.getItem('hemm_theme'); } catch (e) { /* ignore */ }
  if (t !== 'light' && t !== 'dark') {
    t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
})();

// ---- Database link (the variable is called "db", not "supabase") ----
var db = null;
var dbSetupError = null;
try {
  db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
} catch (err) {
  dbSetupError = err;
}

var TABLE = 'dispatch_records';
var SHIFTS = ['A', 'B', 'C'];
var SHIFT_TIMES = { A: '6 AM - 2 PM', B: '2 PM - 10 PM', C: '10 PM - 6 AM' };
var ROLE_NAMES = { manager: 'Mine Manager', engineer: 'Maintenance Engineer', operator: 'Operator' };
var LOCATIONS = ['Parking yard', 'Workshop', 'Pit', 'Haul road', 'Dump yard'];
// "About how long until the machine is OK?" choices for the engineer (hours).
var ETA_HOURS = [1, 2, 3, 4, 6, 8, 12, 24, 48, 72];
var SHIFT_START_HOUR = { A: 6, B: 14, C: 22 };

// Overtime costs money. Overtime operators get a machine ONLY when there are more
// machines than regular (present) operators of that type. Extra ones are not allotted.

// ---- Allocation rules: change these lists to change who gets a machine first ----
// Machines of an earlier group get operators first.
var GROUP_ORDER = ['Excavator', 'Dumper', 'Grader/Sprinkler'];
// Inside the Grader/Sprinkler group: 1st sprinkler, then grader, then 2nd sprinkler.
var TYPE_ORDER = ['Excavator', 'Dumper', 'Water Sprinkler', 'Motor Grader'];

// ---- Small helpers ----
function esc(text) {
  return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
// Skill name that may wrap after the slash, for small tiles.
function skillText(g) { return esc(g).replace('/', '/<wbr>'); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function dateToStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

// Which shift is running now, and its date. Shift C after midnight belongs to yesterday.
function currentShiftInfo() {
  var now = new Date();
  var h = now.getHours();
  var shift = h >= 6 && h < 14 ? 'A' : (h >= 14 && h < 22 ? 'B' : 'C');
  var d = new Date(now);
  if (h < 6) d.setDate(d.getDate() - 1);
  return { date: dateToStr(d), shift: shift };
}
// Start and end time of a shift on a date. Shift C ends at 6 AM the next day.
function shiftWindow(dateStr, shift) {
  var p = dateStr.split('-');
  var start = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), SHIFT_START_HOUR[shift], 0, 0);
  return { start: start, end: new Date(start.getTime() + 8 * 3600 * 1000) };
}
// e.g. "4:30 PM", or "1 Oct, 4:30 PM" when it is not today.
function niceTime(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  var h = d.getHours(), m = d.getMinutes();
  var t = (h % 12 === 0 ? 12 : h % 12) + ':' + pad2(m) + ' ' + (h < 12 ? 'AM' : 'PM');
  if (dateToStr(d) === dateToStr(new Date())) return t;
  return niceDate(dateToStr(d)).replace(/ \d{4}$/, '') + ', ' + t;
}
// e.g. "in about 3 h" or "time has passed"
function etaFromNow(iso) {
  var mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins <= 0) return 'time has passed';
  if (mins < 90) return 'in about ' + mins + ' min';
  var hrs = Math.round(mins / 60);
  return hrs < 48 ? 'in about ' + hrs + ' h' : 'in about ' + Math.round(hrs / 24) + ' days';
}
function niceDate(str) {
  if (!str) return '';
  var p = str.split('-');
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return parseInt(p[2], 10) + ' ' + months[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

// ---- Remembering the chosen role on this phone (no password) ----
function store(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* ignore */ } }
function recall(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function forget(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
function getRole() {
  var r = recall('hemm_role');
  return r === 'incharge' ? 'manager' : r;     // old name of the Mine Manager role
}

// ---- Login (Supabase Auth). Manager and engineer log in with email + password. ----
// The role of a login is kept by the Data Keeper in the account itself (see database/06-set-login-roles.sql).
async function getAuthUser() {
  if (!db) return null;
  try {
    var res = await db.auth.getSession();
    return (res.data && res.data.session && res.data.session.user) || null;
  } catch (e) { return null; }
}
function authRoleOf(user) {
  return (user && user.app_metadata && user.app_metadata.role) || null;
}
// Returns true if the person is really logged in with the role they chose. Otherwise clears the role.
async function checkLogin(role) {
  if (role !== 'manager' && role !== 'engineer') return true;    // operators and viewers need no login
  var user = await getAuthUser();
  if (user && authRoleOf(user) === role) return true;
  forget('hemm_role');
  return false;
}
async function signOutNow() {
  try { if (db) await db.auth.signOut(); } catch (e) { /* ignore */ }
  forget('hemm_role');
  window.location.href = 'index.html';
}
function getOperatorId() { return recall('hemm_operator_id'); }

// ---- Icons (small pictures drawn inside the page, no downloads) ----
var ICONS = {
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  work: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.9 4.9C.8 7.3 1.2 10.3 3.2 12.3c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.1-2.1c.4-.4.4-1.1 0-1.5z',
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  groups: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  chart: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
  event: 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  logout: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
  login: 'M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z',
  search: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2zM11 20h2v3h-2zM1 11h3v2H1zM20 11h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zM16.3 17.7l1.4-1.4 2.1 2.1-1.4 1.4zM17.7 4.2l1.4 1.4-2.1 2.1-1.4-1.4zM5.6 19.8l-1.4-1.4 2.1-2.1 1.4 1.4z',
  moon: 'M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.4 5.4 0 0 1-4.4 2.26 5.4 5.4 0 0 1-5.4-5.4c0-1.81.89-3.42 2.26-4.4A9.2 9.2 0 0 0 12 3z',
  truck: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'
};
function icon(name, small) {
  return '<svg class="ic' + (small ? ' sm' : '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (ICONS[name] || '') + '"/></svg>';
}

// A round badge with a letter: E excavator, D dumper, G grader, W water sprinkler.
function avatar(kind) {
  var m = { 'Excavator': ['av-ex', 'E'], 'Dumper': ['av-du', 'D'], 'Motor Grader': ['av-gs', 'G'],
            'Water Sprinkler': ['av-gs', 'W'], 'Grader/Sprinkler': ['av-gs', 'GS'] }[kind] || ['av-du', '?'];
  return '<span class="avatar ' + m[0] + '">' + m[1] + '</span>';
}

// ---- App shell, the same on every page: top bar, side bar (machines and operators), bottom menu on phones ----
// The Mahanadi Coalfields logo: put the official logo file in the top folder and name it logo.png.
// Until that file exists, a plain "MCL" badge is shown instead.
function currentTheme() { return document.documentElement.getAttribute('data-theme') || 'light'; }
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  store('hemm_theme', t);
  var btn = document.getElementById('theme-toggle');
  if (btn) btn.innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
  if (typeof window.onThemeChange === 'function') window.onThemeChange();
}
function logoHtml() { return '<span class="logo"><img src="logo.png" alt="Mahanadi Coalfields Limited"></span>'; }
function fixLogos(root) {
  Array.prototype.forEach.call(root.querySelectorAll('.logo img'), function (img) {
    img.onerror = function () { img.parentNode.innerHTML = '<span class="logo-fallback">MCL</span>'; };
  });
}
var PAGE_TITLES = { 'index.html': 'Dashboard', 'work.html': 'My Work', 'login.html': 'Login' };
function renderHeader(activePage) {
  var el = document.getElementById('site-header');
  if (!el) return;
  var role = getRole();
  var who = ROLE_NAMES[role] || 'Not logged in';
  var links = [['index.html', 'Dashboard', 'dashboard'], ['work.html', 'My Work', 'work'], ['login.html', 'Login', 'lock']];
  var nav = links.map(function (l) {
    return '<a href="' + l[0] + '"' + (l[0] === activePage ? ' class="active"' : '') + '><span class="pill">' + icon(l[2]) + '</span><span>' + l[1] + '</span></a>';
  }).join('');
  document.body.classList.add('has-sidebar');
  el.className = 'site-header';
  el.innerHTML =
    '<div class="appbar-top"><button class="icon-btn menu-btn" id="menu-btn" aria-label="Open the menu with machines and operators">' + icon('menu') + '</button>' +
    logoHtml() + '<div class="page-title">' + esc(PAGE_TITLES[activePage] || 'HEMM Allocator') + '</div>' +
    '<a class="role-chip" href="login.html">' + icon('person') + esc(who) + '</a>' +
    '<button class="icon-btn" id="theme-toggle" aria-label="Switch dark or light theme">' + icon(currentTheme() === 'dark' ? 'sun' : 'moon') + '</button></div>' +
    '<nav class="nav">' + nav + '</nav>';

  // Side bar
  var old = document.getElementById('sidebar');
  if (old) old.parentNode.removeChild(old);
  var oldScrim = document.getElementById('scrim');
  if (oldScrim) oldScrim.parentNode.removeChild(oldScrim);
  var side = document.createElement('aside');
  side.id = 'sidebar'; side.className = 'sidebar';
  var sideNav = links.map(function (l) {
    return '<a class="sb-link' + (l[0] === activePage ? ' active' : '') + '" href="' + l[0] + '">' + icon(l[2]) + '<span>' + l[1] + '</span></a>';
  }).join('') + (ROLE_NAMES[role] && role !== 'operator' ? '<button class="sb-link" id="sb-logout">' + icon('logout') + '<span>Log out</span></button>' : '');
  side.innerHTML =
    '<div class="sb-brand">' + logoHtml() + '<div><div class="title">HEMM Allocator</div><div class="subtitle">Mahanadi Coalfields Limited</div></div>' +
    '<button class="icon-btn sb-close" id="sb-close" aria-label="Close the menu">' + icon('close') + '</button></div>' +
    '<div class="sb-nav">' + sideNav + '</div>' +
    '<div class="sb-search">' + icon('search', true) + '<input type="text" id="sb-filter" placeholder="Find a machine or operator" aria-label="Find a machine or operator"></div>' +
    '<div class="sb-scroll"><div class="sb-title">Machines</div><div id="sb-machines"><p class="muted" style="padding:0 14px">Loading...</p></div>' +
    '<div class="sb-title">Operators</div><div id="sb-operators"></div></div>' +
    '<div class="sb-foot">All data is made up.</div>';
  document.body.appendChild(side);
  var scrim = document.createElement('div');
  scrim.id = 'scrim'; scrim.className = 'scrim';
  document.body.appendChild(scrim);
  fixLogos(el); fixLogos(side);

  document.getElementById('theme-toggle').onclick = function () { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); };
  var closeDrawer = function () { document.body.classList.remove('drawer-open'); };
  document.getElementById('menu-btn').onclick = function () { document.body.classList.add('drawer-open'); };
  document.getElementById('sb-close').onclick = closeDrawer;
  scrim.onclick = closeDrawer;
  var lo = document.getElementById('sb-logout');
  if (lo) lo.onclick = signOutNow;
  document.getElementById('sb-filter').oninput = function () {
    var q = this.value.trim().toLowerCase();
    Array.prototype.forEach.call(side.querySelectorAll('.sb-item'), function (b) {
      b.style.display = !q || b.getAttribute('data-name').indexOf(q) >= 0 ? '' : 'none';
    });
  };
  side.addEventListener('click', function (e) {
    var b = e.target.closest('.sb-item');
    if (!b) return;
    closeDrawer();
    var kind = b.getAttribute('data-kind'), id = b.getAttribute('data-id');
    if (typeof window.onSidebarPick === 'function') window.onSidebarPick(kind, id);
    else window.location.href = 'index.html?open=' + kind + ':' + encodeURIComponent(id);
  });
}
// Fill the side bar lists. Dots show today's picture: green = OK / on duty, yellow = repair / off, red = breakdown.
function renderSidebar(records) {
  var m = document.getElementById('sb-machines'), o = document.getElementById('sb-operators');
  if (!m || !o) return;
  var today = currentShiftInfo().date;
  var order = { 'Excavator': 0, 'Dumper': 1, 'Water Sprinkler': 2, 'Motor Grader': 3 };
  var hemms = records.filter(function (r) { return r.record_type === 'HEMM'; }).sort(function (a, b) {
    return order[a.hemm_type] - order[b.hemm_type] || String(a.serial_no).localeCompare(String(b.serial_no), undefined, { numeric: true });
  });
  m.innerHTML = hemms.map(function (h) {
    return '<button class="sb-item" data-kind="hemm" data-id="' + esc(h.id) + '" data-name="' + esc(h.name.toLowerCase()) + '">' +
      '<span class="dot ' + hemmStatusClass(h) + '"></span><span class="sb-name">' + esc(h.name) + '</span><span class="sb-sub">' + breakdownProbOf(h) + '%</span></button>';
  }).join('') || '<p class="muted" style="padding:0 14px">No machines.</p>';
  var ops = records.filter(function (r) { return r.record_type === 'OPERATOR'; });
  o.innerHTML = SHIFTS.map(function (sh) {
    var list = ops.filter(function (x) { return x.home_shift === sh; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (!list.length) return '';
    return '<div class="sb-sub-title">Shift ' + sh + '</div>' + list.map(function (x) {
      var why = leaveReason(x, today);
      return '<button class="sb-item" data-kind="op" data-id="' + esc(x.id) + '" data-name="' + esc(x.name.toLowerCase()) + '">' +
        '<span class="dot ' + (why ? 'warn' : 'good') + '"></span><span class="sb-name">' + esc(x.name) + '</span><span class="sb-sub">' + Math.round(effOf(x) * 100) + '%</span></button>';
    }).join('');
  }).join('');
}

// ---- Friendly messages (errors always show the real error text) ----
function showMessage(text, kind) {
  var box = document.getElementById('message');
  if (!box) return;
  box.className = 'msg ' + (kind || 'info');
  box.innerHTML = esc(text);
  box.classList.remove('hidden');
}
function showError(friendly, err) {
  var box = document.getElementById('message');
  if (!box) return;
  var detail = '';
  if (err) {
    detail = (err.message || String(err));
    if (err.details) detail += ' | ' + err.details;
    if (err.hint) detail += ' | ' + err.hint;
    if (err.code) detail += ' (code ' + err.code + ')';
  }
  box.className = 'msg err';
  box.innerHTML = esc(friendly) + (detail ? '<code>Error text: ' + esc(detail) + '</code>' : '');
  box.classList.remove('hidden');
}
function clearMessage() {
  var box = document.getElementById('message');
  if (box) box.classList.add('hidden');
}

// ---- Talking to the database ----
async function loadRecords() {
  if (dbSetupError || !db) throw (dbSetupError || new Error('Database link is not ready.'));
  var res = await db.from(TABLE).select('*').order('created_at', { ascending: true }).order('name', { ascending: true });
  if (res.error) throw res.error;
  return res.data || [];
}
async function updateRecord(id, fields) {
  if (dbSetupError || !db) throw (dbSetupError || new Error('Database link is not ready.'));
  fields.updated_at = new Date().toISOString();
  var res = await db.from(TABLE).update(fields).eq('id', id).select();
  if (res.error) throw res.error;
  if (!res.data || !res.data.length) throw new Error('The change was not saved (no row was updated).');
  return res.data[0];
}

// ---- Words for status ----
// HEMM: Resolved = OK (fit), In progress = under repair, Open = breakdown.
function hemmStatusText(h) {
  return h.status === 'Resolved' ? 'OK (fit)' : (h.status === 'In progress' ? 'Under repair' : 'Breakdown');
}
function hemmStatusClass(h) {
  return h.status === 'Resolved' ? 'good' : (h.status === 'In progress' ? 'warn' : 'bad');
}
function isFit(h) { return h.record_type === 'HEMM' && h.status === 'Resolved'; }
function hemmLabel(h) { return h.name + ' (' + (h.make_model || '') + ')'; }

// ---- Production, breakdown and leave settings (change the numbers here) ----
var TRIP_MINUTES = 10;            // one dumper trip takes 10 minutes
var M3_PER_TRIP = 16;             // one trip carries 16 m3 of overburden
var SHIFT_MINUTES = 480;          // a shift is 8 hours
var EXTRA_LEAVE_DAYS = 2;         // about 2 leave days a month, besides the weekly rest
var DEFAULT_BREAKDOWN_PROB = 5;   // % chance per shift, used when a machine has no value
var DEFAULT_EFFICIENCY = 85;      // % used when an operator has no efficiency value
var UNKNOWN_REPAIR_DAYS = 2;      // repair time assumed when the engineer gave none
var PROJECTION_DAYS = 30;         // the projection looks 30 days ahead
var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var BREAKDOWN_CHOICES = [0, 1, 2, 3, 5, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50];

function tripsPerShift() { return Math.floor(SHIFT_MINUTES / TRIP_MINUTES); }
function m3PerDumperShift() { return tripsPerShift() * M3_PER_TRIP; }
function formatNum(n) { return Math.round(n).toLocaleString('en-IN'); }
function weekdayOf(dateStr) {
  var p = dateStr.split('-');
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)).getDay();
}
function addDays(dateStr, n) {
  var p = dateStr.split('-');
  return dateToStr(new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10) + n));
}
// Why is this operator not on duty on this date?
// 'Weekly off', 'Leave' (applied by the operator), 'Absent' (marked by the Mine Manager) or null.
// Everyone is treated as present unless one of these applies.
function leaveReason(o, dateStr) {
  if (o.weekly_off != null && weekdayOf(dateStr) === Number(o.weekly_off)) return 'Weekly off';
  if ((o.leave_dates || []).indexOf(dateStr) >= 0) return 'Leave';
  if ((o.absent_dates || []).indexOf(dateStr) >= 0) return 'Absent';
  return null;
}
// Overtime call made in advance by the Mine Manager: { "2026-10-05": "B" } means "call for Shift B on that date".
function overtimeCallShift(o, dateStr) {
  return (o.ot_calls && o.ot_calls[dateStr]) || null;
}
// An operator on applied leave or marked absent cannot be called for overtime (weekly off can).
function overtimeBlocked(o, dateStr) {
  return (o.leave_dates || []).indexOf(dateStr) >= 0 || (o.absent_dates || []).indexOf(dateStr) >= 0;
}
// Overtime operators for a date and shift: called by the manager, from another shift, and free that day.
function overtimeCalled(ops, dateStr, shift) {
  return ops.filter(function (o) {
    return o.home_shift !== shift && overtimeCallShift(o, dateStr) === shift && !overtimeBlocked(o, dateStr);
  });
}
// Operator efficiency as a fraction (0.92 = 92% of the standard trips per shift).
function effOf(o) {
  return (o.efficiency == null ? DEFAULT_EFFICIENCY : Number(o.efficiency)) / 100;
}
function breakdownProbOf(h) {
  return h.breakdown_prob == null ? DEFAULT_BREAKDOWN_PROB : Number(h.breakdown_prob);
}

// ---- The automatic allocation ----
// Input: all rows, the date (YYYY-MM-DD) and the shift (A/B/C).
// Machines that can be given to operators in that shift:
//   1. Machines marked OK (fit).
//   2. Machines under repair whose "expected OK" time is on or before the shift start.
// Operators who can be given a machine:
//   1. Own-shift operators who are not on weekly off, leave or marked absent (present by default).
//   2. Overtime operators called by the Mine Manager, ONLY for machines left empty because there are fewer regular operators.
function computeAllocation(records, dateStr, shift) {
  var hemms = records.filter(function (r) { return r.record_type === 'HEMM'; });
  var ops = records.filter(function (r) { return r.record_type === 'OPERATOR'; });
  // Best combination: the most efficient operators are used first, and they get the
  // most reliable machines (lowest breakdown chance) of the highest-priority type.
  var byName = function (a, b) { return effOf(b) - effOf(a) || a.name.localeCompare(b.name); };
  var win = shiftWindow(dateStr, shift);
  var etaOf = function (h) { return h.expected_ok_at ? new Date(h.expected_ok_at) : null; };

  var regular = ops.filter(function (o) {
    return o.home_shift === shift && !leaveReason(o, dateStr);
  }).sort(byName);
  var overtimeAll = overtimeCalled(ops, dateStr, shift).sort(byName);
  var overtimeNotAllotted = [];
  var overtimeUsed = 0;

  // Machines that can work in this shift, in the order they should get operators.
  var usable = hemms.filter(function (h) {
    var eta = etaOf(h);
    return isFit(h) || (eta && eta <= win.start);
  }).sort(function (a, b) {
    return breakdownProbOf(a) - breakdownProbOf(b) ||
           String(a.serial_no).localeCompare(String(b.serial_no), undefined, { numeric: true });
  });
  var seen = {};
  var ranked = usable.map(function (h) {
    seen[h.hemm_type] = seen[h.hemm_type] || 0;
    return { h: h, n: seen[h.hemm_type]++ };
  }).sort(function (a, b) {
    return GROUP_ORDER.indexOf(a.h.skill_group) - GROUP_ORDER.indexOf(b.h.skill_group) ||
           a.n - b.n ||
           TYPE_ORDER.indexOf(a.h.hemm_type) - TYPE_ORDER.indexOf(b.h.hemm_type);
  }).map(function (x) { return x.h; });

  // Machines that are not ready at shift start but may be back during the shift.
  var comingBack = hemms.filter(function (h) {
    var eta = etaOf(h);
    return !isFit(h) && eta && eta > win.start && eta <= win.end;
  }).sort(function (a, b) { return etaOf(a) - etaOf(b); });
  var notUsable = hemms.filter(function (h) { return usable.indexOf(h) < 0; });

  var assignments = [], idleHemms = [], idleOperators = [];
  GROUP_ORDER.forEach(function (group) {
    var machines = ranked.filter(function (h) { return h.skill_group === group; });
    var regG = regular.filter(function (o) { return o.skill_group === group; });
    var otG = overtimeAll.filter(function (o) { return o.skill_group === group; });
    machines.forEach(function (h, i) {
      if (regG[i]) assignments.push({ hemm: h, operator: regG[i], overtime: false, expected: !isFit(h), eff: effOf(regG[i]) });
      else if (otG[i - regG.length]) {
        assignments.push({ hemm: h, operator: otG[i - regG.length], overtime: true, expected: !isFit(h), eff: effOf(otG[i - regG.length]) });
        overtimeUsed++;
      } else idleHemms.push(h);
    });
    // Overtime operators beyond the empty machines are not allotted.
    otG.slice(Math.max(0, machines.length - regG.length)).forEach(function (o) { overtimeNotAllotted.push(o); });

    // Free manpower: say what each idle operator can do.
    var waiting = comingBack.filter(function (h) { return h.skill_group === group; });
    var unknown = notUsable.some(function (h) {
      return h.skill_group === group && !isFit(h) && !etaOf(h);
    });
    regG.slice(machines.length).forEach(function (op, j) {
      var advice, kind;
      if (waiting[j]) {
        kind = 'wait';
        advice = waiting[j].name + ' is expected OK by ' + niceTime(waiting[j].expected_ok_at) + '. Can join then.';
      } else if (unknown) {
        kind = 'ask';
        advice = 'A machine of this type is under repair but no repair time is given. Ask the engineer.';
      } else {
        kind = 'free';
        advice = 'No machine of this type is expected back in this shift. Can be given other work.';
      }
      idleOperators.push({ operator: op, overtime: false, advice: advice, kind: kind });
    });
  });

  // Production of this shift's plan. The excavator operator's efficiency is the loading speed;
  // each dumper adds trips x m3 x its operator's efficiency. "Expected" also counts breakdown chances.
  var exA = assignments.filter(function (x) { return x.hemm.hemm_type === 'Excavator'; })[0];
  var plannedM3 = 0, expectedM3 = 0;
  if (exA) {
    var exExpect = exA.eff * (1 - breakdownProbOf(exA.hemm) / 100);
    assignments.forEach(function (x) {
      if (x.hemm.hemm_type !== 'Dumper') return;
      var m3 = m3PerDumperShift() * x.eff;
      x.m3 = m3 * exA.eff;
      plannedM3 += m3 * exA.eff;
      expectedM3 += m3 * (1 - breakdownProbOf(x.hemm) / 100) * exExpect;
    });
  }

  return {
    plannedM3: plannedM3,
    expectedM3: expectedM3,
    assignments: assignments,
    idleHemms: idleHemms,
    idleOperators: idleOperators,
    overtimeNotAllotted: overtimeNotAllotted,
    comingBack: comingBack,
    notFit: hemms.filter(function (h) { return !isFit(h); }),
    availableCount: regular.length + overtimeUsed,
    overtimeCount: overtimeAll.length,
    fitCount: hemms.filter(isFit).length,
    hemmCount: hemms.length
  };
}

// ---- Projected production ----
// Chance of each number of "successes" out of independent chances ps (a Poisson-binomial list).
function countChances(ps) {
  var dist = [1];
  ps.forEach(function (p) {
    var next = new Array(dist.length + 1).fill(0);
    dist.forEach(function (v, k) { next[k] += v * (1 - p); next[k + 1] += v * p; });
    dist = next;
  });
  return dist;
}
// Every way a list of operators {p: chance present, eff: efficiency} can turn up.
// Returns [{prob, effs}] where effs are the efficiencies of those present, best first.
function attendanceCases(ops) {
  var cases = [];
  for (var mask = 0; mask < (1 << ops.length); mask++) {
    var prob = 1, effs = [];
    ops.forEach(function (o, k) {
      if (mask & (1 << k)) { prob *= o.p; effs.push(o.eff); } else { prob *= 1 - o.p; }
    });
    if (prob > 0) cases.push({ prob: prob, effs: effs.sort(function (a, b) { return b - a; }) });
  }
  return cases;
}
function chanceAtLeastOne(ps) {
  return 1 - ps.reduce(function (acc, p) { return acc * (1 - p); }, 1);
}
// Expected overburden (m3) in one shift, when the best operators are given the machines that are running.
// Dumpers haul only when an excavator is loading; the excavator operator's efficiency scales the loading.
// Regular operators come first. Called overtime operators (efficiencies otDu / otEx, best first) fill only empty machines.
function shiftProduction(exOps, exOt, exMachines, duOps, duOt, duMachines) {
  var machineCount = countChances(duMachines), dumperSum = 0;
  var otPrefix = [0];
  duOt.forEach(function (e, k) { otPrefix.push(otPrefix[k] + e); });
  attendanceCases(duOps).forEach(function (c) {
    var prefix = [0];
    c.effs.forEach(function (e, k) { prefix.push(prefix[k] + e); });
    machineCount.forEach(function (pm, m) {
      var extra = Math.min(Math.max(0, m - c.effs.length), duOt.length);
      dumperSum += c.prob * pm * (prefix[Math.min(m, c.effs.length)] + otPrefix[extra]);
    });
  });
  var loading = 0;
  attendanceCases(exOps).forEach(function (c) {
    if (c.effs.length) loading += c.prob * c.effs[0];
    else if (exOt.length) loading += c.prob * exOt[0];
  });
  loading *= chanceAtLeastOne(exMachines);
  return dumperSum * loading * m3PerDumperShift();
}

// Projection for `days` days from startDateStr. Uses: weekly off, leave marked in advance,
// about EXTRA_LEAVE_DAYS more leave days a month, each machine's breakdown chance,
// and the expected OK time of machines now under repair.
function projectProduction(records, startDateStr, days) {
  var now = Date.now();
  var hemms = records.filter(function (r) { return r.record_type === 'HEMM'; });
  var ops = records.filter(function (r) { return r.record_type === 'OPERATOR'; });
  var dayList = [];
  for (var i = 0; i < days; i++) dayList.push(addDays(startDateStr, i));

  // Chance that an operator takes an unplanned leave on any one working day.
  var extraP = {};
  ops.forEach(function (o) {
    var marked = 0, working = 0;
    dayList.forEach(function (d) {
      var r = leaveReason(o, d);
      if (r === 'Leave' || r === 'Absent') marked++; else if (!r) working++;
    });
    var left = Math.max(0, EXTRA_LEAVE_DAYS * days / 30 - marked);
    extraP[o.id] = Math.min(1, left / Math.max(1, working));
  });
  function opChance(o, d) { return leaveReason(o, d) ? 0 : 1 - extraP[o.id]; }
  function machineChance(h, startTime) {
    var back = 0;
    if (h.status !== 'Resolved') {
      back = h.expected_ok_at ? new Date(h.expected_ok_at).getTime() : now + UNKNOWN_REPAIR_DAYS * 86400000;
    }
    return startTime < back ? 0 : 1 - breakdownProbOf(h) / 100;
  }

  var exMachines = hemms.filter(function (h) { return h.hemm_type === 'Excavator'; });
  var duMachines = hemms.filter(function (h) { return h.hemm_type === 'Dumper'; });
  var total = 0, fullTotal = 0;
  var result = dayList.map(function (d) {
    var perShift = SHIFTS.map(function (s) {
      var st = shiftWindow(d, s).start.getTime();
      var exOps = ops.filter(function (o) { return o.home_shift === s && o.skill_group === 'Excavator'; });
      var duOps = ops.filter(function (o) { return o.home_shift === s && o.skill_group === 'Dumper'; });
      var effsOf = function (list) { return list.map(effOf).sort(function (a, b) { return b - a; }); };
      var otEx = effsOf(overtimeCalled(ops, d, s).filter(function (o) { return o.skill_group === 'Excavator'; }));
      var otDu = effsOf(overtimeCalled(ops, d, s).filter(function (o) { return o.skill_group === 'Dumper'; }));
      var expected = shiftProduction(
        exOps.map(function (o) { return { p: opChance(o, d), eff: effOf(o) }; }), otEx,
        exMachines.map(function (h) { return machineChance(h, st); }),
        duOps.map(function (o) { return { p: opChance(o, d), eff: effOf(o) }; }), otDu,
        duMachines.map(function (h) { return machineChance(h, st); }));
      var full = shiftProduction(exOps.map(function (o) { return { p: 1, eff: effOf(o) }; }), [], exMachines.map(function () { return 1; }),
        duOps.map(function (o) { return { p: 1, eff: effOf(o) }; }), [], duMachines.map(function () { return 1; }));
      fullTotal += full;
      return expected;
    });
    var dayTotal = perShift.reduce(function (a, b) { return a + b; }, 0);
    total += dayTotal;
    return { date: d, total: dayTotal, shifts: perShift };
  });
  return { days: result, total: total, fullTotal: fullTotal, average: total / days };
}

// ---- Telling people how a change moved the projection ----
function projectedTotal(records) {
  return projectProduction(records, currentShiftInfo().date, PROJECTION_DAYS).total;
}
// Returns { text, kind } where kind is 'ok' (increase), 'warn' (decrease) or 'info' (no change).
function changeMessage(before, after) {
  var diff = after - before;
  if (Math.abs(diff) < 1) return { text: 'Projected production (next ' + PROJECTION_DAYS + ' days) is unchanged at ' + formatNum(after) + ' m³.', kind: 'info' };
  return {
    text: 'Projected production (next ' + PROJECTION_DAYS + ' days) ' + (diff > 0 ? 'INCREASED' : 'DECREASED') + ' by ' + formatNum(Math.abs(diff)) +
          ' m³ (' + (diff > 0 ? '+' : '-') + (before ? (Math.abs(diff) / before * 100).toFixed(1) : '0') + '%): from ' + formatNum(before) + ' to ' + formatNum(after) + ' m³.',
    kind: diff > 0 ? 'ok' : 'warn'
  };
}

// ---- What-if: try a different number of machines and operators ----
// counts = { exM, duM, exO, duO }: excavators, dumpers, excavator operators per shift, dumper operators per shift.
// Returns the current counts (used as slider starting points).
function fleetCounts(records) {
  var hemms = records.filter(function (r) { return r.record_type === 'HEMM'; });
  var ops = records.filter(function (r) { return r.record_type === 'OPERATOR'; });
  var perShift = function (group) {
    return Math.max.apply(null, [0].concat(SHIFTS.map(function (s) {
      return ops.filter(function (o) { return o.home_shift === s && o.skill_group === group; }).length;
    })));
  };
  return {
    exM: hemms.filter(function (h) { return h.hemm_type === 'Excavator'; }).length,
    duM: hemms.filter(function (h) { return h.hemm_type === 'Dumper'; }).length,
    exO: perShift('Excavator'), duO: perShift('Dumper')
  };
}
// A copy of the records with machines and operators added (average ones) or removed (weakest ones first).
function applyWhatIf(records, want) {
  var out = records.slice();
  var avg = function (list, f, fallback) {
    return list.length ? list.reduce(function (a, x) { return a + f(x); }, 0) / list.length : fallback;
  };
  [['Excavator', want.exM], ['Dumper', want.duM]].forEach(function (pair) {
    var type = pair[0], target = pair[1];
    var list = out.filter(function (h) { return h.record_type === 'HEMM' && h.hemm_type === type; });
    if (target < list.length) {
      var drop = list.slice().sort(function (a, b) { return breakdownProbOf(b) - breakdownProbOf(a); }).slice(0, list.length - target);
      out = out.filter(function (r) { return drop.indexOf(r) < 0; });
    } else {
      for (var i = list.length; i < target; i++) {
        out.push({ id: 'whatif-m-' + type + i, record_type: 'HEMM', name: 'Extra ' + type + ' ' + (i + 1), skill_group: type === 'Excavator' ? 'Excavator' : 'Dumper',
          hemm_type: type, serial_no: 'x' + i, status: 'Resolved', expected_ok_at: null, location: 'Parking yard',
          breakdown_prob: avg(list, breakdownProbOf, DEFAULT_BREAKDOWN_PROB) });
      }
    }
  });
  SHIFTS.forEach(function (sh, si) {
    [['Excavator', want.exO], ['Dumper', want.duO]].forEach(function (pair) {
      var group = pair[0], target = pair[1];
      var list = out.filter(function (o) { return o.record_type === 'OPERATOR' && o.home_shift === sh && o.skill_group === group; });
      if (target < list.length) {
        var drop = list.slice().sort(function (a, b) { return effOf(a) - effOf(b); }).slice(0, list.length - target);
        out = out.filter(function (r) { return drop.indexOf(r) < 0; });
      } else {
        for (var i = list.length; i < target; i++) {
          out.push({ id: 'whatif-o-' + sh + group + i, record_type: 'OPERATOR', name: 'Extra ' + group + ' operator ' + sh + (i + 1), skill_group: group,
            home_shift: sh, efficiency: Math.round(avg(list, effOf, DEFAULT_EFFICIENCY / 100) * 100), weekly_off: (i + si) % 7,
            leave_dates: [], absent_dates: [], ot_calls: {} });
        }
      }
    });
  });
  return out;
}
