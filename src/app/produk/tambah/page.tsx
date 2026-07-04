'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProduk } from '@/hooks/use-produk';
import { supabase } from '@/lib/supabase';
import { Button, Input, ToastItem, ToastInfo } from '@/components/ui';
import CameraCapture from '@/components/camera-capture';
import { ArrowLeft, Camera, Check, AlertCircle, Save, Sparkles, Loader2, X } from 'lucide-react';
import Link from 'next/link';

// Component rendering logic (wrapped in Suspense below)
function TambahProdukContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registerId = searchParams.get('registerId');

  const { kategoriList, saveEmbedding, refresh, produkList } = useProduk();

  // Form States
  const [kode, setKode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [nama, setNama] = useState('');
  const [kategoriId, setKategoriId] = useState('');
  const [satuan, setSatuan] = useState('pcs');
  const [hargaBeli, setHargaBeli] = useState('');
  const [hargaJual, setHargaJual] = useState('');
  const [stok, setStok] = useState('');
  const [stokMin, setStokMin] = useState('5');

  // AI Embedding photo states - array to support multiple angles
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [capturedEmbeddings, setCapturedEmbeddings] = useState<number[][]>([]);

  // General Page States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  const [targetProduct, setTargetProduct] = useState<any | null>(null);

  const addToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'success') => {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // If registerId is present, fetch that specific product for embedding capture only
  useEffect(() => {
    if (registerId && produkList.length > 0) {
      const found = produkList.find((p) => p.id === parseInt(registerId));
      if (found) {
        setTargetProduct(found);
        setIsCameraOpen(true); // Auto-open scanner overlay immediately
      } else {
        addToast('Produk tidak ditemukan', 'error');
      }
    }
  }, [registerId, produkList]);

  // Upload Base64 captured photo to Supabase storage, with Base64 fallback if bucket fails
  const uploadCapturedImage = async (base64: string, filename: string): Promise<string> => {
    try {
      const res = await fetch(base64);
      const blob = await res.blob();

      const { data, error } = await supabase.storage
        .from('produk')
        .upload(filename, blob, {
          contentType: 'image/webp',
          upsert: true,
        });

      if (error) {
        console.warn('Storage upload error, using database inline base64 URL fallback', error);
        return base64; // Fallback: save raw base64 string directly in postgres column
      }

      const { data: publicUrl } = supabase.storage.from('produk').getPublicUrl(filename);
      return publicUrl.publicUrl;
    } catch (e) {
      console.warn('Storage upload failed, saving raw base64 instead', e);
      return base64;
    }
  };

  // Camera capture callback
  const handlePhotoCaptured = (photoBase64: string, embedding: number[]) => {
    setCapturedPhotos((prev) => [...prev, photoBase64]);
    setCapturedEmbeddings((prev) => [...prev, embedding]);
    addToast(`Foto AI ke-${capturedPhotos.length + 1} berhasil direkam`, 'success');
  };

  // Main Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nama || !kode || !hargaJual) {
      addToast('Nama, Kode, dan Harga Jual wajib diisi', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      let finalFotoUrl: string | null = null;

      // Upload all captured photos. We save the first one as default cover.
      for (let i = 0; i < capturedPhotos.length; i++) {
        const cleanFilename = `${kode}-${Date.now()}-${i}.webp`;
        const url = await uploadCapturedImage(capturedPhotos[i], cleanFilename);
        if (i === 0) {
          finalFotoUrl = url;
        }
      }

      // 1. Insert product details to database
      const { data: newProd, error: insertError } = await supabase
        .from('produk')
        .insert({
          kode,
          barcode: barcode || null,
          nama,
          kategori_id: kategoriId ? parseInt(kategoriId) : null,
          satuan,
          harga_beli: parseFloat(hargaBeli) || 0,
          harga_jual: parseFloat(hargaJual),
          stok: parseFloat(stok) || 0,
          stok_min: parseFloat(stokMin) || 5,
          foto_url: finalFotoUrl,
          foto_embedding: capturedEmbeddings.length > 0 ? capturedEmbeddings : null,
          is_aktif: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      addToast('Produk berhasil disimpan!', 'success');
      refresh();
      setTimeout(() => {
        router.push('/produk');
      }, 1000);
    } catch (err: any) {
      console.error('Error saving product:', err);
      addToast(`Gagal menyimpan: ${err.message || 'Error'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Embedding-only Register mode submit handler
  const handleEmbeddingOnlyRegister = async () => {
    if (!targetProduct || capturedEmbeddings.length === 0) return;

    setIsSaving(true);
    try {
      let latestFotoUrl = targetProduct.foto_url;

      // 1. Upload all new captured photos, use the last one as latest foto_url
      for (let i = 0; i < capturedPhotos.length; i++) {
        const cleanFilename = `${targetProduct.kode}-${Date.now()}-${i}.webp`;
        const url = await uploadCapturedImage(capturedPhotos[i], cleanFilename);
        latestFotoUrl = url;
      }

      // 2. Fetch existing embeddings list
      const { data: curProd, error: fetchErr } = await supabase
        .from('produk')
        .select('foto_embedding')
        .eq('id', targetProduct.id)
        .single();

      if (fetchErr) throw fetchErr;

      let currentEmbeds: number[][] = curProd?.foto_embedding ? (curProd.foto_embedding as number[][]) : [];
      
      // Append all new captured embeddings
      currentEmbeds.push(...capturedEmbeddings);

      // 3. Update both photo and embeddings list
      const { error: updateError } = await supabase
        .from('produk')
        .update({
          foto_embedding: currentEmbeds,
          foto_url: latestFotoUrl,
        })
        .eq('id', targetProduct.id);

      if (updateError) throw updateError;

      addToast(`Model AI untuk "${targetProduct.nama}" berhasil diperbarui! (${capturedEmbeddings.length} foto baru ditambahkan)`, 'success');
      refresh();
      setTimeout(() => {
        router.push('/produk');
      }, 1200);
    } catch (err: any) {
      console.error('Error updating AI model:', err);
      addToast(`Gagal mendaftarkan AI: ${err.message || 'Error'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // If registering AI embedding to an existing product
  if (registerId) {
    return (
      <div className="flex flex-col gap-4 w-full h-full pb-8">
        <div className="fixed top-4 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-md mx-auto">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onClose={removeToast} />
            </div>
          ))}
        </div>

        <header className="flex items-center gap-2 py-2 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
          <Link href="/produk" className="p-2 bg-zinc-900 rounded-xl text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-base font-extrabold tracking-wide uppercase text-zinc-100">Daftar Model AI</h1>
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Registrasi Foto Produk</span>
          </div>
        </header>

        {targetProduct ? (
          <div className="flex flex-col gap-5 mt-4">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">Produk Sasaran</span>
              <h2 className="text-base font-bold text-zinc-150">{targetProduct.nama}</h2>
              <span className="text-xs font-mono text-zinc-500">Kode SKU: {targetProduct.kode}</span>
            </div>

            {/* Multiple Photos Preview Card Grid */}
            {capturedPhotos.length > 0 ? (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Foto AI Baru Siap Direkam ({capturedPhotos.length})
                  </span>
                  {targetProduct.foto_embedding && (
                    <span className="text-[9px] font-semibold text-zinc-500 uppercase">
                      Sudah Terdaftar: {targetProduct.foto_embedding.length} Foto
                    </span>
                  )}
                </div>
                
                {/* Captured photos horizontal grid list */}
                <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar">
                  {capturedPhotos.map((photo, idx) => (
                    <div key={idx} className="relative shrink-0">
                      <img
                        src={photo}
                        alt={`Preview ${idx + 1}`}
                        className="w-24 h-24 object-cover rounded-xl border border-zinc-850 shadow-md"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCapturedPhotos((prev) => prev.filter((_, i) => i !== idx));
                          setCapturedEmbeddings((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-500 text-white p-1 rounded-full shadow-lg transition-colors active:scale-90"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 w-full mt-2">
                  <Button variant="secondary" size="md" className="flex-1" onClick={() => setIsCameraOpen(true)}>
                    Tambah Foto
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    className="flex-1 font-bold text-xs uppercase tracking-wider"
                    onClick={handleEmbeddingOnlyRegister}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan Semua AI'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-zinc-500 text-center">
                <Camera className="w-12 h-12 text-zinc-700" />
                <p className="text-xs">Model AI membutuhkan capture foto produk untuk mengenali kemiripan visual (bisa rekam beberapa foto dari sudut berbeda)</p>
                <Button variant="primary" size="md" className="mt-2" onClick={() => setIsCameraOpen(true)}>
                  Rekam Foto AI
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-teal-450 animate-spin" />
          </div>
        )}

        <CameraCapture
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          produkList={[]}
          onDetected={() => {}}
          onPhotoCaptured={handlePhotoCaptured}
        />
      </div>
    );
  }

  // Normal mode: New product creation form
  return (
    <div className="flex flex-col gap-4 w-full h-full pb-8">
      <div className="fixed top-4 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-md mx-auto">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onClose={removeToast} />
          </div>
        ))}
      </div>

      <header className="flex items-center gap-2 py-2 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <Link href="/produk" className="p-2 bg-zinc-900 rounded-xl text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex flex-col">
          <h1 className="text-base font-extrabold tracking-wide uppercase text-zinc-100">Tambah Produk Baru</h1>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Detail Inventaris</span>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
        <Input label="Kode SKU (Wajib)" placeholder="E.g. INDOMIE-SP-GRG" value={kode} onChange={(e) => setKode(e.target.value)} required />
        <Input label="Barcode EAN (Opsional)" placeholder="Scan atau input barcode angka" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        <Input label="Nama Produk (Wajib)" placeholder="E.g. Indomie Goreng Spesial" value={nama} onChange={(e) => setNama(e.target.value)} required />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">Kategori</label>
            <select
              value={kategoriId}
              onChange={(e) => setKategoriId(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl text-sm focus:outline-none focus:border-teal-500 min-h-[44px]"
            >
              <option value="">Pilih Kategori</option>
              {kategoriList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.nama}
                </option>
              ))}
            </select>
          </div>
          <Input label="Satuan" placeholder="E.g. pcs, box, kg" value={satuan} onChange={(e) => setSatuan(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Harga Beli (Rp)" type="number" placeholder="0" value={hargaBeli} onChange={(e) => setHargaBeli(e.target.value)} />
          <Input label="Harga Jual (Rp) *" type="number" placeholder="0" value={hargaJual} onChange={(e) => setHargaJual(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Jumlah Stok" type="number" placeholder="0" value={stok} onChange={(e) => setStok(e.target.value)} />
          <Input label="Stok Minimum" type="number" placeholder="5" value={stokMin} onChange={(e) => setStokMin(e.target.value)} />
        </div>

        {/* AI Camera section */}
        <div className="border border-zinc-850 bg-zinc-900/20 rounded-2xl p-4 flex flex-col gap-3 mt-1">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" /> Model Deteksi AI
              </h3>
              <span className="text-[10px] text-zinc-500 mt-0.5">Daftarkan foto produk untuk scan kamera</span>
            </div>
            
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="p-2 bg-teal-550/10 text-teal-400 hover:bg-teal-550/20 active:scale-95 transition-all rounded-xl border border-teal-500/20"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {capturedPhotos.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2 overflow-x-auto py-1.5 no-scrollbar">
                {capturedPhotos.map((photo, idx) => (
                  <div key={idx} className="relative shrink-0">
                    <img
                      src={photo}
                      alt={`Captured ${idx}`}
                      className="w-14 h-14 object-cover rounded-xl border border-zinc-850 shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedPhotos((prev) => prev.filter((_, i) => i !== idx));
                        setCapturedEmbeddings((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-500 text-white p-0.5 rounded-full shadow transition-colors active:scale-90"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                <Check className="w-3.5 h-3.5" />
                {capturedPhotos.length} Foto Model AI Terpilih
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-zinc-550 italic">
              Belum ada foto AI direkam. Tap tombol kamera untuk merekam foto (bisa rekam lebih dari satu).
            </div>
          )}
        </div>

        <Button
          variant="primary"
          size="lg"
          type="submit"
          disabled={isSaving}
          className="mt-4 font-bold text-xs uppercase tracking-wider"
        >
          {isSaving ? 'Menyimpan...' : 'Simpan Produk'}
        </Button>
      </form>

      <CameraCapture
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        produkList={[]}
        onDetected={() => {}}
        onPhotoCaptured={handlePhotoCaptured}
      />
    </div>
  );
}

// Wrapper to prevent "useSearchParams() should be wrapped in a suspense boundary" Next.js warning
export default function TambahProdukPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
      </div>
    }>
      <TambahProdukContent />
    </Suspense>
  );
}
