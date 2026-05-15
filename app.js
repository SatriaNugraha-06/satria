/* ══════════════════════════════════════════════════════════════════════
   FinTrack — Frontend App Logic
   ══════════════════════════════════════════════════════════════════════ */

// ── State ─────────────────────────────────────────────────────────────
const state = {
  year:  new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  txFilter: 'all',
  txData: [],
  charts: {},
};

const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni',
                     'Juli','Agustus','September','Oktober','November','Desember'];

const PALETTE = ['#f0c040','#3b82f6','#22c55e','#ef4444','#a855f7',
                 '#f97316','#06b6d4','#ec4899','#84cc16','#14b8a6'];

// ── Format ────────────────────────────────────────────────────────────
const fmt = (n) => 'Rp ' + Math.abs(n).toLocaleString('id-ID');
const fmtK = (n) => {
  if (n >= 1e9) return 'Rp ' + (n/1e9).toFixed(1) + 'M';
  if (n >= 1e6) return 'Rp ' + (n/1e6).toFixed(1) + 'jt';
  return fmt(n);
};

// ── Toast ─────────────────────────────────────────────────────────────
function toast(msg, type='ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  setTimeout(() => { el.className = 'toast'; }, 3000);
}

// ── Month Nav ─────────────────────────────────────────────────────────
function monthLabel() { return `${MONTH_NAMES[state.month-1]} ${state.year}`; }

function updateMonthLabels() {
  document.getElementById('monthLabel').textContent = monthLabel();
  document.getElementById('dashMonthLabel').textContent  = monthLabel();
  document.getElementById('txMonthLabel').textContent    = monthLabel();
  document.getElementById('budgetMonthLabel').textContent = monthLabel();
  document.getElementById('dailyMonthTitle').textContent = monthLabel();
}

document.getElementById('prevMonth').addEventListener('click', () => {
  state.month--;
  if (state.month < 1) { state.month = 12; state.year--; }
  refresh();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  state.month++;
  if (state.month > 12) { state.month = 1; state.year++; }
  refresh();
});

// ── Navigation ────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('panel-' + btn.dataset.panel);
    if (panel) panel.classList.add('active');
    if (btn.dataset.panel === 'transactions') renderTransactions();
    if (btn.dataset.panel === 'budget') loadBudget();
  });
});

// ── API Calls ─────────────────────────────────────────────────────────
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadSummary() {
  try {
    const d = await fetchJSON(`/api/summary?year=${state.year}&month=${state.month}`);
    document.getElementById('kpiBalance').textContent  = fmtK(d.balance);
    document.getElementById('kpiIncome').textContent   = fmtK(d.total_income);
    document.getElementById('kpiExpense').textContent  = fmtK(d.total_expense);
    document.getElementById('kpiSavings').textContent  = d.savings_rate + '%';

    renderDonut(d.expense_by_cat);
    renderDailyChart(d.daily);
  } catch(e) { console.error(e); }
}

async function loadMonthly() {
  try {
    const d = await fetchJSON('/api/stats/monthly');
    renderMonthlyChart(d);
  } catch(e) { console.error(e); }
}

async function loadTransactions() {
  try {
    state.txData = await fetchJSON(`/api/transactions?year=${state.year}&month=${state.month}`);
    renderTransactions();
  } catch(e) { console.error(e); }
}

async function loadBudget() {
  try {
    const d = await fetchJSON(`/api/budgets?year=${state.year}&month=${state.month}`);
    renderBudget(d);
  } catch(e) { console.error(e); }
}

// ── Render: Transactions ──────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.txFilter = btn.dataset.filter;
    renderTransactions();
  });
});

