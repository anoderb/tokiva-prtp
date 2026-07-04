'use client';

import React, { useEffect, useState } from 'react';
import { useTransaksi } from '@/hooks/use-transaksi';
import { formatRupiah } from '@/lib/format';
import { ClipboardList, ChevronDown, ChevronUp, Calendar, Coins, Loader2 } from 'lucide-react';

/**
 * Riwayat Page.
 * Displays completed POS sales transactions, totals, and itemized receipts in expanding dropdown tables.
 */
export default function RiwayatPage() {
  const { riwayat, loading, fetchRiwayat } = useTransaksi();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchRiwayat();
  }, [fetchRiwayat]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full pb-8">
      {/* Header */}
      <header className="flex items-center gap-2 py-2 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl text-zinc-955">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-base font-extrabold tracking-wide uppercase text-zinc-105">Riwayat Transaksi</h1>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Catatan Penjualan</span>
        </div>
      </header>

      {/* Transactions List */}
      {loading && riwayat.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-550">Memuat riwayat transaksi...</span>
        </div>
      ) : riwayat.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3">
          <ClipboardList className="w-12 h-12 text-zinc-800" />
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Belum ada transaksi</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {riwayat.map((tx) => {
            const isExpanded = expandedId === tx.id;
            const itemsCount = tx.transaksi_detail?.reduce((sum: number, item: any) => sum + item.qty, 0) || 0;

            return (
              <div
                key={tx.id}
                className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden transition-all duration-200"
              >
                {/* Header Card trigger */}
                <button
                  onClick={() => toggleExpand(tx.id)}
                  className="w-full flex items-center justify-between p-4 text-left active:bg-zinc-900/60 transition-colors"
                >
                  <div className="flex flex-col gap-1 min-w-0 pr-2">
                    <span className="text-xs font-bold text-zinc-300 font-mono tracking-wide">
                      {tx.no_transaksi}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-zinc-650" />
                      {formatDate(tx.created_at)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-teal-400 font-mono">
                        {formatRupiah(tx.total)}
                      </span>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                        {itemsCount} item
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    )}
                  </div>
                </button>

                {/* Expanded Itemized Receipt */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-zinc-900/80 bg-zinc-950/40 animate-in fade-in duration-200">
                    <h4 className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Item Detail:</h4>
                    <div className="flex flex-col divide-y divide-zinc-900/40">
                      {tx.transaksi_detail?.map((detail: any) => (
                        <div key={detail.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-zinc-300 block truncate">{detail.nama_produk}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {detail.qty} {detail.satuan} x {formatRupiah(detail.harga_satuan)}
                            </span>
                          </div>
                          <span className="font-bold font-mono text-zinc-200">
                            {formatRupiah(detail.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Summary list */}
                    <div className="border-t border-zinc-900/85 pt-3 mt-2.5 flex flex-col gap-1.5 text-[10px] text-zinc-500 uppercase font-semibold">
                      <div className="flex justify-between font-mono">
                        <span>Total Tagihan</span>
                        <span>{formatRupiah(tx.total)}</span>
                      </div>
                      <div className="flex justify-between font-mono text-zinc-400">
                        <span>Nominal Bayar</span>
                        <span>{formatRupiah(tx.bayar)}</span>
                      </div>
                      <div className="flex justify-between font-mono text-teal-400 font-bold">
                        <span>Uang Kembalian</span>
                        <span>{formatRupiah(tx.kembalian)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
