'use client';

import React, { useState } from 'react';
import { useProduk } from '@/hooks/use-produk';
import { supabase } from '@/lib/supabase';
import { formatRupiah } from '@/lib/format';
import Link from 'next/link';
import { Package, Plus, Camera, Trash2, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { ToastItem, ToastInfo } from '@/components/ui';

/**
 * Produk List Page (Admin/Inventory view).
 * Shows list of current inventory with details on stocks, prices, and registered AI embeddings.
 */
export default function ProdukPage() {
  const { produkList, loading, refresh } = useProduk();
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const addToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'success') => {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!confirm(`Hapus produk "${name}" dari database?`)) return;
    
    setDeletingId(id);
    try {
      const { error: deleteError } = await supabase
        .from('produk')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      
      addToast(`Produk "${name}" berhasil dihapus`, 'success');
      refresh();
    } catch (err: any) {
      console.error('Delete error:', err);
      addToast(`Gagal menghapus produk: ${err.message || 'Error'}`, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full pb-8">
      {/* Toast Notification stack */}
      <div className="fixed top-4 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-md mx-auto">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onClose={removeToast} />
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="flex items-center justify-between py-2 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl text-zinc-950">
            <Package className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-extrabold tracking-wide uppercase text-zinc-100">Daftar Produk</h1>
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Manajemen Inventaris</span>
          </div>
        </div>

        <Link
          href="/produk/tambah"
          className="flex items-center gap-1 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-955 font-bold rounded-xl active:scale-95 transition-all text-xs uppercase tracking-wider"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah</span>
        </Link>
      </header>

      {/* Products list body */}
      {loading && produkList.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-550">Memuat database produk...</span>
        </div>
      ) : produkList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
          <Package className="w-12 h-12 text-zinc-800" />
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Belum ada produk di database</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {produkList.map((p) => {
            const hasEmbeddings = p.foto_embedding && p.foto_embedding.length > 0;
            const embedCount = p.foto_embedding?.length || 0;
            const isDeleting = deletingId === p.id;

            return (
              <div
                key={p.id}
                className="bg-zinc-900/40 border border-zinc-800/80 p-3.5 rounded-2xl flex items-center justify-between gap-3"
              >
                {/* Product details info */}
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <div className="w-12 h-12 bg-zinc-950 border border-zinc-900 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                    {p.foto_url ? (
                      <img src={p.foto_url} alt={p.nama} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">{p.kategori?.icon || '📦'}</span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-100 truncate">{p.nama}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono text-zinc-550 flex-wrap">
                      <span>Kode: {p.kode}</span>
                      {p.barcode && <span>• Barcode: {p.barcode}</span>}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-bold text-teal-400 font-mono">
                        {formatRupiah(p.harga_jual)}
                      </span>
                      <span className="text-[10px] font-semibold text-zinc-500">
                        Stok: {Math.round(p.stok)} {p.satuan}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI state status & Quick Actions */}
                <div className="flex flex-col items-end gap-2.5 shrink-0">
                  {/* AI Status Badge */}
                  {hasEmbeddings ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {embedCount} AI Active
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      AI Pending
                    </div>
                  )}

                  {/* Actions buttons */}
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/produk/tambah?registerId=${p.id}`}
                      title="Daftarkan Foto Kamera (AI)"
                      className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-teal-400 hover:border-teal-900/40 active:scale-95 transition-all"
                    >
                      <Camera className="w-4 h-4" />
                    </Link>
                    
                    <button
                      onClick={() => handleDeleteProduct(p.id, p.nama)}
                      disabled={isDeleting}
                      title="Hapus Produk"
                      className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-rose-450 hover:border-rose-900/40 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
