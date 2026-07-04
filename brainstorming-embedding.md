# Brainstorming — Image Detection Architecture (Final)

## Core Requirements

1. **Model gak boleh lupa** — walau hapus cache browser
2. **Deteksi secepat mungkin** — realtime di kasir
3. **Seakurat mungkin** — minim false positive/negative
4. **Gak lupa pas ganti device** — HP, laptop, beda user
5. **Database: Supabase Postgres** — bukan MySQL lokal

---

## Key Insight

> **Model (MobileNet) tuh gak "hafal" produk.**
> Dia cuma tool buat ngubah gambar jadi vektor.
>
> Yang "hafal" produk itu **embedding database**.
> Kalo embedding disimpen di server — **system gak bakal lupa** meski browser di-clear.

---

## Final Architecture

```
┌─────────────────────────────────────────────────────┐
│                    SUPABASE ECOSYSTEM                  │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Storage     │  │  Postgres DB  │  │  Auth        │ │
│  │  Bucket:     │  │  Table:       │  │  Login       │ │
│  │  model/      │  │  produk       │  │  JWT token   │ │
│  │  produk/     │  │  kategori     │  │              │ │
│  │              │  │  transaksi    │  │              │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
└─────────┼─────────────────┼─────────────────┼─────────┘
          │                 │                 │
┌─ BROWSER┼─────────────────┼─────────────────┼────────┐
│         │                 │                 │         │
│  LOAD MODEL              │                 │         │
│  ← fetch dari            │                 │         │
│    Supabase Storage      │                 │         │
│    → cached browser      │                 │         │
│                          │                 │         │
│  INFERENCE               │                 │         │
│  MobileNet TF.js         │                 │         │
│  → foto → embedding[1024]│                 │         │
│                          │                 │         │
│  MATCHING                │                 │         │
│  cosine similarity       │                 │         │
│  ← embedding dari        │                 │         │
│    Supabase DB           │                 │         │
│                          │                 │         │
│  OFFLINE                 │                 │         │
│  localStorage cadangan   │                 │         │
└──────────────────────────┴─────────────────┴─────────┘
```

---

## Kenapa Model di Supabase (Bukan CDN)?

| Skenario | CDN (tfhub.dev) | **Supabase (self-host)** |
|----------|----------------|------------------------|
| Cache browser ilang | Download ~4MB dari server luar | **Download ~4MB dari server sendiri** |
| Internet lemot | Bisa timeout/routing jelek | Satu ekosistem dengan DB, latency minimal |
| CDN down/limit | ❌ Model gagal load | **✅ Tetap jalan** |
| Speed first load | Tergantung CDN | **Lebih cepet kalo satu region** |
| Setup | 0 (tinggal pake) | **1x upload file model** |

---

## Kenapa Embedding di Supabase DB (Bukan localStorage)?

Ini yang bikin system **beneran ga lupa**.

| Skenario | localStorage ❌ | **Supabase DB ✅** |
|----------|---------------|----------------|
| Clear cache browser | ❌ Hilang semua | ✅ Fetch ulang dari server |
| Ganti device (HP → laptop) | ❌ Embedding kosong | ✅ Ambil dari server |
| Login user beda | ❌ Gak kebaca | ✅ Satu DB pusat |
| Install ulang browser | ❌ Hilang total | ✅ Tetap |
| Offline (server mati) | ✅ Masih ada data lama | ⚠️ Fallback ke localStorage |
| 5000+ produk | ❌ localStorage penuh (~5MB) | ✅ Postgres gak terbatas |

---

## Kecepatan — Optimasi

### Model Loading
```
Self-host di Supabase (1 ekosistem)
  → download model.json + 4 shard .bin (~4MB)
  → HTTP cache browser (Cache-Control: max-age=31536000)
  → setelah first load: instant (dari cache)
  → kalo kena clear cache: redownload dari server sendiri → cepet karena 1 region
```

