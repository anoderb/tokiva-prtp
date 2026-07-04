import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { CartItem, Transaksi, TransaksiDetail } from '../types';
import { generateNoTransaksi } from '../lib/format';

/**
 * Custom hook to manage POS transaction processing, checkout, and transaction history.
 */
export function useTransaksi() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [riwayat, setRiwayat] = useState<any[]>([]);

  /**
   * Fetches full transaction history including product details, sorted by date.
   */
  const fetchRiwayat = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('transaksi')
        .select('*, transaksi_detail(*)')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setRiwayat(data || []);
    } catch (err: any) {
      console.error('Error loading transaction history:', err);
      setError(err.message || 'Failed to retrieve transaction history records');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Commits the current shopping cart to Supabase as a finalized transaction.
   * Generates a transaction number, inserts header & detail records, and decrements stock.
   */
  const checkout = async (
    cartItems: CartItem[],
    subtotal: number,
    diskon: number,
    total: number,
    bayar: number,
    kembalian: number
  ): Promise<string | null> => {
    if (cartItems.length === 0) return null;
    
    setLoading(true);
    setError(null);
    try {
      const noTransaksi = generateNoTransaksi();

      // 1. Insert header record
      const { data: headerData, error: headerError } = await supabase
        .from('transaksi')
        .insert({
          no_transaksi: noTransaksi,
          subtotal,
          diskon,
          total,
          bayar,
          kembalian,
          status: 'lunas',
        })
        .select()
        .single();

      if (headerError) throw headerError;
      const transaksiId = headerData.id;

      // 2. Prepare items for details insertion
      const detailItems = cartItems.map((item) => ({
        transaksi_id: transaksiId,
        produk_id: item.produk.id,
        nama_produk: item.produk.nama,
        qty: item.quantity,
        satuan: item.produk.satuan,
        harga_satuan: item.produk.harga_jual,
        subtotal: item.produk.harga_jual * item.quantity,
      }));

      // 3. Insert detail records
      const { error: detailError } = await supabase
        .from('transaksi_detail')
        .insert(detailItems);

      if (detailError) throw detailError;

      // 4. Update product stocks (subtract purchase quantities)
      for (const item of cartItems) {
        const newStok = Math.max(0, item.produk.stok - item.quantity);
        await supabase
          .from('produk')
          .update({ stok: newStok })
          .eq('id', item.produk.id);
      }

      return noTransaksi;
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Checkout operation failed');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    riwayat,
    fetchRiwayat,
    checkout,
  };
}
