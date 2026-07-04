-- Database Schema untuk Tokiva Kasir Prototype

-- 1. Tabel Kategori
CREATE TABLE IF NOT EXISTS kategori (
  id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nama       TEXT UNIQUE NOT NULL,
  icon       TEXT DEFAULT '📦',
  aktif      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Produk
CREATE TABLE IF NOT EXISTS produk (
  id             BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  kode           TEXT UNIQUE NOT NULL,
  barcode        TEXT UNIQUE,
  nama           TEXT NOT NULL,
  kategori_id    BIGINT REFERENCES kategori(id) ON DELETE SET NULL,
  satuan         TEXT DEFAULT 'pcs',
  harga_beli     DECIMAL(15,2) DEFAULT 0,
  harga_jual     DECIMAL(15,2) NOT NULL,
  stok           DECIMAL(12,2) DEFAULT 0,
  stok_min       DECIMAL(12,2) DEFAULT 5,
  foto_url       TEXT,         -- URL dari Supabase Storage
  foto_embedding JSONB,       -- [[embedding1_1280], [embedding2_1280]]
  is_aktif       BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produk_kategori ON produk(kategori_id);
CREATE INDEX IF NOT EXISTS idx_produk_barcode ON produk(barcode);

-- 3. Tabel Transaksi (Tanpa Auth / Public POS)
CREATE TABLE IF NOT EXISTS transaksi (
  id            BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  no_transaksi  TEXT UNIQUE NOT NULL,
  subtotal      DECIMAL(15,2) NOT NULL,
  diskon        DECIMAL(15,2) DEFAULT 0,
  total         DECIMAL(15,2) NOT NULL,
  bayar         DECIMAL(15,2) DEFAULT 0,
  kembalian     DECIMAL(15,2) DEFAULT 0,
  status        TEXT DEFAULT 'lunas',  -- lunas, pending, batal
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaksi_tanggal ON transaksi(created_at DESC);

-- 4. Tabel Detail Transaksi
CREATE TABLE IF NOT EXISTS transaksi_detail (
  id            BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  transaksi_id  BIGINT REFERENCES transaksi(id) ON DELETE CASCADE,
  produk_id     BIGINT REFERENCES produk(id) ON DELETE SET NULL,
  nama_produk   TEXT NOT NULL,
  qty           DECIMAL(10,2) NOT NULL,
  satuan        TEXT DEFAULT 'pcs',
  harga_satuan  DECIMAL(15,2) NOT NULL,
  subtotal      DECIMAL(15,2) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detail_transaksi ON transaksi_detail(transaksi_id);

-- Enable Row Level Security (RLS) & Setup Open Policies untuk Prototype Tanpa Login
ALTER TABLE kategori ENABLE ROW LEVEL SECURITY;
ALTER TABLE produk ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi_detail ENABLE ROW LEVEL SECURITY;

-- Kategori Policies
DROP POLICY IF EXISTS "kategori_all" ON kategori;
CREATE POLICY "kategori_all" ON kategori FOR ALL USING (true) WITH CHECK (true);

-- Produk Policies
DROP POLICY IF EXISTS "produk_all" ON produk;
CREATE POLICY "produk_all" ON produk FOR ALL USING (true) WITH CHECK (true);

-- Transaksi Policies
DROP POLICY IF EXISTS "transaksi_all" ON transaksi;
CREATE POLICY "transaksi_all" ON transaksi FOR ALL USING (true) WITH CHECK (true);

-- Transaksi Detail Policies
DROP POLICY IF EXISTS "transaksi_detail_all" ON transaksi_detail;
CREATE POLICY "transaksi_detail_all" ON transaksi_detail FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- SEED DATA (Dummy Produk & Kategori untuk Awal)
-- =========================================================================

-- Insert Kategori
INSERT INTO kategori (nama, icon) VALUES
('Makanan', '🍜'),
('Minuman', '🥤'),
('Kebutuhan Harian', '🧴'),
('Snack', '🍿')
ON CONFLICT (nama) DO NOTHING;

-- Insert Produk Dummy (dengan data standar)
-- Catatan: foto_embedding diisi NULL dulu, nanti digenerate lewat UI admin tambah produk.
INSERT INTO produk (kode, barcode, nama, kategori_id, satuan, harga_beli, harga_jual, stok, stok_min)
VALUES
('INDOMIE-GRG', '070662010014', 'Indomie Goreng Spesial', (SELECT id FROM kategori WHERE nama = 'Makanan'), 'pcs', 2500, 3500, 100, 10),
('AQUA-600', '8886008101053', 'Aqua Botol 600ml', (SELECT id FROM kategori WHERE nama = 'Minuman'), 'pcs', 2000, 3000, 150, 15),
('TELUR-AYAM', 'TELUR-AYAM', 'Telur Ayam Broiler 1kg', (SELECT id FROM kategori WHERE nama = 'Makanan'), 'kg', 24000, 28000, 20, 5),
('COCA-COLA', '8886000100179', 'Coca Cola Slim Can 250ml', (SELECT id FROM kategori WHERE nama = 'Minuman'), 'pcs', 4500, 6000, 50, 8),
('GULA-KU', '8994503001112', 'Gulaku Gula Pasir Premium 1kg', (SELECT id FROM kategori WHERE nama = 'Kebutuhan Harian'), 'pcs', 14000, 17000, 30, 5)
ON CONFLICT (kode) DO NOTHING;
