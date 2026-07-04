'use client';

import React, { useState } from 'react';
import { CartItem } from '../types';
import { formatRupiah } from '../lib/format';
import { ShoppingCart, ChevronUp, ChevronDown, Trash2, Plus, Minus } from 'lucide-react';
import { Button } from './ui';

interface CartWidgetProps {
  cartItems: CartItem[];
  totalQty: number;
  total: number;
  updateQuantity: (produkId: number, quantity: number) => void;
  removeFromCart: (produkId: number) => void;
  onCheckout: () => void;
  onClearCart?: () => void;
}

/**
 * CartWidget displays a sticky bottom preview bar for active orders.
 * Expands into a slide-up panel allowing quantity edits and single-tap removals.
 */
export default function CartWidget({
  cartItems,
  totalQty,
  total,
  updateQuantity,
  removeFromCart,
  onCheckout,
  onClearCart,
}: CartWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (totalQty === 0) return null;

  return (
    <>
      {/* Trigger Sticky Bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-4 py-3 bg-zinc-950 border-t border-zinc-900 backdrop-blur-md shadow-2xl max-w-md mx-auto">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2.5 text-left focus:outline-none"
          >
            <div className="p-2 bg-teal-500/10 text-teal-400 rounded-xl relative">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-1.5 bg-teal-500 text-zinc-950 text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center border border-zinc-950">
                {totalQty}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-0.5">
                Keranjang Belanja
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-teal-400" /> : <ChevronUp className="w-3.5 h-3.5 text-teal-400" />}
              </span>
              <span className="text-sm font-bold text-zinc-100 font-mono">
                {formatRupiah(total)}
              </span>
            </div>
          </button>
          
          <Button
            variant="primary"
            size="md"
            onClick={onCheckout}
            className="font-bold text-xs uppercase tracking-wider min-w-[100px]"
          >
            Bayar
          </Button>
        </div>
      </div>

      {/* Slide-up Details Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-20 flex flex-col justify-end max-w-md mx-auto">
          {/* Backdrop blur */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel Sheet */}
          <div className="relative bg-zinc-950 border-t border-zinc-850 rounded-t-3xl shadow-2xl z-10 flex flex-col max-h-[70vh] animate-in slide-in-from-bottom duration-250">
            {/* Grab handle for touch feel */}
            <div className="flex justify-center py-3" onClick={() => setIsOpen(false)}>
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full cursor-pointer" />
            </div>

            {/* Header */}
            <div className="px-5 py-2 border-b border-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Detail Belanja</h3>
                {onClearCart && (
                  <button
                    onClick={() => {
                      onClearCart();
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-rose-400 hover:text-rose-350 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-md active:scale-95 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                    Kosongkan 🗑️
                  </button>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-teal-400 hover:text-teal-350 uppercase tracking-wider"
              >
                Tutup
              </button>
            </div>

            {/* Items scrolling list */}
            <div className="flex-1 overflow-y-auto px-5 py-2 divide-y divide-zinc-900/60 no-scrollbar">
              {cartItems.map((item) => (
                <div key={item.produk.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-zinc-200 truncate">{item.produk.nama}</h4>
                    <span className="text-xs text-zinc-500 font-mono">
                      {formatRupiah(item.produk.harga_jual)} / {item.produk.satuan}
                    </span>
                  </div>

                  {/* Qty increment controls */}
                  <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800/80 rounded-xl p-1 shrink-0">
                    <button
                      onClick={() => updateQuantity(item.produk.id, item.quantity - 1)}
                      className="p-1.5 text-zinc-450 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold font-mono px-1.5 text-zinc-205 min-w-[20px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.produk.id, item.quantity + 1)}
                      className="p-1.5 text-zinc-450 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Subtotal & Action */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0 min-w-[80px]">
                    <span className="text-sm font-bold text-zinc-150 font-mono">
                      {formatRupiah(item.produk.harga_jual * item.quantity)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.produk.id)}
                      className="text-zinc-500 hover:text-rose-450 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Total Summary Sheet */}
            <div className="px-5 py-4 border-t border-zinc-900 bg-zinc-950/80 flex flex-col gap-3 pb-32">
              <div className="flex justify-between items-center text-[10px] text-zinc-450 uppercase tracking-wider font-semibold">
                <span>Subtotal</span>
                <span className="font-mono text-zinc-300">{formatRupiah(total)}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-zinc-450 uppercase tracking-wider font-semibold">
                <span>Diskon</span>
                <span className="font-mono text-zinc-300">Rp 0</span>
              </div>
              <div className="flex justify-between items-center text-xs text-zinc-100 uppercase tracking-wider font-bold border-t border-zinc-900 pt-3">
                <span>Total Tagihan</span>
                <span className="text-teal-400 font-mono text-sm">{formatRupiah(total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
