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
  const controls = document.getElementById('syncControls');
  const userPanel = document.getElementById('syncUser');
  const email = document.getElementById('syncUserEmail');
  if (!controls || !userPanel || !email) return;
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
  if (document.getElementById('tab-stats').classList.contains('active')) renderStats();
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
}

function deleteSubject(id) {
  state.subjects = state.subjects.filter(s => s.id !== id);
  saveState();
  renderSubjects();
  renderSubjectSelects();
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
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  const vals = days.map(d => state.sessions.filter(s => s.date === d).reduce((a,b) => a+b.mins, 0));
  const max = Math.max(...vals, 1);
  el.innerHTML = days.map((d, i) => {
    const pct = (vals[i] / max) * 100;
    const lbl = new Date(d).toLocaleDateString('en-GB', {weekday:'short'}).slice(0,2);
    return `<div class="bar-col">
      <div class="bar-val">${vals[i] ? Math.round(vals[i]) : ''}</div>
      <div class="bar-fill" style="height:${pct}%;background:var(--accent);opacity:${0.4 + 0.6*(pct/100)}"></div>
      <div class="bar-lbl">${lbl}</div>
    </div>`;
  }).join('');
}

function renderDonut() {
  const canvas = document.getElementById('donutCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 120, 120);
  const legend = document.getElementById('donutLegend');

  const data = state.subjects.map(s => ({ name: s.name, mins: s.totalMins || 0, color: s.color }))
    .filter(s => s.mins > 0);

  if (!data.length) {
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(60, 60, 45, 0, Math.PI * 2);
    ctx.stroke();
    legend.innerHTML = '<div style="font-size:11px;color:var(--text3);font-family:DM Mono,monospace">no data yet</div>';
    return;
  }

  const total = data.reduce((a, b) => a + b.mins, 0);
  let startAngle = -Math.PI / 2;

  data.forEach(d => {
    const slice = (d.mins / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(60, 60);
    ctx.arc(60, 60, 45, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    startAngle += slice;
  });

  ctx.beginPath();
  ctx.arc(60, 60, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#161616';
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
  if (id === 'stats') renderStats();
  if (id === 'timetable') buildTimetable();
  if (id === 'subjects') renderSubjects();
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

/* === MUSIC PLAYER === */
let musicPlayer = {
  audio: new Audio(),
  playlist: [],
  currentIndex: 0,
  isPlaying: false,
  repeat: 'none', // 'none', 'all', 'one'
  updateInterval: null,
  objectUrls: new Set(),
};

const MUSIC_DB_NAME = 'studydesk_audio';
const MUSIC_DB_VERSION = 1;
const MUSIC_STORE_NAME = 'tracks';

function openMusicDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MUSIC_DB_NAME, MUSIC_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MUSIC_STORE_NAME)) {
        db.createObjectStore(MUSIC_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveTrackBlob(id, blob) {
  return openMusicDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(MUSIC_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MUSIC_STORE_NAME);
    const req = store.put(blob, id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
}

function getTrackBlob(id) {
  return openMusicDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(MUSIC_STORE_NAME, 'readonly');
    const store = tx.objectStore(MUSIC_STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function deleteTrackBlob(id) {
  return openMusicDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(MUSIC_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MUSIC_STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
}

function restoreTrackUrls() {
  const promises = musicPlayer.playlist.map(track => {
    if (track.url) return Promise.resolve();
    return getTrackBlob(track.id).then(blob => {
      if (blob) {
        if (track.url && track.url.startsWith('blob:')) {
          URL.revokeObjectURL(track.url);
          musicPlayer.objectUrls.delete(track.url);
        }
        track.url = URL.createObjectURL(blob);
        musicPlayer.objectUrls.add(track.url);
      }
    }).catch(() => {});
  });
  return Promise.all(promises);
}

function initMusicPlayer() {
  musicPlayer.audio.addEventListener('ended', onTrackEnd);
  musicPlayer.audio.addEventListener('timeupdate', updatePlayerDisplay);
  musicPlayer.audio.addEventListener('loadedmetadata', updatePlayerDisplay);
  loadMusicState();
  renderPlaylist();
}

function loadMusicState() {
  try {
    const saved = localStorage.getItem('studydesk_music');
    if (saved) {
      const data = JSON.parse(saved);
      musicPlayer.playlist = data.playlist || [];
      musicPlayer.repeat = data.repeat || 'none';
      restoreTrackUrls();
    }
  } catch(e) {
    console.warn('Failed to load music state', e);
  }
}

function saveMusicState() {
  try {
    localStorage.setItem('studydesk_music', JSON.stringify({
      playlist: musicPlayer.playlist.map(track => ({
        id: track.id,
        name: track.name,
      })),
      repeat: musicPlayer.repeat,
    }));
  } catch(e) {
    console.warn('Unable to save music metadata to localStorage', e);
  }
}

function addTracksToPlaylist(event) {
  const files = Array.from(event.target.files);
  files.forEach((file, idx) => {
    const id = 'track_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2);
    const objectUrl = URL.createObjectURL(file);
    const track = {
      id,
      name: file.name.replace(/\.[^/.]+$/, ''),
      url: objectUrl,
      duration: 0,
    };

    musicPlayer.playlist.push(track);
    musicPlayer.objectUrls.add(objectUrl);
    saveTrackBlob(track.id, file).catch(err => {
      console.warn('Failed to save track blob', err);
    }).finally(() => {
      if (idx === files.length - 1) {
        saveMusicState();
        renderPlaylist();
      }
    });
  });
  event.target.value = '';
}

function renderPlaylist() {
  const playlistEl = document.getElementById('playlist');
  const count = document.getElementById('playlistCount');
  
  count.textContent = `(${musicPlayer.playlist.length})`;
  
  if (!musicPlayer.playlist.length) {
    playlistEl.innerHTML = '<div class="empty-playlist">add music to get started</div>';
    return;
  }
  
  playlistEl.innerHTML = musicPlayer.playlist.map((track, idx) => `
    <div class="playlist-item ${idx === musicPlayer.currentIndex ? 'active' : ''}" onclick="playTrack(${idx})">
      <i class="track-icon ti ti-music"></i>
      <span class="track-name">${track.name}</span>
      <button class="remove-track" onclick="removeTrack(${idx}, event)"><i class="ti ti-x"></i></button>
    </div>
  `).join('');
}

function playTrack(index) {
  if (index < 0 || index >= musicPlayer.playlist.length) return;

  musicPlayer.currentIndex = index;
  const track = musicPlayer.playlist[index];

  if (track.url) {
    musicPlayer.audio.src = track.url;
    musicPlayer.audio.play();
    musicPlayer.isPlaying = true;
    document.getElementById('playerPlayPause').innerHTML = '<i class="ti ti-player-pause" aria-hidden="true"></i>';
    document.getElementById('nowPlaying').textContent = track.name;
    renderPlaylist();
    return;
  }

  getTrackBlob(track.id).then(blob => {
    if (!blob) throw new Error('Track blob missing');
    const objectUrl = URL.createObjectURL(blob);
    track.url = objectUrl;
    musicPlayer.objectUrls.add(objectUrl);
    musicPlayer.audio.src = track.url;
    musicPlayer.audio.play();
    musicPlayer.isPlaying = true;
    document.getElementById('playerPlayPause').innerHTML = '<i class="ti ti-player-pause" aria-hidden="true"></i>';
    document.getElementById('nowPlaying').textContent = track.name;
    renderPlaylist();
  }).catch(() => {
    alert('Unable to play this track. The audio file may no longer be available.');
    removeTrack(index, { stopPropagation: () => {} });
  });
}

function toggleMusicPlayer() {
  if (!musicPlayer.playlist.length) return;
  
  if (musicPlayer.isPlaying) {
    musicPlayer.audio.pause();
    musicPlayer.isPlaying = false;
    document.getElementById('playerPlayPause').innerHTML = '<i class="ti ti-player-play" aria-hidden="true"></i>';
  } else {
    if (musicPlayer.audio.src === '') {
      playTrack(0);
    } else {
      musicPlayer.audio.play();
      musicPlayer.isPlaying = true;
      document.getElementById('playerPlayPause').innerHTML = '<i class="ti ti-player-pause" aria-hidden="true"></i>';
    }
  }
}

function nextTrack() {
  if (!musicPlayer.playlist.length) return;
  const next = (musicPlayer.currentIndex + 1) % musicPlayer.playlist.length;
  playTrack(next);
}

function previousTrack() {
  if (!musicPlayer.playlist.length) return;
  const prev = (musicPlayer.currentIndex - 1 + musicPlayer.playlist.length) % musicPlayer.playlist.length;
  playTrack(prev);
}

function onTrackEnd() {
  if (musicPlayer.repeat === 'one') {
    musicPlayer.audio.currentTime = 0;
    musicPlayer.audio.play();
  } else if (musicPlayer.repeat === 'all' || musicPlayer.currentIndex < musicPlayer.playlist.length - 1) {
    nextTrack();
  } else {
    musicPlayer.isPlaying = false;
    document.getElementById('playerPlayPause').innerHTML = '<i class="ti ti-player-play" aria-hidden="true"></i>';
  }
}

function toggleRepeat() {
  const states = ['none', 'all', 'one'];
  const current = states.indexOf(musicPlayer.repeat);
  musicPlayer.repeat = states[(current + 1) % states.length];
  
  const btn = document.getElementById('repeatBtn');
  if (musicPlayer.repeat === 'none') {
    btn.style.color = 'var(--text3)';
    btn.style.opacity = '0.6';
  } else if (musicPlayer.repeat === 'all') {
    btn.style.color = 'var(--blue)';
    btn.style.opacity = '1';
  } else {
    btn.style.color = 'var(--blue)';
    btn.style.opacity = '1';
    btn.innerHTML = '<i class="ti ti-repeat-once" aria-hidden="true"></i>';
    setTimeout(() => {
      btn.innerHTML = '<i class="ti ti-repeat" aria-hidden="true"></i>';
    }, 500);
  }
  
  saveMusicState();
}

function setVolume(value) {
  musicPlayer.audio.volume = value / 100;
}

function updatePlayerDisplay() {
  const current = musicPlayer.audio.currentTime || 0;
  const duration = musicPlayer.audio.duration || 0;
  
  document.getElementById('playerTime').textContent = formatTime(Math.floor(current));
  document.getElementById('playerDuration').textContent = formatTime(Math.floor(duration));
  
  const percentage = duration > 0 ? (current / duration) * 100 : 0;
  document.getElementById('progressFill').style.width = percentage + '%';
  document.getElementById('progressThumb').style.left = percentage + '%';
}

function removeTrack(index, event) {
  event.stopPropagation();
  const track = musicPlayer.playlist[index];
  if (!track) return;

  if (track.url && track.url.startsWith('blob:')) {
    URL.revokeObjectURL(track.url);
    musicPlayer.objectUrls.delete(track.url);
  }

  deleteTrackBlob(track.id).catch(() => {});
  musicPlayer.playlist.splice(index, 1);

  if (index === musicPlayer.currentIndex) {
    if (musicPlayer.isPlaying) {
      musicPlayer.audio.pause();
      musicPlayer.isPlaying = false;
    }
    if (musicPlayer.playlist.length > 0) {
      playTrack(Math.min(index, musicPlayer.playlist.length - 1));
    } else {
      document.getElementById('nowPlaying').textContent = 'no track selected';
      document.getElementById('playerPlayPause').innerHTML = '<i class="ti ti-player-play" aria-hidden="true"></i>';
    }
  } else if (index < musicPlayer.currentIndex) {
    musicPlayer.currentIndex--;
  }

  saveMusicState();
  renderPlaylist();
}

function setupProgressBarClick() {
  const progressBar = document.getElementById('progressBar');
  if (!progressBar) return;
  
  progressBar.addEventListener('click', (e) => {
    if (!musicPlayer.audio.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    musicPlayer.audio.currentTime = percent * musicPlayer.audio.duration;
  });
}

// Initialize music player on page load
window.addEventListener('load', () => {
  initMusicPlayer();
  setupProgressBarClick();
  setVolume(70);
});

Object.assign(window, {
  addSubject,
  addTracksToPlaylist,
  clearTimetable,
  closeTTModal,
  createCloudAccount,
  deleteSubject,
  nextTrack,
  playTrack,
  previousTrack,
  removeTrack,
  removeTTEntry,
  resetTimer,
  saveState,
  saveTTEntry,
  setVolume,
  signInToCloud,
  signOutCloud,
  skipPhase,
  switchTab,
  toggleCheck,
  toggleMusicPlayer,
  toggleRepeat,
  toggleTimer,
  updateTimerSettings,
});