function renderTransactions() {
  const body = document.getElementById('txBody');
  let rows = state.txData;
  if (state.txFilter !== 'all') rows = rows.filter(r => r.type === state.txFilter);

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">Tidak ada transaksi.</td></tr>';
    return;
  }

  body.innerHTML = rows.map(r => `
    <tr>
      <td class="tx-date">${r.date}</td>
      <td>${r.category}</td>
      <td style="color:var(--muted)">${r.description || '—'}</td>
      <td><span class="badge badge-${r.type}">${r.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</span></td>
      <td class="right tx-amount tx-${r.type}">${r.type === 'income' ? '+' : '-'}${fmt(r.amount)}</td>
      <td>
        <button class="tx-del" data-id="${r.id}" title="Hapus">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14l-2.13-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('.tx-del').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(parseInt(btn.dataset.id)));
  });
}

async function deleteTransaction(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  try {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    toast('Transaksi dihapus.', 'ok');
    refresh();
  } catch(e) { toast('Gagal menghapus.', 'err'); }
}

// ── Render: Charts ────────────────────────────────────────────────────

const chartDefaults = {
  plugins: { legend: { display: false }, tooltip: {
    backgroundColor: '#1a1f2e', borderColor: '#252a3a', borderWidth: 1,
    titleColor: '#e8eaf0', bodyColor: '#6b7280',
    callbacks: { label: ctx => ' Rp ' + ctx.raw.toLocaleString('id-ID') }
  }},
  scales: {
    x: { grid: { color: '#252a3a' }, ticks: { color: '#6b7280', font: { family: 'IBM Plex Mono', size: 11 } } },
    y: { grid: { color: '#252a3a' }, ticks: { color: '#6b7280', font: { family: 'IBM Plex Mono', size: 11 },
         callback: v => 'Rp' + (v>=1e6 ? (v/1e6).toFixed(0)+'jt' : v.toLocaleString('id-ID')) } }
  }
};

function destroyChart(key) {
  if (state.charts[key]) { state.charts[key].destroy(); delete state.charts[key]; }
}

function renderMonthlyChart(data) {
  destroyChart('monthly');
  const ctx = document.getElementById('chartMonthly').getContext('2d');
  state.charts.monthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [
        { label: 'Pemasukan', data: data.map(d => d.income),  backgroundColor: 'rgba(34,197,94,.7)',  borderRadius: 4 },
        { label: 'Pengeluaran', data: data.map(d => d.expense), backgroundColor: 'rgba(239,68,68,.7)', borderRadius: 4 },
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, labels: { color: '#6b7280', font: { size: 11 }, boxWidth: 10 } },
        tooltip: chartDefaults.plugins.tooltip
      },
      scales: chartDefaults.scales
    }
  });
}

function renderDonut(data) {
  destroyChart('donut');
  const legend = document.getElementById('donutLegend');

  if (!data.length) {
    legend.innerHTML = '<div style="color:var(--muted);font-size:12px">Belum ada data</div>';
    return;
  }

  const ctx = document.getElementById('chartDonut').getContext('2d');
  state.charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.category),
      datasets: [{ data: data.map(d => d.total), backgroundColor: PALETTE, borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: { ...chartDefaults.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.label}: Rp ${ctx.raw.toLocaleString('id-ID')}` }
        }
      }
    }
  });

  const total = data.reduce((s, d) => s + d.total, 0);
  legend.innerHTML = data.map((d, i) => `
    <div class="legend-row">
      <div class="legend-dot" style="background:${PALETTE[i%PALETTE.length]}"></div>
      <div class="legend-cat">${d.category}</div>
      <div class="legend-val">${Math.round(d.total/total*100)}%</div>
    </div>
  `).join('');
}

function renderDailyChart(data) {
  destroyChart('daily');
  if (!data.length) return;
  const ctx = document.getElementById('chartDaily').getContext('2d');
  state.charts.daily = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date.slice(8)),  // day only
      datasets: [
        { label: 'Pemasukan', data: data.map(d => d.income),
          borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.08)',
          fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#22c55e' },
        { label: 'Pengeluaran', data: data.map(d => d.expense),
          borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.08)',
          fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#ef4444' },
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, labels: { color: '#6b7280', font: { size: 11 }, boxWidth: 10 } },
        tooltip: chartDefaults.plugins.tooltip
      },
      scales: { ...chartDefaults.scales, x: { ...chartDefaults.scales.x, ticks: { ...chartDefaults.scales.x.ticks, maxTicksLimit: 15 } } }
    }
  });
}

