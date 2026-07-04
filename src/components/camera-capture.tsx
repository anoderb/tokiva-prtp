'use client';

import React, { useRef, useState, useEffect } from 'react';
import { getEmbedding, findNearest, loadModel } from '../lib/image-classifier';
import { Produk } from '../types';
import { Button } from './ui';
import { Camera, RefreshCw, X, Radio, Check, Loader2 } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  produkList: Produk[];
  onDetected: (produk: Produk) => void;
  // If provided, operates in "photo capturing" mode returning a single embedding
  onPhotoCaptured?: (photoBase64: string, embedding: number[]) => void;
}

export default function CameraCapture({
  isOpen,
  onClose,
  produkList,
  onDetected,
  onPhotoCaptured,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Menginisialisasi kamera...');
  const [candidates, setCandidates] = useState<Array<{ produk: Produk; similarity: number }>>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  
  const barcodeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Initialize Barcode Reader once
  useEffect(() => {
    barcodeReaderRef.current = new BrowserMultiFormatReader();
    return () => {
      barcodeReaderRef.current = null;
    };
  }, []);

  // Trigger web haptics and audio feedback
  const triggerSuccessFeedback = () => {
    // 1. Audio feedback (Web Audio synth beep)
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High beep
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.warn('Audio feedback blocked or unsupported', e);
    }

    // 2. Vibration feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(100);
    }
  };

  // Pre-load MobileNetV2 Model
  useEffect(() => {
    if (!isOpen) return;
    
    setStatusMessage('Memuat model AI (MobileNetV2)...');
    loadModel()
      .then(() => {
        setModelLoaded(true);
        setStatusMessage('Model AI siap.');
      })
      .catch((err) => {
        console.error(err);
        setStatusMessage('Gagal memuat model AI.');
      });
  }, [isOpen]);

  // Start webcam stream
  const startCamera = async () => {
    setIsInitializing(true);
    // Stop any active streams first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsInitializing(false);
      setStatusMessage(isAutoMode ? 'Mencari produk otomatis (Barcode / AI)...' : 'Arahkan kamera ke produk');
    } catch (err) {
      console.error('Camera access error:', err);
      setStatusMessage('Kamera tidak dapat diakses.');
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (isOpen && modelLoaded) {
      startCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, modelLoaded, facingMode]);

  // Flip Camera Front <-> Back
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Main Image Processing & Inference Loop
  const performInference = async (): Promise<{ embedding: number[]; base64: string; barcode: string | null } | null> => {
    if (!videoRef.current || !modelLoaded) return null;

    try {
      setIsScanning(true);
      
      const video = videoRef.current;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      // 1. Capture full resolution frame for Barcode Scan
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, width, height);

      // 2. Try to decode barcode first
      let scannedBarcode: string | null = null;
      if (barcodeReaderRef.current && !onPhotoCaptured) {
        try {
          const barcodeResult = await barcodeReaderRef.current.decodeFromCanvas(canvas);
          scannedBarcode = barcodeResult.getText();
          console.log('Barcode auto-detected:', scannedBarcode);
        } catch (e) {
          // Barcode not found in this frame, proceed to AI
        }
      }

      // 3. Capture square and downscale to 224x224 for MobileNetV2 AI
      const size = Math.min(width, height);
      const sx = (width - size) / 2;
      const sy = (height - size) / 2;

      const aiCanvas = document.createElement('canvas');
      aiCanvas.width = 224;
      aiCanvas.height = 224;
      const aiCtx = aiCanvas.getContext('2d');
      if (!aiCtx) return null;
      aiCtx.drawImage(canvas, sx, sy, size, size, 0, 0, 224, 224);

      // Generate base64 picture preview (for admin register mode)
      const base64 = aiCanvas.toDataURL('image/webp', 0.8);

      // Run MobileNet inference to generate embedding vector
      const embedding = await getEmbedding(aiCanvas);
      
      setIsScanning(false);
      return { embedding, base64, barcode: scannedBarcode };
    } catch (err) {
      console.error('Inference error:', err);
      setIsScanning(false);
      return null;
    }
  };

  // Manual Scan Action
  const handleManualScan = async () => {
    if (isScanning || isInitializing || !modelLoaded) return;
    setStatusMessage('Memindai produk...');
    setCandidates([]);

    const result = await performInference();
    if (!result) {
      setStatusMessage('Gagal memindai.');
      return;
    }

    if (onPhotoCaptured) {
      // Photo register mode
      onPhotoCaptured(result.base64, result.embedding);
      triggerSuccessFeedback();
      onClose();
      return;
    }

    // Check barcode match first
    if (result.barcode) {
      const matchProduct = produkList.find(
        (p) => p.barcode === result.barcode || p.kode === result.barcode
      );
      if (matchProduct) {
        triggerSuccessFeedback();
        onDetected(matchProduct);
        onClose();
        return;
      }
    }

    // Match via AI embedding
    const productsWithEmbeds = produkList.map((p) => ({
      id: p.id,
      embeddings: p.foto_embedding || [],
    }));

    const matches = findNearest(result.embedding, productsWithEmbeds, 0.45);

    if (matches.length > 0) {
      const topMatch = matches[0];
      const matchProduct = produkList.find((p) => p.id === topMatch.id);

      if (matchProduct) {
        if (topMatch.similarity >= 0.80) {
          // Instant match
          triggerSuccessFeedback();
          onDetected(matchProduct);
          onClose();
        } else {
          // Show candidate items for ambiguous match
          const list = matches.slice(0, 3).map((m) => ({
            produk: produkList.find((p) => p.id === m.id)!,
            similarity: m.similarity,
          })).filter(x => x.produk !== undefined);
          setCandidates(list);
          setStatusMessage('Pilih produk yang paling cocok:');
        }
      }
    } else {
      setStatusMessage('Produk tidak dikenali.');
    }
  };

  // Automatic Scan Loop
  useEffect(() => {
    if (!isOpen || !modelLoaded || !isAutoMode || onPhotoCaptured || isInitializing) return;

    let timerId: NodeJS.Timeout;

    const autoScan = async () => {
      if (candidates.length > 0 || isScanning) return;
      
      const result = await performInference();
      if (!result) return;

      // 1. Process Barcode Match
      if (result.barcode) {
        const matchProduct = produkList.find(
          (p) => p.barcode === result.barcode || p.kode === result.barcode
        );
        if (matchProduct) {
          triggerSuccessFeedback();
          onDetected(matchProduct);
          onClose();
          return;
        }
      }

      // 2. Process AI Match
      const productsWithEmbeds = produkList.map((p) => ({
        id: p.id,
        embeddings: p.foto_embedding || [],
      }));

      const matches = findNearest(result.embedding, productsWithEmbeds, 0.5);

      if (matches.length > 0) {
        const topMatch = matches[0];
        const matchProduct = produkList.find((p) => p.id === topMatch.id);

        if (matchProduct) {
          if (topMatch.similarity >= 0.82) {
            // Highly confident match
            triggerSuccessFeedback();
            onDetected(matchProduct);
            onClose();
          } else {
            // Unsure match, show options and stop auto-scan
            const list = matches.slice(0, 3).map((m) => ({
              produk: produkList.find((p) => p.id === m.id)!,
              similarity: m.similarity,
            })).filter(x => x.produk !== undefined);
            setCandidates(list);
            setStatusMessage('Ditemukan kemiripan rendah. Pilih produk:');
          }
        }
      }
    };

    timerId = setInterval(() => {
      autoScan();
    }, 1500); // scan frame every 1.5 seconds for speed

    return () => {
      clearInterval(timerId);
    };
  }, [isOpen, modelLoaded, isAutoMode, produkList, candidates, isScanning, isInitializing]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100 transform animate-in fade-in duration-300">
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-teal-400" />
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            {onPhotoCaptured ? 'Daftarkan Foto Produk' : 'Kamera Deteksi Produk'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5 text-zinc-400 hover:text-zinc-200" />
        </button>
      </div>

      {/* Main Camera Frame */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {isInitializing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/90 z-20">
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
            <p className="text-sm text-zinc-400 font-medium">{statusMessage}</p>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover max-w-md mx-auto"
        />

        {/* Camera Reticle Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-64 h-64 border-2 border-dashed border-teal-500/50 rounded-3xl relative flex items-center justify-center">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-teal-400 rounded-tl-xl -mt-1 -ml-1" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-teal-400 rounded-tr-xl -mt-1 -mr-1" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-teal-400 rounded-bl-xl -mb-1 -ml-1" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-teal-400 rounded-br-xl -mb-1 -mr-1" />
          </div>
        </div>

        {/* Ambient status banner */}
        {!isInitializing && (
          <div className="absolute top-4 left-4 right-4 bg-zinc-950/80 border border-zinc-800 backdrop-blur-md px-3 py-2 rounded-xl text-center z-10 text-xs font-semibold tracking-wider text-teal-400 uppercase flex items-center justify-center gap-1.5 shadow-lg">
            {!onPhotoCaptured && isAutoMode && <Radio className="w-3.5 h-3.5 text-teal-400 animate-pulse" />}
            {statusMessage}
          </div>
        )}
      </div>

      {/* Candidates Selection Sheet */}
      {candidates.length > 0 && (
        <div className="absolute bottom-24 left-4 right-4 bg-zinc-950/95 border border-zinc-850 p-4 rounded-2xl shadow-2xl z-30 animate-in slide-in-from-bottom duration-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
            Pilih Produk Terdekat:
          </h4>
          <div className="flex flex-col gap-2">
            {candidates.map((c) => (
              <button
                key={c.produk.id}
                onClick={() => {
                  triggerSuccessFeedback();
                  onDetected(c.produk);
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-850 rounded-xl transition-all"
              >
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold text-zinc-100">{c.produk.nama}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Kode: {c.produk.kode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-teal-400">
                    {Math.round(c.similarity * 100)}% Cocok
                  </span>
                  <Check className="w-4 h-4 text-teal-400" />
                </div>
              </button>
            ))}
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              className="mt-1"
              onClick={() => {
                setCandidates([]);
                setStatusMessage(isAutoMode ? 'Mencari produk otomatis...' : 'Arahkan kamera ke produk');
              }}
            >
              Reset / Pindai Ulang
            </Button>
          </div>
        </div>
      )}

      {/* Controls Area */}
      <div className="px-6 py-6 bg-zinc-950 border-t border-zinc-900 flex flex-col gap-4">
        {/* Toggle Mode for regular scanner */}
        {!onPhotoCaptured && (
          <div className="flex items-center justify-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl max-w-xs mx-auto w-full">
            <button
              onClick={() => {
                setIsAutoMode(true);
                setCandidates([]);
                setStatusMessage('Mencari produk otomatis...');
              }}
              className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                isAutoMode ? 'bg-teal-500/10 text-teal-400 font-bold' : 'text-zinc-500'
              }`}
            >
              Auto Scan
            </button>
            <button
              onClick={() => {
                setIsAutoMode(false);
                setCandidates([]);
                setStatusMessage('Arahkan kamera ke produk dan tap tombol scan');
              }}
              className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                !isAutoMode ? 'bg-teal-500/10 text-teal-400 font-bold' : 'text-zinc-500'
              }`}
            >
              Manual Scan
            </button>
          </div>
        )}

        {/* Main Buttons */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="icon"
            onClick={toggleFacingMode}
            disabled={isInitializing}
            title="Ganti Arah Kamera"
          >
            <RefreshCw className="w-5 h-5 text-zinc-400" />
          </Button>

          {/* Trigger Capture Button */}
          {(!isAutoMode || onPhotoCaptured) && (
            <button
              onClick={handleManualScan}
              disabled={isScanning || isInitializing || !modelLoaded}
              className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full border-4 border-zinc-950 shadow-xl shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none"
            >
              {isScanning ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </button>
          )}

          <Button
            variant="secondary"
            className="flex-1 max-w-[120px] font-semibold text-xs uppercase tracking-wider border border-zinc-800"
            onClick={onClose}
          >
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}
