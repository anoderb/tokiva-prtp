# Arsitektur Web Kasir — Prototype

> Dokumen lengkap: arsitektur, struktur folder, database, API, komponen, alur kode.
> Target: Prototype Web Kasir dengan deteksi gambar (MobileNet TF.js) + Supabase.

---

## Daftar Isi

1. [Tech Stack](#1-tech-stack)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Database Schema](#3-database-schema)
4. [Struktur Folder](#4-struktur-folder)
5. [API Endpoints](#5-api-endpoints)
6. [Frontend Components](#6-frontend-components)
7. [Alur Deteksi Produk](#7-alur-deteksi-produk)
8. [Alur Kasir](#8-alur-kasir)
9. [Image Detection Pipeline](#9-image-detection-pipeline)
10. [Kode Penting](#10-kode-penting)

---

## 1. Tech Stack

| Layer | Teknologi | Fungsi |
|-------|-----------|--------|
| **Frontend** | Next.js 14+ (App Router) | Web kasir |
| **Styling** | Tailwind CSS | Responsive mobile-first |
| **Database** | Supabase Postgres | Semua data utama |
| **Storage** | Supabase Storage | Foto produk + file model |
| **Auth** | Supabase Auth | Login user |
| **Image Detection** | TensorFlow.js + MobileNetV2 | Deteksi produk via kamera |
| **OCR** | Tesseract.js | Baca nota supplier (opsional) |
| **Barcode** | @zxing/browser | Scan barcode produk |
| **Deploy** | Vercel (frontend) | Hosting otomatis dari GitHub |

---

## 2. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER (Client)                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Next.js App (Web Kasir)                  │   │
│  │                                                       │   │
│  │  Pages:                                               │   │
│  │  /login        → Form login                          │   │
│  │  /kasir        → Halaman utama kasir                  │   │
│  │  /produk       → Manajemen produk                    │   │
│  │  /produk/tambah→ Tambah produk baru                   │   │
│  │  /riwayat      → Riwayat transaksi                   │   │
│  │                                                       │   │
│  │  Components:                                          │   │
│  │  CameraCapture → Kamera + deteksi otomatis            │   │
│  │  ProductList   → Grid produk + search + barcode       │   │
│  │  CartWidget    → Keranjang + hitung otomatis          │   │
│  │  CheckoutModal → Modal bayar + kembalian              │   │
│  │                                                       │   │
│  │  Lib:                                                 │   │
│  │  supabase.ts   → Supabase client                      │   │
│  │  image_classifier.ts → TF.js + MobileNet              │   │
│  │  barcode_scanner.ts → @zxing scanner                  │   │
│  │                                                       │   │
│  └──────────────────────┬──────────────────────────────┘   │
└─────────────────────────┼──────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │        HTTP / HTTPS            │
          │    (server actions / API)      │
          └───────────────┬───────────────┘
                          │
┌─────────────────────────┼──────────────────────────────────┐
│                SUPABASE (Backend as a Service)              │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Postgres    │  │  Storage      │  │  Auth            │  │
│  │  Database    │  │               │  │                  │  │
│  │  ┌─────────┐ │  │  bucket:     │  │  Tabel: users    │  │
│  │  │ produk  │ │  │  model/     │  │  JWT auth        │  │
│  │  │ kategori│ │  │  produk/    │  │  Row Level Sec.  │  │
│  │  │ transaksi│ │  │             │  │                  │  │
│  │  │ user    │ │  │             │  │                  │  │
│  │  └─────────┘ │  │             │  │                  │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 Tabel: `produk`

```sql
CREATE TABLE produk (
  id            BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  kode          TEXT UNIQUE NOT NULL,
  barcode       TEXT UNIQUE,
  nama          TEXT NOT NULL,
  kategori_id   BIGINT REFERENCES kategori(id),
  satuan        TEXT DEFAULT 'pcs',
  harga_beli    DECIMAL(15,2) DEFAULT 0,
  harga_jual    DECIMAL(15,2) NOT NULL,
  stok          DECIMAL(12,2) DEFAULT 0,
  stok_min      DECIMAL(12,2) DEFAULT 5,
  foto_url      TEXT,         -- URL dari Supabase Storage
  foto_embedding JSONB,       -- [[0.12, -0.45, ...], [0.87, ...]]
  is_aktif      BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_produk_kategori ON produk(kategori_id);
CREATE INDEX idx_produk_nama ON produk USING gin(nama gin_trgm_ops); -- untuk search
CREATE INDEX idx_produk_barcode ON produk(barcode);
```

### 3.2 Tabel: `kategori`

```sql
CREATE TABLE kategori (
  id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nama       TEXT UNIQUE NOT NULL,
  icon       TEXT DEFAULT '📦',
  aktif      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 Tabel: `transaksi`

```sql
CREATE TABLE transaksi (
  id            BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  no_transaksi  TEXT UNIQUE NOT NULL,
  user_id       UUID REFERENCES auth.users(id),
  subtotal      DECIMAL(15,2) NOT NULL,
  diskon        DECIMAL(15,2) DEFAULT 0,
  total         DECIMAL(15,2) NOT NULL,
  bayar         DECIMAL(15,2) DEFAULT 0,
  kembalian     DECIMAL(15,2) DEFAULT 0,
  status        TEXT DEFAULT 'lunas',  -- lunas, pending, batal
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transaksi_tanggal ON transaksi(created_at DESC);
```

### 3.4 Tabel: `transaksi_detail`

```sql
CREATE TABLE transaksi_detail (
  id            BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  transaksi_id  BIGINT REFERENCES transaksi(id) ON DELETE CASCADE,
  produk_id     BIGINT REFERENCES produk(id),
  nama_produk   TEXT NOT NULL,
  qty           DECIMAL(10,2) NOT NULL,
  satuan        TEXT DEFAULT 'pcs',
  harga_satuan  DECIMAL(15,2) NOT NULL,
  subtotal      DECIMAL(15,2) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_detail_transaksi ON transaksi_detail(transaksi_id);
```

### 3.5 Tabel: `profile` (profil user tambahan)

```sql
CREATE TABLE profile (
  id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama     TEXT NOT NULL,
  role     TEXT DEFAULT 'kasir',
  aktif    BOOLEAN DEFAULT true
);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profile (id, nama, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'nama', 'User'), 'kasir');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 3.6 Row Level Security (RLS)

```sql
-- produk: semua user bisa baca, hanya admin bisa tulis
ALTER TABLE produk ENABLE ROW LEVEL SECURITY;
CREATE POLICY "produk_select_all" ON produk FOR SELECT USING (true);
CREATE POLICY "produk_insert_admin" ON produk FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT id FROM profile WHERE role = 'admin')
);

-- transaksi: user lihat transaksi sendiri
ALTER TABLE transaksi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transaksi_select_own" ON transaksi
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "transaksi_insert" ON transaksi
  FOR INSERT WITH CHECK (user_id = auth.uid());
```

---

## 4. Struktur Folder

```
kasir/
├── .env.local
├── next.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
│
├── public/
│   └── model/                  ← MobileNet model files (upload to Supabase)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← Root layout + Supabase provider
│   │   ├── page.tsx            ← Redirect ke /kasir
│   │   ├── login/
│   │   │   └── page.tsx        ← Login form
│   │   ├── kasir/
│   │   │   ├── layout.tsx      ← Layout kasir (sidebar/header)
│   │   │   ├── page.tsx        ← Halaman utama kasir
│   │   │   └── riwayat/
│   │   │       └── page.tsx    ← Riwayat transaksi
│   │   ├── produk/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx        ← Daftar produk
│   │   │   └── tambah/
│   │   │       └── page.tsx    ← Tambah produk + kamera
│   │   └── api/
│   │       └── produk/
│   │           ├── embeddings/route.ts   ← GET semua embedding
│   │           └── [id]/embedding/route.ts ← POST embedding
│   │
│   ├── components/
│   │   ├── CameraCapture.tsx   ← Kamera + deteksi otomatis
│   │   ├── ProductGrid.tsx     ← Grid produk + search
│   │   ├── CartWidget.tsx      ← Keranjang belanja
│   │   ├── CheckoutModal.tsx   ← Modal bayar
│   │   └── ui/                ← UI primitives
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       └── Toast.tsx
│   │
│   ├── lib/
│   │   ├── supabase.ts         ← Supabase client (server + browser)
│   │   ├── image_classifier.ts ← TF.js MobileNet + cosine similarity
│   │   ├── barcode_scanner.ts  ← @zxing barcode scanner
│   │   ├── format_rupiah.ts    ← Number → Rp formatter
│   │   └── konstanta.ts       ← Konfigurasi umum
│   │
│   ├── hooks/
│   │   ├── useAuth.tsx         ← Auth state + login/logout
│   │   ├── useProduk.tsx       ← Produk CRUD + embedding
│   │   └── useTransaksi.tsx    ← Transaksi + cart state
│   │
│   └── types/
│       ├── produk.ts           ← TypeScript interfaces
│       └── transaksi.ts
```

---

## 5. API Endpoints

### Via Server Actions (Next.js API Routes)

| Method | Endpoint | Fungsi | Auth |
|--------|----------|--------|------|
| GET | `/api/produk` | List produk (search, filter) | JWT |
| GET | `/api/produk/embeddings` | Ambil semua {id, foto_embedding} | JWT |
| POST | `/api/produk/:id/embedding` | Simpan embedding produk | JWT |
| POST | `/api/transaksi` | Buat transaksi baru | JWT |
| GET | `/api/transaksi/riwayat` | Riwayat transaksi user | JWT |
| POST | `/api/upload` | Upload foto ke Supabase Storage | JWT |

### Via Supabase Client Langsung (Browser → Supabase)

| Query | Fungsi |
|-------|--------|
| `supabase.from('produk').select('*')` | Ambil semua produk |
| `supabase.from('transaksi').insert(...)` | Buat transaksi |
| `supabase.from('transaksi_detail').insert(...)` | Simpan detail transaksi |
| `supabase.storage.from('produk').upload(...)` | Upload foto produk |

Untuk prototype, **pake Supabase client langsung dari browser** (dengan RLS) biar cepet — gak perlu nulis backend sendiri.

---

## 6. Frontend Components

### 6.1 Halaman Login (`/login`)
- Form username + password
- Login via `supabase.auth.signInWithPassword()`
- Redirect ke `/kasir`

### 6.2 Halaman Kasir (`/kasir`) — MAIN PAGE

```
┌──────────────────────────────────────────────┐
│ 🔍 [Cari produk...]        Kamera │ Barcode │
├──────────────────────────────────────────────┤
│                                              │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐      │
│  │   │ │   │ │   │ │   │ │   │ │   │      │
│  │   │ │   │ │   │ │   │ │   │ │   │      │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘      │
│  Indomie  Aqua   Telur   Gula   Beras  Minyak│
│                                              │
│  ────────── more ──────────                  │
│                                              │
├──────────────────────────────────────────────┤
│  Keranjang (3 item)              Rp 45.000   │
│  [Lihat Keranjang →]                        │
└──────────────────────────────────────────────┘
```

**Fitur:**
- Search bar (filter produk by nama/kode/barcode)
- Tombol kamera (buka `CameraCapture`)
- Tombol barcode (scan barcode realtime)
- Grid produk (ambil dari Supabase)
- Tap produk → tambah ke keranjang
- Bottom bar: total + tombol checkout

### 6.3 CameraCapture Component
- Buka kamera belakang (`facingMode: 'environment'`)
- 2 mode:
  - **Otomatis:** Loop deteksi tiap 2 detik → kalo cocok auto tambah
  - **Manual:** User tap tombol → capture → deteksi
- Tampilkan preview bounding box / hasil deteksi
- Kalo similarity > 0.85 → langsung tambah ke keranjang + notif
- Kalo 0.50-0.85 → tampil kandidat

### 6.4 CartWidget Component

```
┌─── KERANJANG ───────────────────────────────┐
│                                              │
│  Indomie Goreng      x2    Rp 7.000          │
│  Aqua 600ml          x3    Rp 6.000          │
│  Telur 1kg           x1    Rp 28.000         │
│  ─────────────────────────────────           │
│  Subtotal                  Rp 41.000          │
│  Diskon                    Rp 0               │
│  Total                     Rp 41.000          │
│                                              │
│  [Bayar Rp 41.000]                           │
└──────────────────────────────────────────────┘
```

**Fitur:**
- List item di keranjang
- Tap qty → edit (+/-)
- Swipe item → hapus
- Total otomatis kena update
- Tombol bayar → buka `CheckoutModal`

### 6.5 CheckoutModal
- Input nominal bayar
- Hitung kembalian otomatis
- Tombol "Bayar" → simpan transaksi ke Supabase
- Cetak struk (opsional, bisa di-skip prototype)

---

## 7. Alur Deteksi Produk

```
           ┌──────────────┐
           │ User tap     │
           │ "Kamera"     │
           └──────┬───────┘
                  │
           ┌──────┴───────┐
           │ Buka kamera  │
           │ (environment)│
           └──────┬───────┘
                  │
     ┌────────────┴────────────┐
     │                         │
     ▼                         ▼
Mode Otomatis             Mode Manual
─────────────────    ─────────────────
Loop tiap 2 detik:    User tap tombol:
  1. Capture frame       1. Capture frame
  2. Canvas → TF.js      2. Canvas → TF.js
  3. Embedding[]         3. Embedding[]
  4. Cosine match        4. Cosine match
  5a. >0.85 → auto      5a. >0.85 → auto
      add to cart           add to cart
  5b. 0.50-0.85 →       5b. 0.50-0.85 →
      show candidates       show candidates
  5c. <0.50 → skip       5c. <0.50 →
                             "Gak kenal"
     └────────────             └────────────
          │                         │
          ▼                         ▼
    ┌──────────────────────┐
    │ Tambah ke keranjang  │
    │ → hitung subtotal    │
    │ → update total       │
    └──────────────────────┘
```

### Fallback Manual:
```
User tap ikon search / keyboard
  → filter produk berdasarkan input
  → tap produk → tambah ke keranjang
```

---

## 8. Alur Kasir (Full Transaction Flow)

```
1. User login → redirect ke /kasir

2. Fetch produk + embedding dari Supabase:
   → GET /api/produk (search)
   → GET /api/produk/embeddings

3. User tambah produk ke keranjang:
   a. Scan barcode → auto match
   b. Kamera → deteksi otomatis/manual
   c. Search + tap produk

4. Keranjang:
   → Setiap tambah: hitung subtotal
   → Edit qty: update subtotal
   → Hapus: recalculate

5. User tap "Bayar":
   → Input nominal bayar
   → Hitung kembalian otomatis
   → Konfirmasi

6. Simpan transaksi:
   → INSERT transaksi (total, bayar, kembalian)
   → INSERT transaksi_detail (item-item)
   → Update stok produk
   → Reset keranjang

7. Selesai → siap transaksi berikutnya
```

---

## 9. Image Detection Pipeline

### 9.1 Loading Model

```typescript
// src/lib/image_classifier.ts
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

const MODEL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL +
  '/storage/v1/object/public/model/mobilenet/model.json';

let model: mobilenet.MobileNet | null = null;

export async function loadModel() {
  if (model) return model;
  
  // Init TF.js backend
  await tf.ready();
  try {
    await tf.setBackend('webgl');
  } catch {
    await tf.setBackend('cpu');
  }
  
  // Load model dari Supabase Storage
  model = await mobilenet.load({ url: MODEL_URL });
  return model;
}
```

### 9.2 Generate Embedding

```typescript
export async function getEmbedding(
  image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<number[]> {
  const m = await loadModel();
  return tf.tidy(() => {
    const embedding = m.infer(image, true); // true = embedding mode
    return Array.from(embedding.dataSync());
  });
}
```

### 9.3 Cosine Similarity

```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### 9.4 Find Nearest Product

```typescript
export function findNearest(
  query: number[],
  products: Array<{ id: number; embedding: number[][] }>,
  threshold = 0.5
) {
  return products
    .map(p => {
      const bestSim = Math.max(
        ...p.embedding.map(emb => cosineSimilarity(query, emb))
      );
      return { id: p.id, similarity: bestSim };
    })
    .filter(r => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}
```

---

## 10. Kode Penting

### 10.1 Supabase Client

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 10.2 Auth Hook

```typescript
// src/hooks/useAuth.tsx
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
  }, []);

  const login = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password });

  const logout = () => supabase.auth.signOut();

  return { user, loading, login, logout };
}
```

### 10.3 Produk Hook

```typescript
// src/hooks/useProduk.tsx
export function useProduk() {
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [embeddings, setEmbeddings] = useState<Map<number, number[][]>>(new Map());

  // Fetch produk
  const fetchProduk = async () => {
    const { data } = await supabase.from('produk').select('*').eq('is_aktif', true);
    setProdukList(data || []);
  };

  // Fetch embedding untuk matching
  const fetchEmbeddings = async () => {
    const { data } = await supabase.from('produk')
      .select('id, foto_embedding')
      .not('foto_embedding', 'is', null);
    
    const map = new Map();
    data?.forEach(p => map.set(p.id, p.foto_embedding));
    setEmbeddings(map);
  };

  // Simpan embedding ke Supabase
  const saveEmbedding = async (id: number, embedding: number[][]) => {
    await supabase.from('produk')
      .update({ foto_embedding: embedding })
      .eq('id', id);
  };

  return { produkList, embeddings, fetchProduk, fetchEmbeddings, saveEmbedding };
}
```

### 10.4 Camera Capture

```typescript
// src/components/CameraCapture.tsx — core logic
async function captureAndDetect() {
  if (!videoRef.current) return;

  // 1. Capture frame ke canvas
  const canvas = document.createElement('canvas');
  canvas.width = videoRef.current.videoWidth;
  canvas.height = videoRef.current.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(videoRef.current, 0, 0);

  // 2. Generate embedding dari frame
  const queryEmb = await getEmbedding(canvas);

  // 3. Cari produk terdekat
  const matches = findNearest(queryEmb, allEmbeddings);

  if (matches.length > 0 && matches[0].similarity > 0.85) {
    // Auto add to cart
    const produk = produkList.find(p => p.id === matches[0].id);
    if (produk) {
      addToCart(produk);
      playBeep();
      closeCamera();
    }
  } else if (matches.length > 0 && matches[0].similarity > 0.5) {
    // Show top 3 candidates for user to pick
    setCandidates(matches.slice(0, 3));
  }
}
```

---

## Catatan Implementasi

1. **Prototype scope** — Web kasir aja. Gak include stok opname, laporan, manajemen supplier, dll.
2. **Supabase free tier** — Cukup buat 100-500 produk, 1GB storage, 50k row di DB.
3. **Model MobileNet** — Upload 1x ke Supabase Storage (model.json + .bin files).
4. **Embedding sync** — Pas tambah produk: simpen ke Supabase DB + localStorage.
5. **Offline fallback** — localStorage tetap diisi sebagai cadangan.
6. **RLS** — Semua query dari browser via Supabase client langsung. Aman dengan RLS.
