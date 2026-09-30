/* app.js - shared code for every page: database link, header, allocation rules.
   Load order on each page: supabase-js, config.js, then this file. */

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
var ROLE_NAMES = { incharge: 'Shift Incharge', engineer: 'Maintenance Engineer', operator: 'Operator' };
var LOCATIONS = ['Parking yard', 'Workshop', 'Pit', 'Haul road', 'Dump yard'];

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
function niceDate(str) {
  if (!str) return '';
  var p = str.split('-');
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return parseInt(p[2], 10) + ' ' + months[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

// ---- Remembering the chosen role on this phone (no password) ----
function store(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* ignore */ } }
function recall(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function getRole() { return recall('hemm_role'); }
function getOperatorId() { return recall('hemm_operator_id'); }

// ---- Header and menu, the same on every page ----
function renderHeader(activePage) {
  var el = document.getElementById('site-header');
  if (!el) return;
  var role = getRole();
  var who = ROLE_NAMES[role] ? 'Role: ' + ROLE_NAMES[role] : 'No role chosen';
  var links = [['index.html', 'Home'], ['work.html', 'My Work'], ['dashboard.html', 'Dashboard']];
  var menu = links.map(function (l) {
    return '<a href="' + l[0] + '"' + (l[0] === activePage ? ' class="active"' : '') + '>' + l[1] + '</a>';
  }).join('');
  el.className = 'site-header';
  el.innerHTML =
    '<div class="top"><span class="title">HEMM Shift Allocator</span>' +
    '<span class="who">' + esc(who) + ' &middot; <a href="index.html">change</a></span></div>' +
    '<nav class="menu">' + menu + '</nav>';
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

// ---- The automatic allocation ----
// Input: all rows, the date (YYYY-MM-DD) and the shift (A/B/C).
// Who is available for that shift:
//   1. Own-shift operators who marked "Present" for that date.
//   2. Operators from another shift who raised "Overtime" interest for that shift and date.
// Own-shift operators are used first. Overtime operators fill only the machines still empty.
function computeAllocation(records, dateStr, shift) {
  var hemms = records.filter(function (r) { return r.record_type === 'HEMM'; });
  var ops = records.filter(function (r) { return r.record_type === 'OPERATOR'; });
  var byName = function (a, b) { return a.name.localeCompare(b.name); };

  var regular = ops.filter(function (o) {
    return o.home_shift === shift && o.attendance === 'Present' && o.duty_date === dateStr;
  }).sort(byName);
  var overtime = ops.filter(function (o) {
    return o.home_shift !== shift && o.attendance === 'Overtime' && o.duty_shift === shift && o.duty_date === dateStr;
  }).sort(byName);

  // Fit machines, in the order they should get operators.
  var fit = hemms.filter(isFit).sort(function (a, b) { return String(a.serial_no).localeCompare(String(b.serial_no), undefined, { numeric: true }); });
  var seen = {};
  var ranked = fit.map(function (h) {
    seen[h.hemm_type] = seen[h.hemm_type] || 0;
    return { h: h, n: seen[h.hemm_type]++ };
  }).sort(function (a, b) {
    return GROUP_ORDER.indexOf(a.h.skill_group) - GROUP_ORDER.indexOf(b.h.skill_group) ||
           a.n - b.n ||
           TYPE_ORDER.indexOf(a.h.hemm_type) - TYPE_ORDER.indexOf(b.h.hemm_type);
  }).map(function (x) { return x.h; });

  var assignments = [], idleHemms = [], idleOperators = [];
  GROUP_ORDER.forEach(function (group) {
    var machines = ranked.filter(function (h) { return h.skill_group === group; });
    var people = regular.filter(function (o) { return o.skill_group === group; })
      .map(function (o) { return { op: o, ot: false }; })
      .concat(overtime.filter(function (o) { return o.skill_group === group; })
      .map(function (o) { return { op: o, ot: true }; }));
    machines.forEach(function (h, i) {
      if (people[i]) assignments.push({ hemm: h, operator: people[i].op, overtime: people[i].ot });
      else idleHemms.push(h);
    });
    people.slice(machines.length).forEach(function (p) { idleOperators.push({ operator: p.op, overtime: p.ot }); });
  });

  return {
    assignments: assignments,
    idleHemms: idleHemms,
    idleOperators: idleOperators,
    notFit: hemms.filter(function (h) { return !isFit(h); }),
    availableCount: regular.length + overtime.length,
    overtimeCount: overtime.length,
    fitCount: fit.length,
    hemmCount: hemms.length
  };
}
