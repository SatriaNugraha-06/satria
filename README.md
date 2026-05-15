# 💰 FinTrack — Personal Finance Tracker

Aplikasi web pelacak keuangan pribadi berbasis **Python (Flask)** dengan antarmuka modern dan gelap.

---

## ✨ Fitur

| Fitur | Keterangan |
|-------|------------|
| **Dashboard** | Saldo total, pemasukan, pengeluaran, rasio tabungan |
| **Grafik Tren** | Bar chart 6 bulan terakhir (pemasukan vs pengeluaran) |
| **Donut Chart** | Distribusi pengeluaran per kategori |
| **Arus Kas Harian** | Line chart harian dalam satu bulan |
| **Manajemen Transaksi** | Tambah, filter, & hapus transaksi |
| **Anggaran Bulanan** | Atur batas per kategori + progress bar |
| **Navigasi Bulan** | Lihat data bulan mana pun |
| **Database SQLite** | Data tersimpan permanen di `finance.db` |

---

## 🚀 Cara Menjalankan

### 1. Install dependensi

```bash
pip install -r requirements.txt
```

### 2. Jalankan aplikasi

```bash
python app.py
```

### 3. Buka di browser

```
http://localhost:5000
```

---

## 📁 Struktur Proyek

```
finance_tracker/
├── app.py                  # Backend Flask + API endpoints
├── requirements.txt        # Dependensi Python
├── finance.db              # Database SQLite (auto-dibuat)
├── templates/
│   └── index.html          # Template HTML utama
└── static/
    ├── css/
    │   └── style.css       # Stylesheet (dark fintech theme)
    └── js/
        └── app.js          # Frontend logic + Chart.js
```

---

## 🔌 API Endpoints

| Method | URL | Keterangan |
|--------|-----|------------|
| `GET`  | `/api/summary` | Ringkasan bulan (income, expense, balance) |
| `GET`  | `/api/transactions` | Daftar transaksi bulan tertentu |
| `POST` | `/api/transactions` | Tambah transaksi baru |
| `DELETE` | `/api/transactions/<id>` | Hapus transaksi |
| `GET`  | `/api/budgets` | Anggaran + realisasi per kategori |
| `POST` | `/api/budgets` | Set anggaran kategori |
| `GET`  | `/api/stats/monthly` | Statistik 6 bulan terakhir |

---

## 🛠 Teknologi

- **Backend**: Python 3.10+, Flask, SQLite3
- **Frontend**: Vanilla JS, Chart.js 4
- **Font**: DM Serif Display, IBM Plex Mono, Instrument Sans
- **Database**: SQLite (tanpa ORM tambahan)

---

## 📦 Kategori Default

**Pemasukan**: Gaji, Freelance, Investasi, Bisnis, Hadiah, Lainnya

**Pengeluaran**: Makanan, Transportasi, Hiburan, Tagihan, Kesehatan, Belanja, Pendidikan, Tabungan, Lainnya
