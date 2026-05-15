from flask import Flask, render_template, request, jsonify, redirect, url_for
import sqlite3
import os
from datetime import datetime, timedelta
import calendar

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), 'finance.db')

# ─── Database Setup ───────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript('''
        CREATE TABLE IF NOT EXISTS transactions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            type        TEXT    NOT NULL CHECK(type IN ('income','expense')),
            category    TEXT    NOT NULL,
            amount      REAL    NOT NULL CHECK(amount > 0),
            description TEXT,
            date        TEXT    NOT NULL,
            created_at  TEXT    DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS budgets (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT    NOT NULL UNIQUE,
            amount   REAL    NOT NULL CHECK(amount > 0),
            month    TEXT    NOT NULL
        );
    ''')

    # Seed sample data if empty
    c.execute("SELECT COUNT(*) FROM transactions")
    if c.fetchone()[0] == 0:
        today = datetime.today()
        samples = [
            ('income',  'Gaji',         8500000, 'Gaji bulan ini',       today.strftime('%Y-%m-01')),
            ('income',  'Freelance',    1200000, 'Proyek website',        today.strftime('%Y-%m-05')),
            ('expense', 'Makanan',       450000, 'Belanja supermarket',   today.strftime('%Y-%m-03')),
            ('expense', 'Transportasi',  200000, 'Bensin & parkir',       today.strftime('%Y-%m-04')),
            ('expense', 'Hiburan',       350000, 'Nonton & streaming',    today.strftime('%Y-%m-06')),
            ('expense', 'Tagihan',       600000, 'Listrik & air',         today.strftime('%Y-%m-07')),
            ('expense', 'Kesehatan',     150000, 'Vitamin & obat',        today.strftime('%Y-%m-08')),
            ('income',  'Investasi',     300000, 'Dividen saham',         today.strftime('%Y-%m-10')),
            ('expense', 'Belanja',       500000, 'Pakaian',               today.strftime('%Y-%m-11')),
            ('expense', 'Makanan',       320000, 'Makan di luar',         today.strftime('%Y-%m-12')),
        ]
        c.executemany(
            "INSERT INTO transactions (type,category,amount,description,date) VALUES (?,?,?,?,?)",
            samples
        )

    conn.commit()
    conn.close()

# ─── Helper ───────────────────────────────────────────────────────────────────

INCOME_CATEGORIES  = ['Gaji', 'Freelance', 'Investasi', 'Bisnis', 'Hadiah', 'Lainnya']
EXPENSE_CATEGORIES = ['Makanan', 'Transportasi', 'Hiburan', 'Tagihan', 'Kesehatan',
                      'Belanja', 'Pendidikan', 'Tabungan', 'Lainnya']

def month_range(year, month):
    last_day = calendar.monthrange(year, month)[1]
    return f"{year}-{month:02d}-01", f"{year}-{month:02d}-{last_day}"

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html',
                           income_categories=INCOME_CATEGORIES,
                           expense_categories=EXPENSE_CATEGORIES)

# --- Summary API ---

@app.route('/api/summary')
def api_summary():
    year  = int(request.args.get('year',  datetime.today().year))
    month = int(request.args.get('month', datetime.today().month))
    start, end = month_range(year, month)

    conn = get_db()
    c    = conn.cursor()

    c.execute("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='income'  AND date BETWEEN ? AND ?", (start, end))
    total_income = c.fetchone()[0]

    c.execute("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='expense' AND date BETWEEN ? AND ?", (start, end))
    total_expense = c.fetchone()[0]

    c.execute("""
        SELECT category, SUM(amount) as total
        FROM transactions WHERE type='expense' AND date BETWEEN ? AND ?
        GROUP BY category ORDER BY total DESC
    """, (start, end))
    expense_by_cat = [{'category': r['category'], 'total': r['total']} for r in c.fetchall()]

    c.execute("""
        SELECT date, 
               SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) as income,
               SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
        FROM transactions WHERE date BETWEEN ? AND ?
        GROUP BY date ORDER BY date
    """, (start, end))
    daily = [{'date': r['date'], 'income': r['income'], 'expense': r['expense']} for r in c.fetchall()]

    # Running balance (all time)
    c.execute("""
        SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END), 0)
        FROM transactions
    """)
    balance = c.fetchone()[0]

    conn.close()
    return jsonify({
        'total_income':   total_income,
        'total_expense':  total_expense,
        'balance':        balance,
        'savings_rate':   round((total_income - total_expense) / total_income * 100, 1) if total_income else 0,
        'expense_by_cat': expense_by_cat,
        'daily':          daily,
    })

# --- Transactions API ---

@app.route('/api/transactions')
def api_transactions():
    year  = int(request.args.get('year',  datetime.today().year))
    month = int(request.args.get('month', datetime.today().month))
    start, end = month_range(year, month)

    conn = get_db()
    c    = conn.cursor()
    c.execute("""
        SELECT * FROM transactions WHERE date BETWEEN ? AND ?
        ORDER BY date DESC, id DESC
    """, (start, end))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route('/api/transactions', methods=['POST'])
def add_transaction():
    data = request.json
    required = ['type', 'category', 'amount', 'date']
    if not all(k in data and data[k] for k in required):
        return jsonify({'error': 'Data tidak lengkap'}), 400
    try:
        amount = float(data['amount'])
        if amount <= 0:
            raise ValueError
    except ValueError:
        return jsonify({'error': 'Nominal tidak valid'}), 400

    conn = get_db()
    c    = conn.cursor()
    c.execute("""
        INSERT INTO transactions (type, category, amount, description, date)
        VALUES (?,?,?,?,?)
    """, (data['type'], data['category'], amount,
          data.get('description', ''), data['date']))
    new_id = c.lastrowid
    conn.commit()

    c.execute("SELECT * FROM transactions WHERE id=?", (new_id,))
    row = dict(c.fetchone())
    conn.close()
    return jsonify(row), 201

@app.route('/api/transactions/<int:tid>', methods=['DELETE'])
def delete_transaction(tid):
    conn = get_db()
    c    = conn.cursor()
    c.execute("DELETE FROM transactions WHERE id=?", (tid,))
    affected = c.rowcount
    conn.commit()
    conn.close()
    if affected == 0:
        return jsonify({'error': 'Tidak ditemukan'}), 404
    return jsonify({'deleted': tid})

# --- Budget API ---

@app.route('/api/budgets')
def api_budgets():
    year  = int(request.args.get('year',  datetime.today().year))
    month = int(request.args.get('month', datetime.today().month))
    month_key = f"{year}-{month:02d}"
    start, end = month_range(year, month)

    conn = get_db()
    c    = conn.cursor()
    c.execute("SELECT * FROM budgets WHERE month=?", (month_key,))
    budgets = {r['category']: r['amount'] for r in c.fetchall()}

    c.execute("""
        SELECT category, SUM(amount) as spent
        FROM transactions WHERE type='expense' AND date BETWEEN ? AND ?
        GROUP BY category
    """, (start, end))
    spent = {r['category']: r['spent'] for r in c.fetchall()}
    conn.close()

    result = []
    for cat in EXPENSE_CATEGORIES:
        b = budgets.get(cat, 0)
        s = spent.get(cat, 0)
        result.append({'category': cat, 'budget': b, 'spent': s,
                        'remaining': b - s, 'pct': round(s/b*100,1) if b else 0})
    return jsonify(result)

@app.route('/api/budgets', methods=['POST'])
def set_budget():
    data = request.json
    year  = int(data.get('year',  datetime.today().year))
    month = int(data.get('month', datetime.today().month))
    month_key = f"{year}-{month:02d}"

    conn = get_db()
    c    = conn.cursor()
    c.execute("""
        INSERT INTO budgets (category, amount, month) VALUES (?,?,?)
        ON CONFLICT(category) DO UPDATE SET amount=excluded.amount
    """, (data['category'], float(data['amount']), month_key))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})

# --- Stats API (last 6 months) ---

@app.route('/api/stats/monthly')
def api_monthly_stats():
    today = datetime.today()
    results = []
    for i in range(5, -1, -1):
        d = today - timedelta(days=i*30)
        y, m = d.year, d.month
        s, e = month_range(y, m)
        conn = get_db()
        c    = conn.cursor()
        c.execute("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='income'  AND date BETWEEN ? AND ?", (s,e))
        inc = c.fetchone()[0]
        c.execute("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='expense' AND date BETWEEN ? AND ?", (s,e))
        exp = c.fetchone()[0]
        conn.close()
        results.append({'month': f"{y}-{m:02d}", 'label': d.strftime('%b %Y'),
                        'income': inc, 'expense': exp, 'net': inc - exp})
    return jsonify(results)

# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
