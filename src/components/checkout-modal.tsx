'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button } from './ui';
import { formatRupiah } from '../lib/format';
import { CheckCircle2, Delete, Coins } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onConfirm: (bayar: number, kembalian: number) => Promise<void>;
  isProcessing: boolean;
}

/**
 * Mobile-friendly Checkout modal containing a touch-optimized numpad and instant change calculations.
 */
export default function CheckoutModal({
  isOpen,
  onClose,
  total,
  onConfirm,
  isProcessing,
}: CheckoutModalProps) {
  const [bayarInput, setBayarInput] = useState('');
  const bayarNominal = parseFloat(bayarInput) || 0;
  const kembalian = Math.max(0, bayarNominal - total);
  const isEnough = bayarNominal >= total;

  // Reset input when modal opens
  useEffect(() => {
    if (isOpen) {
      setBayarInput('');
    }
  }, [isOpen]);

  // Quick Cash Options (Indonesian Rupiah standard denominations)
  const quickCashOptions = [
    { label: 'Uang Pas', value: total },
    { label: 'Rp 10.000', value: 10000 },
    { label: 'Rp 20.000', value: 20000 },
    { label: 'Rp 50.000', value: 50000 },
    { label: 'Rp 100.000', value: 100000 },
  ];

  const handleNumpadPress = (val: string) => {
    if (val === 'C') {
      setBayarInput('');
    } else if (val === 'back') {
      setBayarInput((prev) => prev.slice(0, -1));
    } else {
      // Prevent leading zeros
      if (bayarInput === '0') {
        setBayarInput(val);
      } else {
        setBayarInput((prev) => prev + val);
      }
    }
  };

  const handleConfirmPayment = async () => {
    if (!isEnough || isProcessing) return;
    await onConfirm(bayarNominal, kembalian);
  };

  const footer = (
    <div className="flex gap-2 w-full">
      <Button variant="secondary" size="md" className="flex-1" onClick={onClose} disabled={isProcessing}>
        Batal
      </Button>
      <Button
        variant="primary"
        size="md"
        className="flex-1 font-bold text-xs uppercase tracking-wider"
        disabled={!isEnough || isProcessing}
        onClick={handleConfirmPayment}
      >
        {isProcessing ? 'Memproses...' : 'Selesaikan'}
      </Button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Selesaikan Pembayaran" footer={footer}>
      <div className="flex flex-col gap-4">
        {/* Total Bill Box */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Tagihan</span>
            <span className="text-xl font-bold text-teal-400 font-mono mt-0.5">{formatRupiah(total)}</span>
          </div>
          <Coins className="w-8 h-8 text-teal-500/20" />
        </div>

        {/* Input & Change Preview */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-3 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Jumlah Bayar</span>
            <span className="text-base font-bold font-mono text-zinc-200 mt-1 truncate">
              {bayarNominal > 0 ? formatRupiah(bayarNominal) : 'Rp 0'}
            </span>
          </div>

          <div className={`border rounded-2xl p-3 flex flex-col justify-center transition-all ${
            isEnough && bayarNominal > 0
              ? 'bg-teal-950/20 border-teal-800/40 text-teal-400'
              : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider">Kembalian</span>
            <span className="text-base font-bold font-mono mt-1 truncate">
              {isEnough ? formatRupiah(kembalian) : 'Belum Cukup'}
            </span>
          </div>
        </div>

        {/* Quick Cash Suggestions */}
        <div className="flex flex-wrap gap-1.5 justify-center py-1">
          {quickCashOptions.map((opt, idx) => {
            // Only show suggestions that are greater than or equal to total, except "Uang Pas" which is always valid
            if (opt.value < total && opt.value !== total) return null;
            return (
              <button
                key={idx}
                onClick={() => setBayarInput(opt.value.toString())}
                className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 active:scale-95 text-xs font-bold text-zinc-350 rounded-xl transition-all"
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Touch Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto w-full pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'back'].map((key) => {
            const isControl = key === 'C' || key === 'back';
            
            return (
              <button
                key={key}
                onClick={() => handleNumpadPress(key)}
                className={`h-12 flex items-center justify-center text-base font-bold rounded-xl transition-all active:scale-90 ${
                  isControl
                    ? 'bg-zinc-900 border border-zinc-800 text-rose-450 hover:bg-zinc-850'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-850'
                }`}
              >
                {key === 'back' ? <Delete className="w-5 h-5" /> : key}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
