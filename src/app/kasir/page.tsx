'use client';

import React, { useState, useEffect } from 'react';
import { useProduk } from '@/hooks/use-produk';
import { useCart } from '@/hooks/use-cart';
import { useTransaksi } from '@/hooks/use-transaksi';
import ProductGrid from '@/components/product-grid';
import CartWidget from '@/components/cart-widget';
import CheckoutModal from '@/components/checkout-modal';
import CameraCapture from '@/components/camera-capture';
import { ToastItem, ToastInfo } from '@/components/ui';
import { Camera, RefreshCw, Loader2, Store, List } from 'lucide-react';

/**
 * Primary Kasir POS page.
 * Manages states for cart, active scanner, payment modals, and real-time transaction processing.
 */
export default function KasirPage() {
  const { produkList, kategoriList, loading: loadingProduk, refresh, error, saveEmbedding } = useProduk();
  const { cartItems, totalQty, total, addToCart, updateQuantity, removeFromCart, clearCart } = useCart();
  const { checkout, loading: isProcessing } = useTransaksi();

  const [isManualMode, setIsManualMode] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  // Pre-warm TensorFlow Mobilenet model on mount in background
  useEffect(() => {
    import('@/lib/image-classifier').then(({ loadModel }) => {
      loadModel().then(() => console.log('Model preloaded in background.'));
    });
  }, []);

  const addToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'success') => {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleProductSelect = (produk: any) => {
    addToCart(produk, 1);
    addToast(`${produk.nama} ditambahkan ke keranjang`, 'success');
  };

  const handleDetectedProduct = async (produk: any, capturedEmbedding?: number[], snapshotBase64?: string) => {
    addToCart(produk, 1);
    addToast(`[Scan] ${produk.nama} terdeteksi!`, 'success');

    // Self-learning loop: if user manually selected a candidate, capturedEmbedding is passed
    if (capturedEmbedding) {
      console.log(`Self-learning trigger: training AI model for product "${produk.nama}"...`);
      try {
        const success = await saveEmbedding(produk.id, capturedEmbedding);
        if (success) {
          addToast(`AI berhasil mempelajari visual baru untuk "${produk.nama}"!`, 'info');
        }
      } catch (err) {
        console.warn('Failed to save self-learning embedding:', err);
      }
    }
  };

  const handleCheckoutConfirm = async (bayar: number, kembalian: number) => {
    const noTx = await checkout(cartItems, total, 0, total, bayar, kembalian);
    if (noTx) {
      addToast(`Transaksi ${noTx} berhasil!`, 'success');
      clearCart();
      setIsCheckoutOpen(false);
      refresh(); // Refresh products list to show decreased stock levels
    } else {
      addToast('Gagal memproses transaksi.', 'error');
    }
  };

  return (
    <div className="flex flex-col flex-1 gap-4 w-full relative">
      {/* Toast Alert stack container */}
      <div className="fixed top-4 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-md mx-auto">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onClose={removeToast} />
          </div>
        ))}
      </div>

      {/* Header POS */}
      <header className="flex items-center justify-between py-2 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl text-zinc-950">
            <Store className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-extrabold tracking-wide uppercase text-zinc-100">Tokiva Kasir</h1>
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Prototype POS AI</span>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => refresh()}
            title="Refresh Produk"
            className="p-2.5 bg-zinc-900 border border-zinc-800/80 rounded-xl text-zinc-400 hover:text-zinc-200 active:scale-95 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          {isManualMode ? (
            <button
              onClick={() => setIsManualMode(false)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 font-bold rounded-xl active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Scanner</span>
            </button>
          ) : (
            <button
              onClick={() => setIsManualMode(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 font-bold rounded-xl active:scale-95 transition-all"
            >
              <List className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Manual</span>
            </button>
          )}
        </div>
      </header>

      {/* Main content body */}
      <div className="flex-1 flex flex-col gap-2.5">
        {error && (
          <div className="bg-rose-950/20 border border-rose-900/50 p-3.5 rounded-2xl text-xs text-rose-400 font-medium">
            Error: {error}. Membuka offline cache...
          </div>
        )}

        {isManualMode ? (
          loadingProduk && produkList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Memuat database produk...</span>
            </div>
          ) : (
            <ProductGrid
              products={produkList}
              categories={kategoriList}
              onProductSelect={handleProductSelect}
            />
          )
        ) : (
          <div className="flex-1 flex flex-col justify-start">
            <CameraCapture
              isOpen={true}
              onClose={() => {}}
              produkList={produkList}
              onDetected={handleDetectedProduct}
              continuousMode={true}
              embedded={true}
            />
          </div>
        )}
      </div>

      {/* Persistent Shopping Cart Summary */}
      <CartWidget
        cartItems={cartItems}
        totalQty={totalQty}
        total={total}
        updateQuantity={updateQuantity}
        removeFromCart={removeFromCart}
        onClearCart={clearCart}
        onCheckout={() => setIsCheckoutOpen(true)}
      />

      {/* Checkout Screen Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        total={total}
        onConfirm={handleCheckoutConfirm}
        isProcessing={isProcessing}
      />
    </div>
  );
}
