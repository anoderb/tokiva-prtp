'use client';

import React, { useState, useMemo } from 'react';
import { Produk, Kategori } from '../types';
import { formatRupiah } from '../lib/format';
import { Search, Package, AlertCircle } from 'lucide-react';

interface ProductGridProps {
  products: Produk[];
  categories: Kategori[];
  onProductSelect: (produk: Produk) => void;
}

/**
 * Mobile-responsive product browsing grid with integrated search query filters and horizontal category tab switching.
 */
export default function ProductGrid({
  products,
  categories,
  onProductSelect,
}: ProductGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.kode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        selectedCategory === null || p.kategori_id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  return (
    <div className="flex flex-col gap-4">
      {/* Modern Search Input with Icon */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
          <Search className="w-4 h-4 text-zinc-500" />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari produk (nama, kode, barcode)..."
          className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-zinc-150 placeholder-zinc-500 rounded-xl text-sm transition-all outline-none"
        />
      </div>

      {/* Horizontal Scroll Categories */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mx-4 px-4">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${
            selectedCategory === null
              ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Semua
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border flex items-center gap-1.5 ${
              selectedCategory === cat.id
                ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>{cat.icon || '📦'}</span>
            <span>{cat.nama}</span>
          </button>
        ))}
      </div>

      {/* Grid Display */}
      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2.5">
          <Package className="w-12 h-12 text-zinc-800" />
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Produk Tidak Ditemukan</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-8">
          {filteredProducts.map((p) => {
            const isLowStock = p.stok <= p.stok_min;
            const hasEmbeddings = p.foto_embedding && p.foto_embedding.length > 0;

            return (
              <button
                key={p.id}
                onClick={() => onProductSelect(p)}
                disabled={p.stok <= 0}
                className={`relative flex flex-col bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-3 text-left transition-all duration-200 active:scale-[0.98] group overflow-hidden ${
                  p.stok <= 0 ? 'opacity-40 cursor-not-allowed' : 'hover:border-zinc-750'
                }`}
              >
                {/* Visual Image / Category Icon Box */}
                <div className="aspect-square w-full bg-zinc-950/80 rounded-xl flex items-center justify-center mb-3 relative overflow-hidden border border-zinc-900">
                  {p.foto_url ? (
                    <img
                      src={p.foto_url}
                      alt={p.nama}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <span className="text-4xl filter drop-shadow">
                      {p.kategori?.icon || '📦'}
                    </span>
                  )}

                  {/* Stock State Badges */}
                  {p.stok <= 0 ? (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="bg-rose-600 text-white text-[10px] font-extrabold uppercase px-2 py-1 rounded-md tracking-wider">
                        Habis
                      </span>
                    </div>
                  ) : isLowStock ? (
                    <div className="absolute top-2 left-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-1.5 py-0.5 rounded-lg text-[8px] font-bold uppercase flex items-center gap-1 backdrop-blur-sm">
                      <AlertCircle className="w-3 h-3" />
                      Stok Tipis
                    </div>
                  ) : null}

                  {/* Embedding State Badge */}
                  {!hasEmbeddings && p.stok > 0 && (
                    <div className="absolute bottom-2 right-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-wider backdrop-blur-sm">
                      No AI
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider truncate mb-0.5">
                    {p.kategori?.nama || 'Tanpa Kategori'}
                  </span>
                  <h4 className="text-sm font-semibold text-zinc-200 line-clamp-2 leading-snug tracking-wide group-hover:text-zinc-100 flex-1">
                    {p.nama}
                  </h4>
                  <div className="mt-3 flex items-baseline justify-between gap-1 flex-wrap border-t border-zinc-900 pt-2">
                    <span className="text-sm font-bold text-teal-400 font-mono">
                      {formatRupiah(p.harga_jual)}
                    </span>
                    <span className="text-[10px] font-medium text-zinc-500">
                      Stok: {Math.round(p.stok)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
