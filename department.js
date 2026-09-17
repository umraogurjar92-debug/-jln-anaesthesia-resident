(function () {
  'use strict';

  const DEPARTMENTS = [
    'General Surgery',
    'Orthopaedics',
    'ENT',
    'Ophthalmology',
    'Obstetrics & Gynaecology',
    'Neurosurgery',
    'Paediatrics',
    'Urology',
    'Plastic Surgery',
    'CTVS',
    'Thoracic Surgery',
    'Maxillofacial / Dental',
    'Other'
  ];

  const escapeHtml = (value) => {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  };

  function addDepartmentField() {
    const form = document.getElementById('pacForm');
    if (!form || form.elements.department) return;

    const procedureInput = form.elements.procedure;
    const procedureGroup = procedureInput ? procedureInput.closest('.form-group') : null;
    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `
      <label class="form-label">Department *</label>
      <select name="department" class="form-control" required>
        <option value="">Select Department</option>
        ${DEPARTMENTS.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
      </select>
    `;

    if (procedureGroup && procedureGroup.parentElement) {
      procedureGroup.parentElement.insertBefore(group, procedureGroup);
    } else {
      form.querySelector('.form-grid')?.prepend(group);
    }

    form.addEventListener('submit', function (event) {
      const select = form.elements.department;
      if (!select.value) {
        event.preventDefault();
        select.focus();
        alert('Please select the PAC department.');
      }
    }, true);
  }

  function addDepartmentFilter() {
    const pacView = document.getElementById('pacView');
    if (!pacView || document.getElementById('pacDepartmentFilter')) return;

    const header = pacView.querySelector('.card-header');
    if (!header) return;

    const controls = header.firstElementChild;
    if (!controls) return;

    const select = document.createElement('select');
    select.id = 'pacDepartmentFilter';
    select.className = 'form-control';
    select.style.cssText = 'min-width:190px;font-weight:700;width:auto;display:inline-block;margin-left:4px';
    select.innerHTML = `<option value="ALL">All Departments</option><option value="UNASSIGNED">Unassigned / Old PAC</option>${DEPARTMENTS.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}`;
    controls.appendChild(select);

    select.addEventListener('change', applyDepartmentFilter);
  }

  function getPacData() {
    try {
      const data = JSON.parse(localStorage.getItem('jln_pac_cases_v1') || '[]');
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function applyDepartmentFilter() {
    const filter = document.getElementById('pacDepartmentFilter');
    const list = document.getElementById('pacCasesList');
    if (!filter || !list) return;

    const wanted = filter.value;
    const data = getPacData();
    const byId = new Map(data.map(item => [String(item.id), item]));

    list.querySelectorAll(':scope > .card').forEach(card => {
      const onclick = card.getAttribute('onclick') || '';
      const match = onclick.match(/editPac\\('([^']+)'\\)/);
      const id = match ? match[1] : '';
      const item = byId.get(id);
      const dept = item && item.department ? item.department : 'UNASSIGNED';
      card.style.display = (wanted === 'ALL' || wanted === dept) ? '' : 'none';
    });

    // Add department badge to each visible PAC card.
    list.querySelectorAll(':scope > .card').forEach(card => {
      const onclick = card.getAttribute('onclick') || '';
      const match = onclick.match(/editPac\\('([^']+)'\\)/);
      const item = match ? byId.get(match[1]) : null;
      if (!item) return;
      let badge = card.querySelector('.pac-department-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge pac-department-badge';
        badge.style.cssText = 'background:var(--primary-light);color:var(--primary);border:1px solid var(--border);margin-right:4px';
        const headerBadges = card.querySelector('.card-header > div:last-child');
        if (headerBadges) headerBadges.prepend(badge);
      }
      badge.textContent = item.department || 'Unassigned';
    });
  }

  function watchPacList() {
    const list = document.getElementById('pacCasesList');
    if (!list) return;
    const observer = new MutationObserver(() => setTimeout(applyDepartmentFilter, 0));
    observer.observe(list, { childList: true, subtree: true });
    setTimeout(applyDepartmentFilter, 50);
  }

  function init() {
    addDepartmentField();
    addDepartmentFilter();
    watchPacList();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