### Embedding Matching
```
Fetch semua embedding sekali pas app mount:
  → 100 produk: ~400KB
  → 500 produk: ~2MB
  → 1000 produk: ~4MB

Cosine similarity:
  → 100 produk: ~5ms
  → 500 produk: ~25ms
  → 1000 produk: ~50ms

→ Semua di memory (gak ada IO), realtime friendly.
```

### Image Processing
```
Kamera → canvas → resize 224x224 → MobileNet → embedding
→ ~50-100ms total per frame
→ Loop realtime: 5-10 FPS untuk deteksi otomatis pas scan
```

---

## Akurasi — Optimasi

| Teknik | Efek | Implementasi |
|--------|------|-------------|
| **Multi-angle embedding** | Akurasi +40% | 4 foto per produk dari sudut beda |
| **WebP kompresi** | Ukuran foto -60%, quality tetep | Auto compress pas upload |
| **Brightness normalization** | Konsisten walau cahaya beda | Preprocessing sebelum inference |
| **Confidence tiers** | UX lebih cerdas | >0.85 auto, 0.50-0.85 pilih kandidat |
| **Multiple embedding match** | Ambil similarity tertinggi | Udah ada: `getEmbeddingsList()` |

---

## Data Flow — End to End

### 1. Tambah Produk Baru

```
User buka halaman tambah produk
  → Pilih foto (kamera/gallery)
  → Foto dikompres ke WebP (client-side)
  → Upload ke Supabase Storage (bucket: produk)
  → MobileNet infer → embedding[1024]
  → Simpan embedding ke Supabase DB (POST /api/produk/:id/embedding)
  → Simpan embedding ke localStorage (cadangan offline)
  → Done ✅
```

### 2. Kasir — Deteksi Produk

```
App mount
  → GET /api/produk/embeddings (fetch semua embedding dari Supabase DB)
  → Kalau sukses: simpan di memory (React state)
  → Kalau gagal: ambil dari localStorage (offline mode)

User foto produk di kasir
  → Camera → canvas → MobileNet → query_embedding[1024]
  → Cosine similarity vs semua embedding di memory
  → Hasil:
      > 0.85  → auto tambah ke keranjang
      0.50-0.85 → tampil 3 kandidat
      < 0.50 → "Produk gak dikenal" → tambah manual
```

### 3. Ganti Device

```
User login di HP baru
  → GET /api/produk/embeddings → dapet SEMUA embedding dari Supabase DB
  → MobileNet load dari Supabase Storage (cache atau download)
  → Siap deteksi, ga perlu training ulang
```

---

## Summary Keputusan

| Komponen | Keputusan | Alasan |
|----------|-----------|--------|
| **Database** | **Supabase Postgres** | Serverless, auto-scale, RLS, 1 ekosistem |
| **Model location** | **Supabase Storage** (self-host) | Recovery cepet pas cache ilang, ga kena limit CDN |
| **Embedding storage** | **Supabase DB (Postgres) + localStorage** | Gak ilang walau clear cache/ganti device, offline fallback |
| **Foto produk** | **Supabase Storage + kompresi WebP** | Hemat 60% bandwidth, loading cepet |
| **Inference** | **Client-side TF.js WebGL** | Gratis, cepet, offline-capable |
| **Matching** | **In-memory cosine similarity** | 1000 produk < 50ms, realtime |
| **Auth** | **Supabase Auth** | JWT, login gampang, langsung terintegrasi |

---

## Kapan "Lupa" Masih Bisa Terjadi?

| Skenario | Efek | Mitigasi |
|----------|------|----------|
| Hapus cache browser | Model re-download (~4MB) | Self-host di Supabase → download cepet |
| Supabase DB down | Embedding ga bisa di-fetch | Fallback localStorage (data lama masih ada) |
| Hapus semua data Supabase | Ya jelas hilang | Backup DB via Supabase dashboard |
| Ganti device + ga ada internet | Embedding ga bisa di-fetch | Dapet data kalo online pertama kali |

**Intinya:** Dengan arsitektur ini, satu2nya cara bikin system "lupa" adalah **hapus data di Supabase**. Cache browser, ganti HP, install ulang — aman.
