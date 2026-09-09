(function () {
  'use strict';

  // --- Constants & Storage Keys ---
  const STORAGE_KEYS = {
    PAC: 'jln_pac_cases_v1',
    OT: 'jln_ot_cases_v1',
    OT_LIST: 'jln_ot_list_v1',
    THEME: 'jln_theme_v1'
  };

  const DEFAULT_OTS = [
    'OT A', 'Lap OT', 'SSR', 'SSE',
    'OT B', 'Septic OT', 'Emergency OT', 'Robotic OT'
  ];

  // --- State Management ---
  const state = {
    currentTab: 'pac', // 'pac' | 'ot' | 'dashboard' | 'settings'
    pacCases: [],
    otCases: [],
    otList: DEFAULT_OTS,
    searchQuery: '',
    selectedDate: new Date().toISOString().slice(0, 10),
    pacStatusFilter: 'ALL',
    otFilter: 'ALL',
    theme: 'light',
    syncStatus: 'offline',
    editingPacId: null,
    activeOtCaseId: null
  };

  // --- Utility Functions ---
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);
  const escapeHtml = (val) => {
    if (val == null) return '';
    const div = document.createElement('div');
    div.textContent = String(val);
    return div.innerHTML;
  };
  const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const formatTimeNow = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const formatDateLabel = (isoDate) => {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return new Date(+parts[0], +parts[1] - 1, +parts[2]).toLocaleDateString([], {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  function calculateMAP(bpStr) {
    if (!bpStr || !bpStr.includes('/')) return null;
    const parts = bpStr.split('/').map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const sbp = parts[0], dbp = parts[1];
      return Math.round(dbp + (sbp - dbp) / 3);
    }
    return null;
  }

  // --- Theme Management ---
  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    setTheme(saved);
    const themeBtn = $('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const next = state.theme === 'light' ? 'dark' : 'light';
        setTheme(next);
      });
    }
  }

  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    const themeBtn = $('themeToggleBtn');
    if (themeBtn) {
      themeBtn.innerHTML = theme === 'dark'
        ? '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      themeBtn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark / OT Mode';
    }
  }

  // --- Storage & Cloud Sync ---
  function updateSyncPill(statusText, type) {
    state.syncStatus = type;
    const pill = $('syncPill');
    const label = $('syncLabel');
    if (!pill || !label) return;
    pill.className = 'sync-pill ' + type;
    label.textContent = statusText;
  }

  function loadLocalData() {
    try {
      state.pacCases = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAC) || '[]');
      if (!Array.isArray(state.pacCases)) state.pacCases = [];
    } catch (_) { state.pacCases = []; }

    try {
      state.otCases = JSON.parse(localStorage.getItem(STORAGE_KEYS.OT) || '[]');
      if (!Array.isArray(state.otCases)) state.otCases = [];
    } catch (_) { state.otCases = []; }

    try {
      const customOts = JSON.parse(localStorage.getItem(STORAGE_KEYS.OT_LIST));
      if (Array.isArray(customOts) && customOts.length) state.otList = customOts;
    } catch (_) {}
  }

  function saveLocalData() {
    localStorage.setItem(STORAGE_KEYS.PAC, JSON.stringify(state.pacCases));
    localStorage.setItem(STORAGE_KEYS.OT, JSON.stringify(state.otCases));
    localStorage.setItem(STORAGE_KEYS.OT_LIST, JSON.stringify(state.otList));
  }

  async function syncWithSupabase() {
    if (!window.supabaseClient) {
      updateSyncPill('Local Only', 'offline');
      return;
    }

    updateSyncPill('Syncing...', 'syncing');

    try {
      const pacRes = await window.supabaseClient.from('pac_cases').select('*').order('created_at', { ascending: false });
      if (!pacRes.error && Array.isArray(pacRes.data)) {
        if (pacRes.data.length >= state.pacCases.length) {
          state.pacCases = pacRes.data;
          localStorage.setItem(STORAGE_KEYS.PAC, JSON.stringify(state.pacCases));
        } else if (state.pacCases.length > 0) {
          await window.supabaseClient.from('pac_cases').upsert(state.pacCases, { onConflict: 'id' });
        }
      }

      const otRes = await window.supabaseClient.from('ot_cases').select('*').order('created_at', { ascending: false });
      if (!otRes.error && Array.isArray(otRes.data)) {
        if (otRes.data.length >= state.otCases.length) {
          state.otCases = otRes.data;
          localStorage.setItem(STORAGE_KEYS.OT, JSON.stringify(state.otCases));
        } else if (state.otCases.length > 0) {
          await window.supabaseClient.from('ot_cases').upsert(state.otCases, { onConflict: 'id' });
        }
      }

      updateSyncPill('Cloud Synced', 'online');
    } catch (err) {
      console.warn('Supabase sync notice:', err);
      updateSyncPill('Offline / Local', 'offline');
    }
  }

  async function pushPacToCloud(caseItem) {
    if (!window.supabaseClient) return;
    try {
      await window.supabaseClient.from('pac_cases').upsert([caseItem], { onConflict: 'id' });
      updateSyncPill('Synced', 'online');
    } catch (_) {}
  }

  async function pushOtToCloud(caseItem) {
    if (!window.supabaseClient) return;
    try {
      await window.supabaseClient.from('ot_cases').upsert([caseItem], { onConflict: 'id' });
      updateSyncPill('Synced', 'online');
    } catch (_) {}
  }

  async function deletePacFromCloud(id) {
    if (!window.supabaseClient) return;
    try {
      await window.supabaseClient.from('pac_cases').delete(id);
    } catch (_) {}
  }

  async function deleteOtFromCloud(id) {
    if (!window.supabaseClient) return;
    try {
      await window.supabaseClient.from('ot_cases').delete(id);
    } catch (_) {}
  }

  // --- Router & Navigation ---
  function switchTab(tabId) {
    state.currentTab = tabId;

    $$('.nav-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    $$('.bottom-nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    $$('.tab-view').forEach((view) => {
      view.style.display = view.id === `${tabId}View` ? 'block' : 'none';
    });

    window.history.replaceState(null, '', `#${tabId}`);
    render();
  }

  function handleHashRoute() {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (['pac', 'ot', 'dashboard', 'settings'].includes(hash)) {
      switchTab(hash);
    } else {
      switchTab('pac');
    }
  }

  // --- Modal Helpers ---
  function openModal(modalId) {
    const el = $(modalId);
    if (el) el.classList.add('open');
  }

  function closeModal(modalId) {
    const el = $(modalId);
    if (el) el.classList.remove('open');
  }

  function setupModals() {
    $$('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal(backdrop.id);
      });
    });
    $$('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        closeModal(btn.dataset.closeModal);
      });
    });
  }

  // --- PAC Module ---
  function getFilteredPacCases() {
    return state.pacCases.filter((c) => {
      if (state.pacStatusFilter !== 'ALL' && c.status !== state.pacStatusFilter) {
        return false;
      }
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        const haystack = [
          c.name, c.crNo, c.diagnosis, c.procedure, c.resident, c.consultant
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  function openNewPacModal(prefill = {}) {
    state.editingPacId = null;
    const form = $('pacForm');
    form.reset();
    $('pacModalTitle').textContent = 'New Pre-Anaesthesia Check-up';
    $('deletePacBtn').style.display = 'none';

    Object.keys(prefill).forEach((k) => {
      if (form.elements[k]) form.elements[k].value = prefill[k] || '';
    });

    if (form.adviceTime) {
      const nowIso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      form.adviceTime.value = nowIso;
    }

    openModal('pacModal');
  }

  function editPacCase(id) {
    const c = state.pacCases.find((x) => x.id === id);
    if (!c) return;
    state.editingPacId = id;
    const form = $('pacForm');
    form.reset();
    $('pacModalTitle').textContent = 'Edit PAC Assessment';
    $('deletePacBtn').style.display = 'inline-flex';

    Object.keys(c).forEach((k) => {
      if (form.elements[k]) {
        if (form.elements[k].type === 'checkbox') {
          form.elements[k].checked = Boolean(c[k]);
        } else {
          form.elements[k].value = c[k] || '';
        }
      }
    });

    openModal('pacModal');
  }

  async function handlePacSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const data = {};

    for (const [k, v] of fd.entries()) {
      data[k] = v.trim();
    }

    data.difficultAirway = Boolean(form.elements.difficultAirway && form.elements.difficultAirway.checked);
    data.highRiskConsent = Boolean(form.elements.highRiskConsent && form.elements.highRiskConsent.checked);

    const now = new Date().toISOString();
    const isEdit = Boolean(state.editingPacId);
    const id = isEdit ? state.editingPacId : uid();

    const caseItem = {
      ...data,
      id,
      status: data.status || 'Pending',
      created_at: isEdit ? (state.pacCases.find(x => x.id === id)?.created_at || now) : now,
      updated_at: now
    };

    if (isEdit) {
      const idx = state.pacCases.findIndex((x) => x.id === id);
      if (idx >= 0) state.pacCases[idx] = caseItem;
    } else {
      state.pacCases.unshift(caseItem);
    }

    saveLocalData();
    closeModal('pacModal');
    renderPacView();
    pushPacToCloud(caseItem);
  }

  async function deletePacCase() {
    if (!state.editingPacId) return;
    if (!confirm('Are you sure you want to delete this PAC record?')) return;

    const id = state.editingPacId;
    state.pacCases = state.pacCases.filter((x) => x.id !== id);
    saveLocalData();
    closeModal('pacModal');
    renderPacView();
    deletePacFromCloud(id);
  }

  function sendPacToOt(pacId) {
    const p = state.pacCases.find((x) => x.id === pacId);
    if (!p) return;

    switchTab('ot');
    openStartCaseModal({
      patient: p.name ? `${p.name}${p.crNo ? ` (CR: ${p.crNo})` : ''}` : '',
      age: p.age ? `${p.age} ${p.sex || ''}`.trim() : '',
      weight: p.weight || '',
      asa: p.asa || 'ASA I',
      procedure: p.procedure || '',
      airway: (p.airway && p.airway.toLowerCase().includes('lma')) ? 'LMA' : 'ETT',
      resident: p.resident || ''
    });
  }

  function renderPacView() {
    const listEl = $('pacCasesList');
    if (!listEl) return;

    const cases = getFilteredPacCases();

    if (!cases.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <h3>No PAC cases found</h3>
          <p>Tap "New PAC" to document a pre-anaesthesia evaluation.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = cases.map((c) => {
      const statusBadge = c.status === 'Cleared'
        ? '<span class="badge badge-cleared">Cleared</span>'
        : c.status === 'Hold'
          ? '<span class="badge badge-hold">Hold / Review</span>'
          : '<span class="badge badge-pending">Pending</span>';

      const difficultAirwayPill = c.difficultAirway
        ? '<span class="badge badge-problem">⚠️ Difficult Airway</span>'
        : '';

      return `
        <div class="card" onclick="window.JLN_APP.editPac('${escapeHtml(c.id)}')">
          <div class="card-header">
            <div>
              <div class="card-title">
                ${escapeHtml(c.name || 'Unnamed Patient')}
                ${c.crNo ? `<span style="font-size:12px;font-weight:600;color:var(--text-muted)">#${escapeHtml(c.crNo)}</span>` : ''}
              </div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
                ${escapeHtml(c.age || '')} ${escapeHtml(c.sex || '')} · Ward: ${escapeHtml(c.ward || '—')} · ${escapeHtml(c.asa || 'ASA')}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              ${difficultAirwayPill}
              ${statusBadge}
            </div>
          </div>

          <div style="font-size:13px;margin-bottom:8px">
            <b>Procedure:</b> ${escapeHtml(c.procedure || '—')}
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
            <b>Diagnosis:</b> ${escapeHtml(c.diagnosis || '—')}
          </div>

          ${c.comorbidities ? `
            <div style="font-size:12px;color:var(--text);background:var(--surface);padding:6px 10px;border-radius:var(--radius-sm);margin-bottom:8px">
              <b>Comorbidities:</b> ${escapeHtml(c.comorbidities)}
            </div>
          ` : ''}

          ${c.airway ? `
            <div style="font-size:12px;color:var(--text);background:var(--surface);padding:6px 10px;border-radius:var(--radius-sm);margin-bottom:8px">
              <b>Airway findings:</b> ${escapeHtml(c.airway)}
            </div>
          ` : ''}

          ${c.advice ? `
            <div style="font-size:12px;border-left:3px solid var(--primary);background:var(--primary-light);padding:8px 10px;border-radius:0 var(--radius-sm) var(--radius-sm) 0;margin-bottom:10px">
              <b>Consultant Advice (${escapeHtml(c.consultant || 'Staff')}):</b> ${escapeHtml(c.advice)}
            </div>
          ` : ''}

          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-top:10px;padding-top:8px;border-top:1px solid var(--border-subtle)">
            <div style="font-size:11px;color:var(--text-muted)">
              Resident: <b>${escapeHtml(c.resident || '—')}</b>
            </div>
            <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
              <button class="btn btn-secondary btn-sm" onclick="window.JLN_APP.editPac('${escapeHtml(c.id)}')">Edit</button>
              <button class="btn btn-primary btn-sm" onclick="window.JLN_APP.sendToOt('${escapeHtml(c.id)}')">Send to OT →</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- OT & Intra-op Module ---
  function getFilteredOtCases() {
    return state.otCases.filter((c) => {
      const caseDate = c.date || (c.created_at || '').slice(0, 10);
      if (state.selectedDate && caseDate !== state.selectedDate) {
        return false;
      }
      if (state.otFilter !== 'ALL' && c.ot !== state.otFilter) {
        return false;
      }
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        const haystack = [
          c.patient, c.procedure, c.resident, c.ot, c.anaesthesia
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  function getCaseStatus(c) {
    if (c.completed) return { badge: 'badge-done', label: 'Completed', key: 'completed' };
    const hasProblem = (c.events || []).some(
      (e) => e.type === 'Problem / complication' || e.type === 'Vital sign problem'
    );
    if (hasProblem) return { badge: 'badge-problem', label: 'Problem / Flagged', key: 'problem' };
    return { badge: 'badge-ongoing', label: 'Ongoing', key: 'ongoing' };
  }

  function openStartCaseModal(prefill = {}) {
    const form = $('startCaseForm');
    form.reset();

    const otSelect = form.elements.ot;
    otSelect.innerHTML = '<option value="">Select OT</option>' + state.otList.map(
      (ot) => `<option value="${escapeHtml(ot)}">${escapeHtml(ot)}</option>`
    ).join('');

    Object.keys(prefill).forEach((k) => {
      if (form.elements[k]) form.elements[k].value = prefill[k] || '';
    });

    openModal('startCaseModal');
  }

  async function handleStartCaseSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const data = {};

    for (const [k, v] of fd.entries()) {
      if (k === 'monitor') {
        (data.monitoring || (data.monitoring = [])).push(v);
      } else {
        data[k] = v.trim();
      }
    }

    // Extract baseline intra-op monitor & ventilator settings if entered
    const initialMonitor = {};
    const monitorFields = ['bp', 'hr', 'spo2', 'etco2', 'temp', 'urine', 'ventmode', 'tv', 'rr', 'ie', 'ppeak', 'peep', 'fio2'];
    let hasInitialMonitor = false;
    monitorFields.forEach((f) => {
      if (data[f]) {
        initialMonitor[f] = data[f];
        hasInitialMonitor = true;
        delete data[f];
      }
    });
    if (hasInitialMonitor) {
      initialMonitor.time = formatTimeNow();
    }

    const now = new Date();
    const id = uid();
    const caseItem = {
      ...data,
      id,
      date: state.selectedDate || now.toISOString().slice(0, 10),
      time: formatTimeNow(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      completed: false,
      completed_at: null,
      events: [],
      latest_monitor: initialMonitor,
      monitoring: data.monitoring || ['ECG', 'NIBP', 'SpO₂']
    };

    state.otCases.unshift(caseItem);
    saveLocalData();
    closeModal('startCaseModal');
    renderOtView();
    renderDashboardView();
    pushOtToCloud(caseItem);
  }

  function openUpdateVitalsModal(caseId) {
    const c = state.otCases.find((x) => x.id === caseId);
    if (!c) return;
    state.activeOtCaseId = caseId;
    const form = $('updateVitalsForm');
    form.reset();
    form.elements.caseId.value = caseId;

    const v = c.latest_monitor || {};
    Object.keys(v).forEach((k) => {
      if (form.elements[k]) form.elements[k].value = v[k] || '';
    });

    $('vitalsModalPatient').textContent = `${c.patient} (${c.ot || 'OT'})`;
    openModal('updateVitalsModal');
  }

  async function handleUpdateVitalsSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const caseId = form.elements.caseId.value;
    const c = state.otCases.find((x) => x.id === caseId);
    if (!c) return;

    const fd = new FormData(form);
    const v = {};
    for (const [key, val] of fd.entries()) {
      if (key !== 'caseId') v[key] = val.trim();
    }
    v.time = formatTimeNow();

    c.latest_monitor = v;
    c.updated_at = new Date().toISOString();

    saveLocalData();
    closeModal('updateVitalsModal');
    renderOtView();
    renderDashboardView();
    pushOtToCloud(c);
  }

  function openAddEventModal(caseId) {
    const c = state.otCases.find((x) => x.id === caseId);
    if (!c) return;
    state.activeOtCaseId = caseId;
    const form = $('addEventForm');
    form.reset();
    form.elements.caseId.value = caseId;
    form.elements.time.value = formatTimeNow();

    $('eventModalPatient').textContent = `${c.patient} (${c.ot || 'OT'})`;
    openModal('addEventModal');
  }

  async function handleAddEventSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const caseId = form.elements.caseId.value;
    const c = state.otCases.find((x) => x.id === caseId);
    if (!c) return;

    const eventItem = {
      id: uid(),
      type: form.elements.type.value,
      time: form.elements.time.value || formatTimeNow(),
      detail: form.elements.detail.value.trim()
    };

    if (!Array.isArray(c.events)) c.events = [];
    c.events.push(eventItem);
    c.updated_at = new Date().toISOString();

    saveLocalData();
    closeModal('addEventModal');
    renderOtView();
    renderDashboardView();
    pushOtToCloud(c);
  }

  async function completeOtCase(caseId) {
    const c = state.otCases.find((x) => x.id === caseId);
    if (!c) return;
    if (!confirm(`Mark case "${c.patient}" in ${c.ot} as COMPLETED?`)) return;

    c.completed = true;
    c.completed_at = new Date().toISOString();
    c.updated_at = new Date().toISOString();

    saveLocalData();
    renderOtView();
    renderDashboardView();
    pushOtToCloud(c);
  }

  async function deleteOtCase(caseId) {
    const c = state.otCases.find((x) => x.id === caseId);
    if (!c) return;
    if (!confirm(`Delete case record for "${c.patient}"?`)) return;

    state.otCases = state.otCases.filter((x) => x.id !== caseId);
    saveLocalData();
    renderOtView();
    renderDashboardView();
    deleteOtFromCloud(caseId);
  }

  function renderOtView() {
    const container = $('otCasesContainer');
    if (!container) return;

    const filtered = getFilteredOtCases();

    if (!filtered.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No OT cases found for ${formatDateLabel(state.selectedDate)}</h3>
          <p>Tap "Start New Case" or select a PAC case and click "Send to OT".</p>
        </div>
      `;
      return;
    }

    const otMap = {};
    state.otList.forEach((ot) => { otMap[ot] = []; });
    filtered.forEach((c) => {
      const room = c.ot || 'Other OT';
      if (!otMap[room]) otMap[room] = [];
      otMap[room].push(c);
    });

    let html = '';
    Object.keys(otMap).forEach((otName) => {
      const roomCases = otMap[otName];
      if (state.otFilter !== 'ALL' && state.otFilter !== otName) return;
      if (!roomCases.length && state.otFilter === 'ALL') return;

      html += `
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div class="card-title">
              🏥 ${escapeHtml(otName)}
              <span class="badge" style="background:var(--surface);color:var(--text-muted)">${roomCases.length} case${roomCases.length === 1 ? '' : 's'}</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.JLN_APP.startNewCase({ot: '${escapeHtml(otName)}'})">
              ＋ Add to ${escapeHtml(otName)}
            </button>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            ${roomCases.map((c) => renderSingleOtCase(c)).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function renderSingleOtCase(c) {
    const st = getCaseStatus(c);
    const v = c.latest_monitor || {};
    const mapVal = calculateMAP(v.bp);
    const events = c.events || [];

    return `
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;background:var(--card-hover)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div>
            <div style="font-weight:800;font-size:15px;color:var(--text)">
              ${escapeHtml(c.patient || 'Patient')}
              <span style="font-weight:600;font-size:12px;color:var(--text-muted)">· ${escapeHtml(c.procedure || 'Procedure')}</span>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
              Resident: <b>${escapeHtml(c.resident || '—')}</b> · ${escapeHtml(c.asa || '')} · Started: ${escapeHtml(c.time || '—')} · ${escapeHtml(c.anaesthesia || '')}
            </div>
          </div>
          <span class="badge ${st.badge}">${st.label}</span>
        </div>

        <div class="vitals-grid">
          <div class="vital-box">
            <div class="vital-val">${escapeHtml(v.bp || '—')}</div>
            <div class="vital-label">BP (mmHg)</div>
            ${mapVal ? `<div class="vital-sub">MAP ${mapVal}</div>` : ''}
          </div>
          <div class="vital-box">
            <div class="vital-val">${escapeHtml(v.hr || '—')}</div>
            <div class="vital-label">HR (bpm)</div>
          </div>
          <div class="vital-box">
            <div class="vital-val">${escapeHtml(v.spo2 ? `${v.spo2}%` : '—')}</div>
            <div class="vital-label">SpO₂</div>
          </div>
          <div class="vital-box">
            <div class="vital-val">${escapeHtml(v.etco2 || '—')}</div>
            <div class="vital-label">EtCO₂</div>
          </div>
          <div class="vital-box">
            <div class="vital-val">${escapeHtml(v.temp ? `${v.temp}°C` : '—')}</div>
            <div class="vital-label">Temp</div>
          </div>
          <div class="vital-box">
            <div class="vital-val">${escapeHtml(v.urine ? `${v.urine} mL` : '—')}</div>
            <div class="vital-label">Urine</div>
          </div>
        </div>

        ${(v.fluid || v.infusion || v.ventmode || v.note) ? `
          <div style="font-size:11px;background:var(--surface);padding:8px 10px;border-radius:var(--radius-sm);color:var(--text);margin-top:6px">
            ${v.fluid ? `<div><b>Fluids:</b> ${escapeHtml(v.fluid)}</div>` : ''}
            ${v.infusion ? `<div><b>Infusions:</b> ${escapeHtml(v.infusion)}</div>` : ''}
            ${v.ventmode ? `<div><b>Ventilator (${escapeHtml(v.ventmode)}):</b> Vt ${escapeHtml(v.tv || '—')} mL · RR ${escapeHtml(v.rr || '—')} /min${v.ie ? ` · I:E ${escapeHtml(v.ie)}` : ''}${v.ppeak ? ` · Ppeak ${escapeHtml(v.ppeak)} cmH₂O` : ''} · PEEP ${escapeHtml(v.peep || '—')} cmH₂O · FiO₂ ${escapeHtml(v.fio2 || '—')}%</div>` : ''}
            ${v.note ? `<div><b>Intra-op Note:</b> ${escapeHtml(v.note)}</div>` : ''}
          </div>
        ` : ''}

        ${events.length ? `
          <div class="timeline">
            ${events.slice().reverse().map((e) => `
              <div class="timeline-item">
                <span class="timeline-time">${escapeHtml(e.time || '')}</span> —
                <span class="timeline-title">${escapeHtml(e.type || 'Event')}</span>:
                <span class="timeline-desc">${escapeHtml(e.detail || '')}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid var(--border-subtle)">
          <button class="btn btn-primary btn-sm" onclick="window.JLN_APP.updateVitals('${escapeHtml(c.id)}')">
            📊 Update Vitals
          </button>
          <button class="btn btn-secondary btn-sm" onclick="window.JLN_APP.addEvent('${escapeHtml(c.id)}')">
            ＋ Log Event
          </button>
          ${!c.completed ? `
            <button class="btn btn-secondary btn-sm" onclick="window.JLN_APP.completeCase('${escapeHtml(c.id)}')">
              ✓ Complete Case
            </button>
          ` : ''}
          <button class="btn btn-danger btn-sm" style="margin-left:auto" onclick="window.JLN_APP.deleteCase('${escapeHtml(c.id)}')">
            Delete
          </button>
        </div>
      </div>
    `;
  }

  // --- Consultant Dashboard Module ---
  function renderDashboardView() {
    const matrixEl = $('dashboardStatsMatrix');
    const boardEl = $('dashboardRoomBoard');
    if (!matrixEl || !boardEl) return;

    const todayCases = state.otCases.filter(
      (c) => (c.date || (c.created_at || '').slice(0, 10)) === state.selectedDate
    );

    const total = todayCases.length;
    const active = todayCases.filter((c) => !c.completed).length;
    const problems = todayCases.filter((c) => getCaseStatus(c).key === 'problem').length;
    const completed = todayCases.filter((c) => c.completed).length;

    matrixEl.innerHTML = `
      <div class="stat-card">
        <div class="stat-number">${total}</div>
        <div class="stat-label">Total Cases</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color:var(--primary)">${active}</div>
        <div class="stat-label">Ongoing</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color:var(--danger)">${problems}</div>
        <div class="stat-label">Complications</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color:var(--success)">${completed}</div>
        <div class="stat-label">Completed</div>
      </div>
    `;

    boardEl.innerHTML = state.otList.map((otName) => {
      const activeInRoom = todayCases.filter((c) => c.ot === otName && !c.completed);
      const pastInRoom = todayCases.filter((c) => c.ot === otName && c.completed);

      return `
        <div class="card" style="margin-bottom:12px">
          <div class="card-header">
            <div class="card-title">
              🏥 ${escapeHtml(otName)}
            </div>
            ${activeInRoom.length ? `
              <span class="badge badge-ongoing">In Use (${activeInRoom.length})</span>
            ` : `
              <span class="badge badge-done">Idle</span>
            `}
          </div>

          ${activeInRoom.map((c) => {
            const v = c.latest_monitor || {};
            const st = getCaseStatus(c);
            return `
              <div style="background:var(--surface);padding:10px;border-radius:var(--radius-sm);margin-bottom:6px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <b>${escapeHtml(c.patient)}</b>
                  <span class="badge ${st.badge}">${st.label}</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin:3px 0">
                  ${escapeHtml(c.procedure)} · Dr. ${escapeHtml(c.resident || '—')}
                </div>
                <div style="font-size:12px;font-weight:700;color:var(--text);display:flex;gap:12px;flex-wrap:wrap">
                  <span>BP: ${escapeHtml(v.bp || '—')}</span>
                  <span>HR: ${escapeHtml(v.hr || '—')}</span>
                  <span>SpO₂: ${escapeHtml(v.spo2 ? `${v.spo2}%` : '—')}</span>
                  <span>EtCO₂: ${escapeHtml(v.etco2 || '—')}</span>
                </div>
              </div>
            `;
          }).join('')}

          ${pastInRoom.length ? `
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
              Completed earlier today: ${pastInRoom.map(x => escapeHtml(x.patient)).join(', ')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // --- Settings & Export Module ---
  function exportDataAsJson() {
    const data = {
      exportedAt: new Date().toISOString(),
      pacCases: state.pacCases,
      otCases: state.otCases,
      otList: state.otList
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jln-anaesthesia-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportOtAsCsv() {
    if (!state.otCases.length) {
      alert('No OT cases to export.');
      return;
    }
    const headers = ['Date', 'OT', 'Patient', 'Age', 'ASA', 'Procedure', 'Anaesthesia', 'Resident', 'Completed'];
    const rows = state.otCases.map((c) => [
      c.date || '',
      c.ot || '',
      `"${(c.patient || '').replace(/"/g, '""')}"`,
      c.age || '',
      c.asa || '',
      `"${(c.procedure || '').replace(/"/g, '""')}"`,
      c.anaesthesia || '',
      `"${(c.resident || '').replace(/"/g, '""')}"`,
      c.completed ? 'YES' : 'NO'
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jln-ot-cases-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Search & Filter Listeners ---
  function setupSearchAndFilters() {
    const searchInput = $('globalSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        render();
      });
    }

    const dateInput = $('globalDateInput');
    if (dateInput) {
      dateInput.value = state.selectedDate;
      dateInput.addEventListener('change', (e) => {
        state.selectedDate = e.target.value;
        render();
      });
    }

    $$('[data-pac-filter]').forEach((pill) => {
      pill.addEventListener('click', () => {
        $$('[data-pac-filter]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.pacStatusFilter = pill.dataset.pacFilter;
        renderPacView();
      });
    });

    const otFilterSelect = $('otRoomFilterSelect');
    if (otFilterSelect) {
      otFilterSelect.innerHTML = '<option value="ALL">All Operating Theatres</option>' + state.otList.map(
        ot => `<option value="${escapeHtml(ot)}">${escapeHtml(ot)}</option>`
      ).join('');
      otFilterSelect.addEventListener('change', (e) => {
        state.otFilter = e.target.value;
        renderOtView();
      });
    }
  }

  // --- Global Render ---
  function render() {
    if (state.currentTab === 'pac') renderPacView();
    if (state.currentTab === 'ot') renderOtView();
    if (state.currentTab === 'dashboard') renderDashboardView();
  }

  // --- Initialization ---
  function init() {
    initTheme();
    loadLocalData();
    setupModals();
    setupSearchAndFilters();

    $$('.nav-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    $$('.bottom-nav-item').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    $('pacForm').addEventListener('submit', handlePacSubmit);
    $('startCaseForm').addEventListener('submit', handleStartCaseSubmit);
    $('updateVitalsForm').addEventListener('submit', handleUpdateVitalsSubmit);
    $('addEventForm').addEventListener('submit', handleAddEventSubmit);
    $('deletePacBtn').addEventListener('click', deletePacCase);

    $('exportJsonBtn').addEventListener('click', exportDataAsJson);
    $('exportCsvBtn').addEventListener('click', exportOtAsCsv);
    $('forceSyncBtn').addEventListener('click', syncWithSupabase);

    window.addEventListener('hashchange', handleHashRoute);
    handleHashRoute();

    syncWithSupabase();
  }

  window.JLN_APP = {
    newPac: () => openNewPacModal(),
    editPac: (id) => editPacCase(id),
    sendToOt: (id) => sendPacToOt(id),
    startNewCase: (prefill) => openStartCaseModal(prefill),
    updateVitals: (id) => openUpdateVitalsModal(id),
    addEvent: (id) => openAddEventModal(id),
    completeCase: (id) => completeOtCase(id),
    deleteCase: (id) => deleteOtCase(id)
  };

  document.addEventListener('DOMContentLoaded', init);
})();