// ── Render: Budget ────────────────────────────────────────────────────
function renderBudget(data) {
  const grid = document.getElementById('budgetGrid');
  const items = data.filter(d => d.budget > 0 || d.spent > 0);

  if (!items.length) {
    grid.innerHTML = '<div class="empty">Belum ada anggaran. Atur di bawah.</div>';
    return;
  }

  grid.innerHTML = items.map(d => {
    const pct = Math.min(d.pct, 100);
    const cls  = d.pct >= 100 ? 'over' : d.pct >= 80 ? 'warn' : '';
    const rem  = d.budget ? (d.spent > d.budget ? 'Melebihi batas!' : 'Sisa ' + fmt(d.remaining)) : 'Tidak ada batas';
    return `
      <div class="budget-item">
        <div class="budget-cat">${d.category}</div>
        <div class="budget-amounts">
          <div class="budget-spent">${fmtK(d.spent)}</div>
          <div class="budget-limit">/ ${d.budget ? fmtK(d.budget) : '—'}</div>
        </div>
        ${d.budget ? `<div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>` : ''}
        <div class="budget-status ${cls}">${rem}</div>
      </div>
    `;
  }).join('');
}

document.getElementById('saveBudgetBtn').addEventListener('click', async () => {
  const cat = document.getElementById('budgetCat').value;
  const amt = parseFloat(document.getElementById('budgetAmt').value);
  if (!cat || !amt || amt <= 0) { toast('Isi kategori & nominal.', 'err'); return; }
  try {
    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: cat, amount: amt, year: state.year, month: state.month })
    });
    if (!res.ok) throw new Error();
    document.getElementById('budgetAmt').value = '';
    toast('Anggaran disimpan!', 'ok');
    loadBudget();
  } catch(e) { toast('Gagal menyimpan.', 'err'); }
});

// ── Add Transaction ───────────────────────────────────────────────────
let addType = 'income';

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    addType = btn.dataset.type;

    // Show/hide categories
    document.querySelectorAll('#addCategory option').forEach(opt => {
      opt.style.display = (opt.dataset.for === addType) ? '' : 'none';
    });
    // Select first visible
    const first = document.querySelector(`#addCategory option[data-for="${addType}"]`);
    if (first) document.getElementById('addCategory').value = first.value;
  });
});

// Set today's date
document.getElementById('addDate').valueAsDate = new Date();

document.getElementById('addTxBtn').addEventListener('click', async () => {
  const body = {
    type:        addType,
    category:    document.getElementById('addCategory').value,
    amount:      document.getElementById('addAmount').value,
    date:        document.getElementById('addDate').value,
    description: document.getElementById('addDesc').value,
  };

  const msg = document.getElementById('addMsg');

  if (!body.category || !body.amount || !body.date) {
    msg.textContent = 'Lengkapi semua kolom yang wajib diisi.';
    msg.className = 'add-msg err';
    return;
  }

  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }

    msg.textContent = '✓ Transaksi berhasil ditambahkan!';
    msg.className = 'add-msg ok';
    document.getElementById('addAmount').value = '';
    document.getElementById('addDesc').value   = '';
    toast('Transaksi disimpan!', 'ok');
    refresh();

    setTimeout(() => { msg.textContent = ''; msg.className = 'add-msg'; }, 3000);
  } catch(e) {
    msg.textContent = 'Gagal: ' + (e.message || 'Coba lagi.');
    msg.className = 'add-msg err';
  }
});

// ── Refresh All ───────────────────────────────────────────────────────
async function refresh() {
  updateMonthLabels();
  await Promise.all([loadSummary(), loadMonthly(), loadTransactions()]);
  // Reload budget if panel active
  if (document.getElementById('panel-budget').classList.contains('active')) loadBudget();
}

// ── Init ──────────────────────────────────────────────────────────────
refresh();
