import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const HOURS = Array.from({length: 16}, (_,i) => `${(i+7).toString().padStart(2,'0')}:00`);
const COLORS = ['#d4a853','#5b9cf6','#4caf7d','#e05c5c','#9b72cf','#e08c5c','#5ce0d0','#e05cab'];
const LOCAL_STATE_KEY = 'studydesk_v2';

const firebaseConfig = {
  apiKey: "AIzaSyCoywhnVdRzvf4lBljDvgX0j_e_LDswabI",
  authDomain: "studydesk-tracker.firebaseapp.com",
  projectId: "studydesk-tracker",
  storageBucket: "studydesk-tracker.firebasestorage.app",
  messagingSenderId: "535728777961",
  appId: "1:535728777961:web:53be76e15cc22bc08c9e78",
  measurementId: "G-4J3CQWHKCB"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

let state = {
  subjects: [],
  sessions: [],
  timetable: {},
  streak: [],
};

let timer = {
  running: false,
  interval: null,
  phase: 'focus',
  elapsed: 0,
  sessionCount: 0,
  total: 0,
};

let cloudUser = null;
let cloudUnsubscribe = null;
let cloudSaveTimer = null;
let applyingCloudState = false;

function normalizeState(data) {
  const next = data && typeof data === 'object' ? data : {};
  return {
    subjects: Array.isArray(next.subjects) ? next.subjects : [],
    sessions: Array.isArray(next.sessions) ? next.sessions : [],
    timetable: next.timetable && typeof next.timetable === 'object' ? next.timetable : {},
    streak: Array.isArray(next.streak) ? next.streak : [],
  };
}

function recalculateSubjectStats(nextState) {
  const subjects = nextState.subjects.map(subject => ({
    ...subject,
    totalMins: 0,
    sessions: 0,
  }));
  nextState.sessions.forEach(session => {
    if (!session.subjectId) return;
    const subject = subjects.find(item => item.id === session.subjectId);
    if (!subject) return;
    subject.totalMins += session.mins || 0;
    subject.sessions += 1;
  });
  return { ...nextState, subjects };
}

function mergeStates(remoteData, localData) {
  const remote = normalizeState(remoteData);
  const local = normalizeState(localData);
  const subjects = [...remote.subjects];
  local.subjects.forEach(subject => {
    const index = subjects.findIndex(item => item.id === subject.id);
    if (index >= 0) subjects[index] = { ...subjects[index], ...subject };
    else subjects.push(subject);
  });

  const sessionMap = new Map();
  [...remote.sessions, ...local.sessions].forEach(session => {
    if (session && session.id) sessionMap.set(String(session.id), session);
  });

  const merged = {
    subjects,
    sessions: [...sessionMap.values()].sort((a, b) => String(a.id).localeCompare(String(b.id))),
    timetable: { ...remote.timetable, ...local.timetable },
    streak: [...new Set([...remote.streak, ...local.streak])].sort(),
  };

  return recalculateSubjectStats(merged);
}

function loadState() {
  try {
    const s = localStorage.getItem(LOCAL_STATE_KEY);
    if (s) state = normalizeState(JSON.parse(s));
  } catch(e) {}
  state = normalizeState(state);
}

function saveState() {
  localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
  queueCloudSave();
}

function emptyState() {
  return {
    subjects: [],
    sessions: [],
    timetable: {},
    streak: [],
  };
}

function getUserDocRef(user = cloudUser) {
  return user ? doc(db, 'users', user.uid) : null;
}

function setSyncStatus(message, type = '') {
  const status = document.getElementById('syncStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `sync-status ${type}`.trim();
}

function updateSyncUI() {
  const landing = document.getElementById('landingPage');
  const appShell = document.getElementById('appShell');
  const controls = document.getElementById('syncControls');
  const userPanel = document.getElementById('syncUser');
  const email = document.getElementById('syncUserEmail');
  if (!controls || !userPanel || !email) return;
  if (landing) landing.hidden = !!cloudUser;
  if (appShell) appShell.hidden = !cloudUser;
  controls.hidden = !!cloudUser;
  userPanel.hidden = !cloudUser;
  email.textContent = cloudUser ? cloudUser.email : '';
}

function queueCloudSave() {
  if (!cloudUser || applyingCloudState) return;
  clearTimeout(cloudSaveTimer);
  setSyncStatus('saving to cloud...', 'busy');
  cloudSaveTimer = setTimeout(pushCloudState, 700);
}

async function pushCloudState() {
  if (!cloudUser) return;
  try {
    await setDoc(getUserDocRef(), {
      state: normalizeState(state),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    setSyncStatus('cloud saved', 'online');
  } catch (error) {
    setSyncStatus(error.message || 'cloud save failed', 'error');
  }
}

function renderApp() {
  renderSubjects();
  renderSubjectSelects();
  renderLog();
  updateTimerDisplay();
  updateTimerSettings();
  updateTodayDisplay();
  updateToggleUI('autoBreak');
  updateToggleUI('soundOn');
  renderStats();
  if (document.getElementById('tab-timetable').classList.contains('active')) buildTimetable();
}

function clearLocalStudyView() {
  applyingCloudState = true;
  state = emptyState();
  localStorage.removeItem(LOCAL_STATE_KEY);
  renderApp();
  applyingCloudState = false;
}

async function createCloudAccount() {
  const email = document.getElementById('syncEmail').value.trim();
  const password = document.getElementById('syncPassword').value;
  if (!email || !password) {
    setSyncStatus('enter email and password', 'error');
    return;
  }
  setSyncStatus('creating account...', 'busy');
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    document.getElementById('syncPassword').value = '';
  } catch (error) {
    setSyncStatus(error.message || 'account failed', 'error');
  }
}

async function signInToCloud() {
  const email = document.getElementById('syncEmail').value.trim();
  const password = document.getElementById('syncPassword').value;
  if (!email || !password) {
    setSyncStatus('enter email and password', 'error');
    return;
  }
  setSyncStatus('signing in...', 'busy');
  try {
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById('syncPassword').value = '';
  } catch (error) {
    setSyncStatus(error.message || 'sign in failed', 'error');
  }
}

async function signOutCloud() {
  setSyncStatus('signing out...', 'busy');
  try {
    await signOut(auth);
    clearLocalStudyView();
    setSyncStatus('signed out');
  } catch (error) {
    setSyncStatus(error.message || 'sign out failed', 'error');
  }
}

function subscribeToCloud(user) {
  if (cloudUnsubscribe) cloudUnsubscribe();
  cloudUnsubscribe = onSnapshot(getUserDocRef(user), (snapshot) => {
    if (!snapshot.exists()) return;
    const remoteState = snapshot.data().state;
    if (!remoteState) return;
    applyingCloudState = true;
    state = normalizeState(remoteState);
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
    renderApp();
    applyingCloudState = false;
    setSyncStatus('cloud synced', 'online');
  }, (error) => {
    setSyncStatus(error.message || 'cloud sync failed', 'error');
  });
}

onAuthStateChanged(auth, async (user) => {
  cloudUser = user;
  updateSyncUI();

  if (!user) {
    if (cloudUnsubscribe) cloudUnsubscribe();
    cloudUnsubscribe = null;
    setSyncStatus('offline save');
    return;
  }

  setSyncStatus('loading cloud...', 'busy');
  try {
    const snapshot = await getDoc(getUserDocRef(user));
    if (snapshot.exists() && snapshot.data().state) {
      const localState = normalizeState(state);
      const cloudState = normalizeState(snapshot.data().state);
      const mergedState = mergeStates(cloudState, localState);
      const needsCloudUpdate = JSON.stringify(mergedState) !== JSON.stringify(cloudState);
      applyingCloudState = true;
      state = mergedState;
      localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
      renderApp();
      applyingCloudState = false;
      if (needsCloudUpdate) await pushCloudState();
    } else {
      await pushCloudState();
    }
    subscribeToCloud(user);
    setSyncStatus('cloud synced', 'online');
  } catch (error) {
    setSyncStatus(error.message || 'cloud load failed', 'error');
  }
});

function getFocusMins() { return parseInt(document.getElementById('focusDur').value); }
function getShortBreak() { return parseInt(document.getElementById('shortBreak').value); }
function getLongBreak() { return parseInt(document.getElementById('longBreak').value); }
function getSessionsBeforeLong() { return parseInt(document.getElementById('sessionsBeforeLong').value); }

function getCurrentPhaseMins() {
  if (timer.phase === 'focus') return getFocusMins();
  if (timer.phase === 'short') return getShortBreak();
  return getLongBreak();
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function getPhaseTotal() {
  return getCurrentPhaseMins() * 60;
}

function updateTimerDisplay() {
  const total = getPhaseTotal();
  const remaining = total - timer.elapsed;
  document.getElementById('timerDisplay').textContent = formatTime(Math.max(0, remaining));
  const circumference = 603.19;
  const offset = circumference * (timer.elapsed / total);
  document.getElementById('progressRing').style.strokeDashoffset = offset;
  const ringEl = document.getElementById('progressRing');
  if (timer.phase === 'focus') ringEl.setAttribute('stroke', '#d4a853');
  else if (timer.phase === 'short') ringEl.setAttribute('stroke', '#5b9cf6');
  else ringEl.setAttribute('stroke', '#4caf7d');
  document.getElementById('phaseLabel').textContent = timer.phase === 'focus' ? 'focus' : timer.phase === 'short' ? 'short break' : 'long break';
  document.getElementById('sessionNum').textContent = timer.sessionCount + 1;
  document.getElementById('timerSubtext').textContent = timer.phase === 'focus' ? 'focus time' : 'break time';
}

function updateTimerSettings() {
  document.getElementById('focusVal').textContent = getFocusMins() + ' min';
  document.getElementById('shortVal').textContent = getShortBreak() + ' min';
  document.getElementById('longVal').textContent = getLongBreak() + ' min';
  document.getElementById('sessionsVal').textContent = getSessionsBeforeLong();
  if (!timer.running) {
    timer.elapsed = 0;
    updateTimerDisplay();
  }
}

function toggleTimer() {
  if (timer.running) {
    clearInterval(timer.interval);
    timer.running = false;
    document.getElementById('playPauseBtn').innerHTML = '<i class="ti ti-player-play"></i>';
  } else {
    timer.running = true;
    document.getElementById('playPauseBtn').innerHTML = '<i class="ti ti-player-pause"></i>';
    timer.interval = setInterval(() => {
      timer.elapsed++;
      if (timer.phase === 'focus') timer.total++;
      updateTimerDisplay();
      updateTodayDisplay();
      if (timer.elapsed >= getPhaseTotal()) {
        phaseComplete();
      }
    }, 1000);
  }
}

function phaseComplete() {
  clearInterval(timer.interval);
  timer.running = false;
  document.getElementById('playPauseBtn').innerHTML = '<i class="ti ti-player-play"></i>';
  if (document.getElementById('soundOn').checked) playBeep();

  if (timer.phase === 'focus') {
    const subjectId = document.getElementById('pomoSubjectSelect').value;
    const mins = getFocusMins();
    logSession(subjectId, mins);
    timer.sessionCount++;
    if (timer.sessionCount % getSessionsBeforeLong() === 0) {
      timer.phase = 'long';
    } else {
      timer.phase = 'short';
    }
  } else {
    timer.phase = 'focus';
  }

  timer.elapsed = 0;
  updateTimerDisplay();

  if (document.getElementById('autoBreak').checked) {
    setTimeout(toggleTimer, 500);
  }
}

function skipPhase() {
  if (timer.running) {
    clearInterval(timer.interval);
    timer.running = false;
    document.getElementById('playPauseBtn').innerHTML = '<i class="ti ti-player-play"></i>';
  }
  if (timer.phase === 'focus') {
    timer.phase = timer.sessionCount % getSessionsBeforeLong() === getSessionsBeforeLong()-1 ? 'long' : 'short';
  } else {
    timer.phase = 'focus';
  }
  timer.elapsed = 0;
  updateTimerDisplay();
}

function resetTimer() {
  if (timer.running) {
    clearInterval(timer.interval);
    timer.running = false;
    document.getElementById('playPauseBtn').innerHTML = '<i class="ti ti-player-play"></i>';
  }
  timer.phase = 'focus';
  timer.elapsed = 0;
  updateTimerDisplay();
}

function logSession(subjectId, mins) {
  const now = new Date();
  const entry = {
    id: Date.now(),
    subjectId,
    mins,
    date: now.toISOString().split('T')[0],
    time: now.toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'}),
  };
  state.sessions.push(entry);
  if (subjectId) {
    const subj = state.subjects.find(s => s.id === subjectId);
    if (subj) {
      subj.totalMins = (subj.totalMins || 0) + mins;
      subj.sessions = (subj.sessions || 0) + 1;
    }
  }
  updateStreak(entry.date);
  saveState();
  renderLog();
  renderSubjects();
  updateTodayDisplay();
  renderStats();
}

function updateStreak(date) {
  if (!state.streak.includes(date)) {
    state.streak.push(date);
  }
}

function updateTodayDisplay() {
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = state.sessions.filter(s => s.date === today);
  const todayMins = todaySessions.reduce((a,b) => a + b.mins, 0) + Math.floor(timer.total / 60);
  const h = Math.floor(todayMins / 60);
  const m = todayMins % 60;
  document.getElementById('todayFocusDisplay').textContent = `${h}h ${m}m`;
  document.getElementById('todaySessionsDisplay').textContent = `${todaySessions.length} completed sessions`;
}

function renderLog() {
  const logs = state.sessions.slice(-5).reverse();
  const el = document.getElementById('logList');
  if (!logs.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px;">no sessions yet</div>'; return; }
  el.innerHTML = logs.map(l => {
    const subj = l.subjectId ? state.subjects.find(s => s.id === l.subjectId) : null;
    return `<div class="log-item">
      <div class="log-dot"></div>
      <span>${subj ? subj.name : 'untracked'} · ${l.mins} min</span>
      <span class="log-time">${l.time}</span>
    </div>`;
  }).join('');
}

function addSubject() {
  const name = document.getElementById('newSubjectName').value.trim();
  if (!name) return;
  const color = document.getElementById('newSubjectColor').value;
  const subj = { id: 'subj_' + Date.now(), name, color, totalMins: 0, sessions: 0 };
  state.subjects.push(subj);
  document.getElementById('newSubjectName').value = '';
  saveState();
  renderSubjects();
  renderSubjectSelects();
  renderStats();
}

function deleteSubject(id) {
  state.subjects = state.subjects.filter(s => s.id !== id);
  saveState();
  renderSubjects();
  renderSubjectSelects();
  renderStats();
}

function renderSubjects() {
  const grid = document.getElementById('subjectsGrid');
  if (!state.subjects.length) {
    grid.innerHTML = '<div class="empty-state" id="subjectsEmpty">no subjects yet — add one below</div>';
    document.getElementById('subjectCount').textContent = '0 subjects';
    return;
  }
  document.getElementById('subjectCount').textContent = state.subjects.length + ' subject' + (state.subjects.length > 1 ? 's' : '');
  const maxMins = Math.max(...state.subjects.map(s => s.totalMins || 0), 1);
  grid.innerHTML = state.subjects.map(s => {
    const h = Math.floor((s.totalMins||0) / 60);
    const m = (s.totalMins||0) % 60;
    const pct = Math.round(((s.totalMins||0) / maxMins) * 100);
    return `<div class="subject-card" style="--subject-color:${s.color}">
      <div class="subject-actions">
        <button class="icon-btn" onclick="deleteSubject('${s.id}')" title="delete"><i class="ti ti-trash"></i></button>
      </div>
      <div class="subject-name">${s.name}</div>
      <div class="subject-time">${h}h ${m}m</div>
      <div class="subject-sessions">${s.sessions||0} sessions</div>
      <div class="subject-bar-wrap"><div class="subject-bar" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

function renderSubjectSelects() {
  const opts = state.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  const placeholder = '<option value="">— select subject —</option>';
  document.getElementById('pomoSubjectSelect').innerHTML = placeholder + opts;
  document.getElementById('modalSubject').innerHTML = opts || '<option value="">no subjects yet</option>';
}

function renderStats() {
  if (!document.getElementById('statTotalHours')) return;
  const totalMins = state.sessions.reduce((a, b) => a + b.mins, 0);
  document.getElementById('statTotalHours').textContent = (totalMins / 60).toFixed(1);
  document.getElementById('statSessions').textContent = state.sessions.length;
  document.getElementById('statToday').textContent = (() => {
    const today = new Date().toISOString().split('T')[0];
    return state.sessions.filter(s => s.date === today).reduce((a,b) => a+b.mins, 0);
  })();

  const streak = calcStreak();
  document.getElementById('statStreak').innerHTML = `${streak} <span style="font-size:14px;color:var(--text3)">days</span>`;

  renderWeekChart();
  renderDonut();
  renderStreakGrid();
}

function calcStreak() {
  const dates = [...new Set(state.streak)].sort();
  if (!dates.length) return 0;
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  let check = new Date(today);
  for (let i = dates.length - 1; i >= 0; i--) {
    const d = check.toISOString().split('T')[0];
    if (dates[dates.length - 1 - (dates.length - 1 - i)] === d || dates.includes(d)) {
      if (dates.includes(d)) streak++;
      else break;
      check.setDate(check.getDate() - 1);
    } else break;
  }
  return streak;
}

function renderWeekChart() {
  const el = document.getElementById('weekChart');
  if (!el) return;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  const vals = days.map(d => state.sessions.filter(s => s.date === d).reduce((a,b) => a+b.mins, 0));
  const max = Math.max(...vals, 1);
  const points = vals.map((value, index) => {
    const x = 18 + index * 44;
    const y = 124 - ((value / max) * 92);
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `18,136 ${points} 282,136`;
  const labels = days.map((d, i) => {
    const x = 18 + i * 44;
    const lbl = new Date(d).toLocaleDateString('en-GB', {weekday:'short'}).slice(0,3);
    return `<span style="left:${(x / 300) * 100}%">${lbl}</span>`;
  }).join('');
  el.innerHTML = `
    <div class="line-chart">
      <svg viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="weekArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(22,136,255,0.46)" />
            <stop offset="100%" stop-color="rgba(22,136,255,0)" />
          </linearGradient>
        </defs>
        <polygon points="${areaPoints}" fill="url(#weekArea)"></polygon>
        <polyline points="${points}" fill="none" stroke="#1688ff" stroke-width="5" stroke-linecap="square" stroke-linejoin="miter"></polyline>
      </svg>
      <div class="line-labels">${labels}</div>
    </div>`;
}

function renderDonut() {
  const canvas = document.getElementById('donutCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const center = size / 2;
  const outerRadius = size * 0.38;
  const innerRadius = size * 0.24;
  ctx.clearRect(0, 0, size, size);
  const legend = document.getElementById('donutLegend');

  const data = state.subjects.map(s => ({ name: s.name, mins: s.totalMins || 0, color: s.color }))
    .filter(s => s.mins > 0);

  if (!data.length) {
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(center, center, outerRadius, 0, Math.PI * 2);
    ctx.stroke();
    legend.innerHTML = '<div style="font-size:11px;color:var(--text3);font-family:DM Mono,monospace">no data yet</div>';
    return;
  }

  const total = data.reduce((a, b) => a + b.mins, 0);
  let startAngle = -Math.PI / 2;

  data.forEach(d => {
    const slice = (d.mins / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, outerRadius, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    startAngle += slice;
  });

  ctx.beginPath();
  ctx.arc(center, center, innerRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#12171d';
  ctx.fill();

  legend.innerHTML = data.map(d => {
    const pct = Math.round((d.mins / total) * 100);
    return `<div class="legend-row">
      <div class="legend-dot" style="background:${d.color}"></div>
      <span class="legend-label">${d.name}</span>
      <span class="legend-val">${pct}%</span>
    </div>`;
  }).join('');
}

function renderStreakGrid() {
  const el = document.getElementById('streakGrid');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const cells = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const done = state.streak.includes(ds);
    const isToday = ds === today;
    const lbl = d.getDate();
    cells.push(`<div class="streak-day ${done ? 'done' : ''} ${isToday ? 'today' : ''}" title="${ds}">${lbl}</div>`);
  }
  el.innerHTML = cells.join('');
}

/* === TIMETABLE === */
let ttPendingCell = null;

function buildTimetable() {
  const grid = document.getElementById('ttGrid');
  const todayIdx = (new Date().getDay() + 6) % 7;

  let html = `<div class="tt-header">
    <div class="tt-header-cell"></div>
    ${DAYS.map((d,i) => `<div class="tt-header-cell ${i===todayIdx?'today-col':''}">${d}</div>`).join('')}
  </div>`;

  HOURS.forEach((h, hi) => {
    html += `<div class="tt-row"><div class="tt-time">${h}</div>`;
    DAYS.forEach((d, di) => {
      const key = `${di}_${hi}`;
      const entry = state.timetable[key];
      const subj = entry && state.subjects.find(s => s.id === entry.subjectId);
      const isToday = di === todayIdx;
      let inner = '';
      if (entry && subj) {
        inner = `<div class="tt-entry" style="background:${subj.color}20;color:${subj.color};border-left:2px solid ${subj.color}">
          ${subj.name}${entry.label ? '<br><span style="font-size:10px;opacity:0.7">'+entry.label+'</span>' : ''}
          <span class="tt-del" onclick="removeTTEntry('${key}',event)">×</span>
        </div>`;
      }
      html += `<div class="tt-cell ${isToday?'today-col':''}" onclick="openTTModal('${key}')">${inner}</div>`;
    });
    html += `</div>`;
  });

  grid.innerHTML = html;
}

function openTTModal(key) {
  if (!state.subjects.length) { alert('Add a subject first!'); return; }
  ttPendingCell = key;
  renderSubjectSelects();
  document.getElementById('modalLabel').value = '';
  document.getElementById('ttModal').classList.add('open');
}

function closeTTModal() {
  document.getElementById('ttModal').classList.remove('open');
  ttPendingCell = null;
}

function saveTTEntry() {
  if (!ttPendingCell) return;
  const subjectId = document.getElementById('modalSubject').value;
  const label = document.getElementById('modalLabel').value.trim();
  if (!subjectId) return;
  state.timetable[ttPendingCell] = { subjectId, label };
  saveState();
  closeTTModal();
  buildTimetable();
}

function removeTTEntry(key, e) {
  e.stopPropagation();
  delete state.timetable[key];
  saveState();
  buildTimetable();
}

function clearTimetable() {
  if (confirm('Clear all timetable entries?')) {
    state.timetable = {};
    saveState();
    buildTimetable();
  }
}

/* === TOGGLES === */
function toggleCheck(id) {
  updateToggleUI(id);
  saveState();
}

function updateToggleUI(id) {
  const el = document.getElementById(id);
  const isOn = el.checked;
  const name = id === 'autoBreak' ? 'Break' : 'Sound';
  const toggle = document.getElementById(`toggle${name === 'Break' ? 'AutoBreak' : 'SoundOn'}`);
  const knob = document.getElementById(`toggleKnob${name}`);
  toggle.style.background = isOn ? 'var(--accent)' : 'var(--bg4)';
  knob.style.transform = isOn ? 'translateX(16px)' : 'translateX(0)';
  knob.style.background = isOn ? '#0f0f0f' : 'var(--text3)';
}

/* === SOUND === */
function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch(e) {}
}

/* === NAV === */
function switchTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  document.getElementById('nav-' + id).classList.add('active');
  if (id === 'timetable') buildTimetable();
  if (id === 'subjects') renderSubjects();
  if (id === 'pomo') renderStats();
}

/* === CLOCK === */
function updateClock() {
  const now = new Date();
  document.getElementById('liveClock').textContent = now.toLocaleTimeString('en-GB');
  document.getElementById('dateDisplay').textContent = now.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'}).toLowerCase();
}

/* === INIT === */
loadState();
renderApp();
updateSyncUI();
updateClock();
setInterval(updateClock, 1000);

Object.assign(window, {
  addSubject,
  clearTimetable,
  closeTTModal,
  createCloudAccount,
  deleteSubject,
  openTTModal,
  removeTTEntry,
  resetTimer,
  saveState,
  saveTTEntry,
  signInToCloud,
  signOutCloud,
  skipPhase,
  switchTab,
  toggleCheck,
  toggleTimer,
  updateTimerSettings,
});
