'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { getEmbedding, generateAugmentedEmbeddings, findNearest, loadModel } from '../lib/image-classifier';
import { Produk } from '../types';
import { Button } from './ui';
import { Camera, RefreshCw, X, Radio, Check, Loader2, ShoppingCart } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  produkList: Produk[];
  onDetected: (produk: Produk, capturedEmbedding?: number[]) => void;
  /** If provided, operates in "photo capturing" mode returning augmented embeddings */
  onPhotoCaptured?: (photoBase64: string, embeddings: number[][]) => void;
  /** If provided, scanner returns raw scanned barcode code directly and closes */
  onBarcodeScanned?: (barcode: string) => void;
  /** If true, camera stays open after detection and continues scanning (for cashier mode) */
  continuousMode?: boolean;
}

export default function CameraCapture({
  isOpen,
  onClose,
  produkList,
  onDetected,
  onPhotoCaptured,
  onBarcodeScanned,
  continuousMode = false,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastQueryEmbeddingRef = useRef<number[] | null>(null);
  
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Menginisialisasi kamera...');
  const [candidates, setCandidates] = useState<Array<{ produk: Produk; similarity: number }>>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  
  // Continuous mode states
  const [scanCount, setScanCount] = useState(0);
  const [inlineToast, setInlineToast] = useState<string | null>(null);
  const inlineToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const barcodeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Initialize Barcode Reader once with TRY_HARDER and all formats
  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    
    // Explicitly define possible formats to support all standard codes
    const formats = [
      BarcodeFormat.AZTEC,
      BarcodeFormat.CODABAR,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.CODE_128,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.EAN_8,
      BarcodeFormat.EAN_13,
      BarcodeFormat.ITF,
      BarcodeFormat.MAXICODE,
      BarcodeFormat.PDF_417,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.RSS_14,
      BarcodeFormat.RSS_EXPANDED,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.UPC_EAN_EXTENSION
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

    barcodeReaderRef.current = new BrowserMultiFormatReader(hints);
    return () => {
      barcodeReaderRef.current = null;
    };
  }, []);

  // Reset scan count when camera opens/closes
  useEffect(() => {
    if (isOpen) {
      setScanCount(0);
      setInlineToast(null);
    }
  }, [isOpen]);

  // Start continuous barcode scanning from the active video stream
  useEffect(() => {
    if (!isOpen || isInitializing || !videoRef.current || onPhotoCaptured || !barcodeReaderRef.current) return;

    let active = true;
    const reader = barcodeReaderRef.current;
    const video = videoRef.current;
    let scannerControls: any = null;

    console.log('Starting parallel continuous video barcode scanning...');
    
    reader.decodeFromVideoElement(video, (result, error) => {
      if (!active) return;

      if (result) {
        const scannedCode = result.getText();
        console.log('Video stream barcode detected:', scannedCode);

        // 1. If in raw barcode scanner mode (e.g. form input fill)
        if (onBarcodeScanned) {
          triggerSuccessFeedback();
          onBarcodeScanned(scannedCode);
          onClose();
          active = false;
          return;
        }

        // 2. If in kasir mode, lookup matching product in produkList
        const matchProduct = produkList.find(
          (p) => p.barcode === scannedCode || p.kode === scannedCode
        );
        if (matchProduct) {
          handleProductMatch(matchProduct, 'barcode');
        }
      }
    }).then((controls) => {
      scannerControls = controls;
    }).catch((err) => {
      console.warn('Continuous barcode scanning startup failed:', err);
    });

    return () => {
      active = false;
      if (scannerControls) {
        try {
          scannerControls.stop();
        } catch (e) {
          console.warn('Error stopping scanner controls:', e);
        }
      }
    };
  }, [isOpen, isInitializing, modelLoaded, produkList, onBarcodeScanned, onPhotoCaptured]);

  // Show inline toast overlay (auto-dismiss after 1.5s)
  const showInlineToast = useCallback((message: string) => {
    if (inlineToastTimerRef.current) clearTimeout(inlineToastTimerRef.current);
    setInlineToast(message);
    inlineToastTimerRef.current = setTimeout(() => {
      setInlineToast(null);
    }, 1500);
  }, []);

  // Trigger web haptics and audio feedback
  const triggerSuccessFeedback = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.warn('Audio feedback blocked or unsupported', e);
    }

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

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  /**
   * Multi-Frame Averaging: captures 3 frames ~200ms apart and averages their embeddings.
   * Reduces noise from hand movement, flicker, and blur.
   */
  const captureMultiFrameEmbedding = async (): Promise<number[] | null> => {
    if (!videoRef.current || !modelLoaded) return null;

    const frameEmbeddings: number[][] = [];
    const FRAME_COUNT = 3;
    const FRAME_DELAY = 200; // ms between frames

    for (let f = 0; f < FRAME_COUNT; f++) {
      const video = videoRef.current;
      if (!video) return null;

      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      const size = Math.min(width, height);
      const sx = (width - size) / 2;
      const sy = (height - size) / 2;

      const aiCanvas = document.createElement('canvas');
      aiCanvas.width = 224;
      aiCanvas.height = 224;
      const aiCtx = aiCanvas.getContext('2d');
      if (!aiCtx) return null;
      aiCtx.drawImage(video, sx, sy, size, size, 0, 0, 224, 224);

      const emb = await getEmbedding(aiCanvas);
      frameEmbeddings.push(emb);

      if (f < FRAME_COUNT - 1) {
        await new Promise((r) => setTimeout(r, FRAME_DELAY));
      }
    }

    // Average all frame embeddings
    const dim = frameEmbeddings[0].length;
    const averaged = new Array(dim).fill(0);
    for (const emb of frameEmbeddings) {
      for (let i = 0; i < dim; i++) {
        averaged[i] += emb[i];
      }
    }
    for (let i = 0; i < dim; i++) {
      averaged[i] /= FRAME_COUNT;
    }

    return averaged;
  };

  // Main Image Processing & Inference (with multi-frame averaging)
  const performInference = async (): Promise<{ embedding: number[]; base64: string; barcode: string | null } | null> => {
    if (!videoRef.current || !modelLoaded) return null;

    try {
      setIsScanning(true);
      
      const video = videoRef.current;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      // 1. Capture full resolution frame for AI cropping
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, width, height);

      // 2. Multi-frame averaging for AI embedding
      const embedding = await captureMultiFrameEmbedding();
      if (!embedding) {
        setIsScanning(false);
        return null;
      }

      // Store in ref for self-learning
      lastQueryEmbeddingRef.current = embedding;

      // 3. Generate base64 preview from current frame
      const size = Math.min(width, height);
      const sx = (width - size) / 2;
      const sy = (height - size) / 2;
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = 224;
      previewCanvas.height = 224;
      const previewCtx = previewCanvas.getContext('2d');
      if (previewCtx) {
        previewCtx.drawImage(canvas, sx, sy, size, size, 0, 0, 224, 224);
      }
      const base64 = previewCanvas.toDataURL('image/webp', 0.8);

      setIsScanning(false);
      return { embedding, base64, barcode: null };
    } catch (err) {
      console.error('Inference error:', err);
      setIsScanning(false);
      return null;
    }
  };

  /** Handle successful product detection — supports continuous mode and self-learning */
  const handleProductMatch = (matchProduct: Produk, source: 'barcode' | 'ai', capturedEmbedding?: number[]) => {
    triggerSuccessFeedback();
    onDetected(matchProduct, capturedEmbedding);

    if (continuousMode) {
      // Don't close camera — show inline toast and continue scanning
      setScanCount((prev) => prev + 1);
      showInlineToast(`✅ ${matchProduct.nama} +1`);
      setCandidates([]);
      setStatusMessage('Mencari produk otomatis (Barcode / AI)...');
    } else {
      onClose();
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
      // Photo register mode — generate augmented embeddings (1 foto → 6 embeddings)
      setStatusMessage('Menghasilkan variasi AI (6 embedding)...');
      const video = videoRef.current;
      if (!video) return;

      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      const size = Math.min(width, height);
      const sx = (width - size) / 2;
      const sy = (height - size) / 2;

      const aiCanvas = document.createElement('canvas');
      aiCanvas.width = 224;
      aiCanvas.height = 224;
      const aiCtx = aiCanvas.getContext('2d');
      if (!aiCtx) return;
      aiCtx.drawImage(video, sx, sy, size, size, 0, 0, 224, 224);

      const augmentedEmbeddings = await generateAugmentedEmbeddings(aiCanvas);
      onPhotoCaptured(result.base64, augmentedEmbeddings);
      triggerSuccessFeedback();
      onClose();
      return;
    }

    // Check barcode match first
    if (result.barcode) {
      if (onBarcodeScanned) {
        triggerSuccessFeedback();
        onBarcodeScanned(result.barcode);
        onClose();
        return;
      }
      const matchProduct = produkList.find(
        (p) => p.barcode === result.barcode || p.kode === result.barcode
      );
      if (matchProduct) {
        handleProductMatch(matchProduct, 'barcode');
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
          handleProductMatch(matchProduct, 'ai');
        } else {
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
        if (onBarcodeScanned) {
          triggerSuccessFeedback();
          onBarcodeScanned(result.barcode);
          onClose();
          return;
        }
        const matchProduct = produkList.find(
          (p) => p.barcode === result.barcode || p.kode === result.barcode
        );
        if (matchProduct) {
          handleProductMatch(matchProduct, 'barcode');
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
            handleProductMatch(matchProduct, 'ai');
          } else {
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
    }, 1500);

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
        <div className="flex items-center gap-2">
          {/* Continuous mode scan counter badge */}
          {continuousMode && scanCount > 0 && (
            <div className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              <ShoppingCart className="w-3 h-3" />
              {scanCount} item
            </div>
          )}
          <button
            onClick={onClose}
            className="p-2 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400 hover:text-zinc-200" />
          </button>
        </div>
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

        {/* Inline toast overlay for continuous mode */}
        {inlineToast && (
          <div className="absolute bottom-6 left-6 right-6 bg-emerald-500/90 backdrop-blur-md text-white px-4 py-3 rounded-2xl text-center z-30 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <span className="text-sm font-bold tracking-wide">{inlineToast}</span>
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
                  handleProductMatch(c.produk, 'ai', lastQueryEmbeddingRef.current || undefined);
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
                setStatusMessage(isAutoMode ? 'Mencari produk otomatis (Barcode / AI)...' : 'Arahkan kamera ke produk');
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
                setStatusMessage('Mencari produk otomatis (Barcode / AI)...');
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
