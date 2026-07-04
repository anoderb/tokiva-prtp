export interface Kategori {
  id: number;
  nama: string;
  icon?: string;
  aktif?: boolean;
  created_at?: string;
}

export interface Produk {
  id: number;
  kode: string;
  barcode?: string | null;
  nama: string;
  kategori_id?: number | null;
  satuan: string;
  harga_beli: number;
  harga_jual: number;
  stok: number;
  stok_min: number;
  foto_url?: string | null;
  foto_embedding?: number[][] | null; // List of 1280-dimensional embedding arrays
  is_aktif: boolean;
  created_at?: string;
  updated_at?: string;
  kategori?: Kategori | null;
}

export interface CartItem {
  produk: Produk;
  quantity: number;
}

export interface Transaksi {
  id?: number;
  no_transaksi: string;
  subtotal: number;
  diskon: number;
  total: number;
  bayar: number;
  kembalian: number;
  status: 'lunas' | 'pending' | 'batal';
  created_at?: string;
}

export interface TransaksiDetail {
  id?: number;
  transaksi_id?: number;
  produk_id: number | null;
  nama_produk: string;
  qty: number;
  satuan: string;
  harga_satuan: number;
  subtotal: number;
  created_at?: string;
}
