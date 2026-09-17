(function () {
  'use strict';

  const STORAGE_KEY = 'jln_ot_cases_v1';
  const DRUGS = [
    ['Propofol', 'mg'], ['Etomidate', 'mg'], ['Ketamine', 'mg'], ['Midazolam', 'mg'],
    ['Fentanyl', 'µg'], ['Morphine', 'mg'], ['Pethidine', 'mg'],
    ['Paracetamol', 'mg'], ['Ondansetron', 'mg'], ['Dexamethasone', 'mg'],
    ['Metoclopramide', 'mg'], ['Glycopyrrolate', 'mg'], ['Neostigmine', 'mg'],
    ['Sugammadex', 'mg'], ['Rocuronium', 'mg'], ['Vecuronium', 'mg'],
    ['Atracurium', 'mg'], ['Succinylcholine', 'mg'],
    ['Lidocaine', 'mg'], ['Bupivacaine', 'mg'], ['Ropivacaine', 'mg'],
    ['Ephedrine', 'mg'], ['Phenylephrine', 'µg'], ['Noradrenaline', 'µg'],
    ['Adrenaline', 'mg'], ['Other drug', '']
  ];

  const INHALATION = [
    ['Sevoflurane', '%'], ['Isoflurane', '%'], ['Desflurane', '%'],
    ['Nitrous oxide', '%'], ['Other inhalational agent', '%']
  ];

  const FLUIDS = [
    ['Normal Saline', 'mL'], ['Ringer Lactate', 'mL'], ['Plasmalyte', 'mL'],
    ['Dextrose', 'mL'], ['Colloid', 'mL'], ['PRBC', 'mL'], ['FFP', 'mL'],
    ['Platelets', 'mL'], ['Cryoprecipitate', 'mL'], ['Other fluid', 'mL']
  ];

  const esc = (v) => {
    const d = document.createElement('div');
    d.textContent = v == null ? '' : String(v);
    return d.innerHTML;
  };

  function readCases() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (_) { return []; }
  }

  function writeCases(cases) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  }

  function getCase(id) {
    return readCases().find(c => String(c.id) === String(id));
  }

  function persistCase(c) {
    const cases = readCases();
    const idx = cases.findIndex(x => String(x.id) === String(c.id));
    if (idx >= 0) cases[idx] = c;
    else cases.unshift(c);
    writeCases(cases);

    if (window.supabaseClient) {
      window.supabaseClient.from('ot_cases').upsert([c], { onConflict: 'id' }).catch(() => {});
    }
  }

  function extractCaseId(card) {
    const nodes = [card, ...card.querySelectorAll('[onclick]')];
    for (const node of nodes) {
      const value = node.getAttribute && node.getAttribute('onclick');
      if (!value) continue;
      const patterns = [
        /openUpdateVitalsModal\(['"]([^'"]+)['"]/, 
        /openAddEventModal\(['"]([^'"]+)['"]/, 
        /completeOtCase\(['"]([^'"]+)['"]/, 
        /deleteOtCase\(['"]([^'"]+)['"]/, 
        /editOtCase\(['"]([^'"]+)['"]/
      ];
      for (const re of patterns) {
        const m = value.match(re);
        if (m) return m[1];
      }
    }
    return null;
  }

  function ensureStyles() {
    if (document.getElementById('otDrugsStyles')) return;
    const style = document.createElement('style');
    style.id = 'otDrugsStyles';
    style.textContent = `
      .ot-drugs-panel{margin-top:10px;padding:10px;border:1px solid var(--border-subtle);border-radius:10px;background:var(--surface)}
      .ot-drugs-title{font-size:13px;font-weight:800;margin-bottom:7px}
      .ot-drugs-list{display:flex;flex-direction:column;gap:5px;margin-bottom:8px}
      .ot-drug-line{font-size:12px;padding:5px 8px;border-radius:7px;background:var(--background,#fff);display:flex;justify-content:space-between;gap:8px}
      .ot-drug-line span:last-child{color:var(--text-muted);white-space:nowrap}
      .ot-drugs-modal .modal-dialog{max-width:760px}
      .ot-drug-row{display:grid;grid-template-columns:120px 1fr 110px 70px 34px;gap:6px;align-items:center;margin-bottom:6px}
      .ot-drug-row input,.ot-drug-row select{min-width:0}
      .ot-drug-unit{font-size:12px;color:var(--text-muted);text-align:center}
      @media(max-width:650px){.ot-drug-row{grid-template-columns:1fr 1fr 85px 55px 34px}.ot-drug-row .ot-drug-category{grid-column:span 2}}
    `;
    document.head.appendChild(style);
  }

  function modalHtml() {
    return `
      <div id="otDrugsModal" class="modal-backdrop ot-drugs-modal">
        <div class="modal-dialog">
          <div class="modal-header">
            <div class="modal-title">💊 Drugs & Fluids Given</div>
            <button class="btn-icon" type="button" data-ot-drugs-close>✕</button>
          </div>
          <div class="modal-body">
            <div id="otDrugsPatient" style="font-size:12px;color:var(--text-muted);margin-bottom:10px"></div>
            <div id="otDrugsRows"></div>
            <button id="otDrugsAddRow" class="btn btn-secondary btn-sm" type="button">＋ Add row</button>
          </div>
          <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--border-subtle)">
            <button class="btn btn-secondary" type="button" data-ot-drugs-close>Cancel</button>
            <button id="otDrugsSave" class="btn btn-primary" type="button">Save Drugs & Fluids</button>
          </div>
        </div>
      </div>`;
  }

  let activeCaseId = null;

  function categoryOptions(selected) {
    return ['Drug', 'Inhalational agent', 'Fluid'].map(x => `<option ${x === selected ? 'selected' : ''}>${x}</option>`).join('');
  }

  function listFor(category) {
    if (category === 'Fluid') return FLUIDS;
    if (category === 'Inhalational agent') return INHALATION;
    return DRUGS;
  }

  function addRow(item = {}) {
    const rows = document.getElementById('otDrugsRows');
    if (!rows) return;
    const row = document.createElement('div');
    row.className = 'ot-drug-row';
    const category = item.category || 'Drug';
    row.innerHTML = `
      <select class="form-control ot-drug-category">${categoryOptions(category)}</select>
      <select class="form-control ot-drug-name"></select>
      <input class="form-control ot-drug-dose" type="text" inputmode="decimal" placeholder="Dose">
      <div class="ot-drug-unit"></div>
      <button class="btn btn-icon" type="button" title="Remove">✕</button>`;

    const categoryEl = row.querySelector('.ot-drug-category');
    const nameEl = row.querySelector('.ot-drug-name');
    const doseEl = row.querySelector('.ot-drug-dose');
    const unitEl = row.querySelector('.ot-drug-unit');

    function refreshNames() {
      const items = listFor(categoryEl.value);
      nameEl.innerHTML = items.map(([name]) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
      const wanted = item.name || '';
      if (wanted && items.some(x => x[0] === wanted)) nameEl.value = wanted;
      refreshUnit();
    }
    function refreshUnit() {
      const itemName = nameEl.value;
      const found = listFor(categoryEl.value).find(x => x[0] === itemName);
      unitEl.textContent = found ? found[1] : '';
    }

    categoryEl.addEventListener('change', () => { item = {}; refreshNames(); });
    nameEl.addEventListener('change', refreshUnit);
    row.querySelector('button').addEventListener('click', () => row.remove());
    rows.appendChild(row);
    refreshNames();
    doseEl.value = item.dose || '';
  }

  function openModalForCase(caseId) {
    const c = getCase(caseId);
    if (!c) return;
    activeCaseId = caseId;
    const modal = document.getElementById('otDrugsModal');
    const rows = document.getElementById('otDrugsRows');
    const patient = document.getElementById('otDrugsPatient');
    if (!modal || !rows) return;
    patient.textContent = `${c.patient || 'Patient'} · ${c.ot || 'OT'} · ${c.procedure || 'Procedure'}`;
    rows.innerHTML = '';
    const entries = Array.isArray(c.drugs_fluids) ? c.drugs_fluids : [];
    if (entries.length) entries.forEach(addRow); else addRow();
    modal.classList.add('open');
  }

  function saveActiveCase() {
    const c = getCase(activeCaseId);
    if (!c) return;
    const entries = [];
    document.querySelectorAll('#otDrugsRows .ot-drug-row').forEach(row => {
      const category = row.querySelector('.ot-drug-category')?.value || '';
      const name = row.querySelector('.ot-drug-name')?.value || '';
      const dose = row.querySelector('.ot-drug-dose')?.value.trim() || '';
      const found = listFor(category).find(x => x[0] === name);
      const unit = found ? found[1] : '';
      if (name && dose) entries.push({ category, name, dose, unit, time: new Date().toISOString() });
    });
    c.drugs_fluids = entries;
    c.updated_at = new Date().toISOString();
    persistCase(c);
    document.getElementById('otDrugsModal')?.classList.remove('open');
    decorateOtCases();
  }

  function decorateOtCases() {
    const container = document.getElementById('otCasesContainer');
    if (!container) return;
    container.querySelectorAll('.card').forEach(card => {
      const caseId = extractCaseId(card);
      if (!caseId) return;
      const c = getCase(caseId);
      if (!c) return;
      if (card.querySelector('.ot-drugs-panel')) card.querySelector('.ot-drugs-panel').remove();

      const entries = Array.isArray(c.drugs_fluids) ? c.drugs_fluids : [];
      const panel = document.createElement('div');
      panel.className = 'ot-drugs-panel';
      const summary = entries.length
        ? entries.map(e => `<div class="ot-drug-line"><span>${esc(e.name)}</span><span>${esc(e.dose)} ${esc(e.unit)}</span></div>`).join('')
        : '<div style="font-size:12px;color:var(--text-muted);margin-bottom:7px">No drugs or fluids recorded yet.</div>';
      panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
          <div class="ot-drugs-title">💊 Drugs & Fluids Given</div>
          <button class="btn btn-secondary btn-sm" type="button">${entries.length ? 'Edit' : '＋ Add'}</button>
        </div>
        <div class="ot-drugs-list">${summary}</div>`;
      panel.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        openModalForCase(caseId);
      });
      card.appendChild(panel);
    });
  }

  function init() {
    ensureStyles();
    document.body.insertAdjacentHTML('beforeend', modalHtml());
    document.querySelectorAll('[data-ot-drugs-close]').forEach(b => b.addEventListener('click', () => document.getElementById('otDrugsModal')?.classList.remove('open')));
    document.getElementById('otDrugsAddRow').addEventListener('click', () => addRow());
    document.getElementById('otDrugsSave').addEventListener('click', saveActiveCase);

    const container = document.getElementById('otCasesContainer');
    if (container) {
      const observer = new MutationObserver(() => setTimeout(decorateOtCases, 0));
      observer.observe(container, { childList: true, subtree: true });
      setTimeout(decorateOtCases, 100);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();