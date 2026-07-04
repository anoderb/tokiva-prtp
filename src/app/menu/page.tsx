'use client';

import React, { useState } from 'react';
import { Settings, Info, Trash2, Heart, Award } from 'lucide-react';
import { ToastItem, ToastInfo } from '@/components/ui';

/**
 * Menu & settings page for resetting cache and reading system parameters.
 */
export default function MenuPage() {
  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  const addToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'success') => {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleResetCache = () => {
    if (!confirm('Apakah Anda yakin ingin menghapus cache lokal? Keranjang dan data offline akan di-reset.')) return;
    localStorage.removeItem('tokiva_cart');
    localStorage.removeItem('tokiva_produk_cache');
    localStorage.removeItem('tokiva_kategori_cache');
    addToast('Cache lokal berhasil dibersihkan!', 'success');
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full pb-8">
      {/* Toast Alert stack */}
      <div className="fixed top-4 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-md mx-auto">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onClose={removeToast} />
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="flex items-center gap-2 py-2 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl text-zinc-955">
          <Settings className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-base font-extrabold tracking-wide uppercase text-zinc-100">Pengaturan Menu</h1>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Sistem POS Tokiva</span>
        </div>
      </header>

      {/* Profile info banner card */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/60 to-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3 mt-2 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center font-extrabold text-zinc-950 text-lg shadow-lg shadow-teal-500/10">
            TK
          </div>
          <div className="flex flex-col">
            <h2 className="text-base font-bold text-zinc-200">Tokiva POS Store</h2>
            <span className="text-xs text-zinc-500 font-medium">Mitra Kasir AI Anda</span>
          </div>
        </div>
      </div>

      {/* Menu Cards */}
      <div className="flex flex-col gap-3 mt-2">
        <h3 className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-550 px-1">Sistem & Cache</h3>
        
        {/* Reset Cache Item */}
        <button
          onClick={handleResetCache}
          className="w-full flex items-center justify-between p-4 bg-zinc-900/40 border border-zinc-855 hover:bg-zinc-900/60 rounded-2xl transition-all text-left active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-rose-500/10 text-rose-450 rounded-xl">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-zinc-250">Bersihkan Cache</span>
              <span className="text-xs text-zinc-555 truncate mt-0.5">Reset keranjang dan data offline</span>
            </div>
          </div>
        </button>
      </div>

      {/* About Section */}
      <div className="flex flex-col gap-3 mt-4">
        <h3 className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-550 px-1">Tentang Aplikasi</h3>
        
        <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-4 flex flex-col gap-3.5 text-xs text-zinc-400">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-zinc-350">
              <strong>Tokiva POS</strong> adalah purwarupa kasir pintar berbasis web yang berjalan langsung di peramban (client-side AI) menggunakan pustaka <strong>TensorFlow.js</strong> dan model visual <strong>MobileNetV2</strong>.
            </p>
          </div>
          
          <div className="flex items-start gap-2.5">
            <Award className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-zinc-350">
              Sistem mengekstrak deskriptor gambar (embedding 1280-dimensi) lalu membandingkannya menggunakan perhitungan <em>Cosine Similarity</em> dengan basis data Supabase PostgreSQL untuk mencocokkan produk secara seketika (realtime).
            </p>
          </div>
          
          <div className="border-t border-zinc-900/80 pt-3 flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
            <span>Versi Aplikasi</span>
            <span>1.0.0 (Prototype)</span>
          </div>
        </div>
      </div>

      {/* Footer credits */}
      <div className="mt-8 flex flex-col items-center justify-center gap-1.5 text-[10px] text-zinc-650 font-semibold tracking-wider">
        <span className="flex items-center gap-1 uppercase">
          Made with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> by Antigravity AI
        </span>
        <span>Tokiva Kasir © 2026</span>
      </div>
    </div>
  );
}
