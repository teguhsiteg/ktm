import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp, deleteDoc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Booking, Mahasiswa } from '@/types';
import { format, parseISO } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { CheckCircle2, XCircle, Scan, AlertCircle, RotateCcw, Trash2, Clock, Check, ArrowRight, Search, FileSpreadsheet, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { isBookingNotStartedYet, isBookingExpired } from '@/lib/utils';
import * as XLSX from 'xlsx';

type ScannedLog = {
  id: string; // distribusi id
  booking_id: string;
  nim: string;
  nama: string;
  waktu: any;
};

export default function ScannerPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [mahasiswa, setMahasiswa] = useState<Mahasiswa | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'valid' | 'used' | 'invalid' | 'expired'>('idle');
  const [isEarly, setIsEarly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recentLogs, setRecentLogs] = useState<ScannedLog[]>([]);
  const [liveQueue, setLiveQueue] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [manualInput, setManualInput] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const autoResetTimeoutRef = useRef<any>(null);

  const prevQueueLengthRef = useRef(0);

  const filteredHistoryLogs = useMemo(() => {
    if (!historySearch.trim()) return recentLogs;
    const s = historySearch.toLowerCase();
    return recentLogs.filter(log => 
      log.nama?.toLowerCase().includes(s) || 
      log.nim?.toLowerCase().includes(s) ||
      log.booking_id?.toLowerCase().includes(s)
    );
  }, [recentLogs, historySearch]);

  // Keep references to prevent stale closures in the scanner callback
  const statusRef = useRef(status);
  const scanResultRef = useRef(scanResult);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    scanResultRef.current = scanResult;
  }, [scanResult]);

  useEffect(() => {
    return () => {
      if (autoResetTimeoutRef.current) {
        clearTimeout(autoResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'live_scans'),
      where('status', '==', 'pending'),
      orderBy('scanned_at', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      
      // Play alert sound if a new item is added to the queue
      if (items.length > prevQueueLengthRef.current && prevQueueLengthRef.current > 0) {
        playBeep('success');
        toast.info(`Ada antrean scan baru dari mahasiswa! (${items.length} menunggu)`);
      }
      
      prevQueueLengthRef.current = items.length;
      setLiveQueue(items);
    });

    return () => unsubscribe();
  }, []);

  // Synchronize recentLogs (history) from database in real-time
  useEffect(() => {
    const q = query(
      collection(db, 'distribusi'),
      orderBy('waktu_pengambilan', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs: ScannedLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        logs.push({
          id: docSnap.id,
          booking_id: data.booking_id,
          nim: data.nim,
          nama: data.nama,
          waktu: data.waktu_pengambilan?.toDate() || new Date()
        });
      });
      setRecentLogs(logs);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let isMounted = true;
    let scanner: Html5QrcodeScanner | null = null;

    // Use a short delay to avoid React 18 strict mode double-initialization collision
    const timer = setTimeout(() => {
      if (!isMounted) return;

      const container = document.getElementById("qr-reader");
      if (container) {
        container.innerHTML = "";
      }

      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 200, height: 200 }, 
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] 
        },
        false
      );
      
      scannerRef.current = scanner;
      scanner.render(onScanSuccess, onScanFailure);
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scanner) {
        scanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
        scannerRef.current = null;
      }
    };
  }, []);

  const onScanSuccess = async (decodedText: string) => {
    if (statusRef.current !== 'loading' && decodedText !== scanResultRef.current) {
      playBeep('scan');
      setScanResult(decodedText);
      checkBooking(decodedText);
    }
  };

  const onScanFailure = (error: any) => {
    // handle scan failure, usually better to ignore and keep scanning
  };

  const playBeep = (type: 'success' | 'error' | 'scan' = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'scan') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.08);
      } else if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(950, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.18);
      } else if (type === 'error') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.35);
      }
    } catch (e) {
      console.error('Failed to play synthesized beep:', e);
    }
  };

  const checkBooking = async (token: string) => {
    setStatus('loading');
    try {
      const q = query(collection(db, 'booking'), where('qr_token', '==', token));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setStatus('invalid');
        setBooking(null);
        setMahasiswa(null);
        setIsEarly(false);
        playBeep('error');
        return;
      }

      const b = snap.docs[0].data() as Booking;
      b.id = snap.docs[0].id;
      setBooking(b);

      const mDoc = await getDoc(doc(db, 'mahasiswa', b.mahasiswa_id));
      if (mDoc.exists()) {
        setMahasiswa(mDoc.data() as Mahasiswa);
      }

      const expired = b.status === 'Hangus' || isBookingExpired(b.tanggal, b.jam);
      
      if (expired && b.status !== 'Hangus') {
        try {
          await updateDoc(doc(db, 'booking', b.id), { status: 'Hangus' });
          b.status = 'Hangus';
        } catch (err) {
          console.error('Failed to auto-update expired booking status on scan:', err);
        }
      }

      if (b.status === 'Sudah Diambil') {
        setStatus('used');
        setIsEarly(false);
        playBeep('error');
      } else if (expired) {
        setStatus('expired');
        setIsEarly(false);
        playBeep('error');
        toast.error('Gagal: Tiket ini sudah hangus / melewati batas waktu pengambilan!', { duration: 6000 });
      } else {
        const early = isBookingNotStartedYet(b.tanggal, b.jam);
        setIsEarly(early);
        setStatus('valid');
        if (early) {
          playBeep('error');
          toast.warning(`Peringatan: Jadwal pengambilan belum dimulai! Sesi ini adalah pukul ${b.jam}.`, { duration: 6000 });
        } else {
          playBeep('success');
        }
      }
    } catch (e) {
      console.error(e);
      setStatus('invalid');
      setIsEarly(false);
      playBeep('error');
    }
  };

  const handleManualVerify = async (input: string) => {
    if (!input.trim()) {
      toast.error('Masukkan NIM atau Token Tiket terlebih dahulu');
      return;
    }
    const cleanInput = input.trim();
    setStatus('loading');
    
    try {
      // 1. Coba cari berdasarkan qr_token (Token Tiket)
      let qBooking = query(collection(db, 'booking'), where('qr_token', '==', cleanInput));
      let snapBooking = await getDocs(qBooking);
      
      // 2. Jika tidak ada, coba cari mahasiswa dengan NIM tersebut
      if (snapBooking.empty) {
        const qMhs = query(collection(db, 'mahasiswa'), where('nim', '==', cleanInput));
        const snapMhs = await getDocs(qMhs);
        
        if (!snapMhs.empty) {
          const mhsId = snapMhs.docs[0].id;
          // Cari booking milik mahasiswa tersebut
          qBooking = query(
            collection(db, 'booking'), 
            where('mahasiswa_id', '==', mhsId)
          );
          snapBooking = await getDocs(qBooking);
        }
      }

      // 3. Jika masih tidak ada, coba cari booking dengan ID langsung
      if (snapBooking.empty) {
        try {
          const docRef = doc(db, 'booking', cleanInput);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const bData = docSnap.data() as Booking;
            bData.id = docSnap.id;
            
            setBooking(bData);
            const mDoc = await getDoc(doc(db, 'mahasiswa', bData.mahasiswa_id));
            if (mDoc.exists()) {
              setMahasiswa(mDoc.data() as Mahasiswa);
            }
            
            const expired = bData.status === 'Hangus' || isBookingExpired(bData.tanggal, bData.jam);
            if (expired && bData.status !== 'Hangus') {
              await updateDoc(doc(db, 'booking', bData.id), { status: 'Hangus' });
              bData.status = 'Hangus';
            }

            if (bData.status === 'Sudah Diambil') {
              setStatus('used');
              setIsEarly(false);
              playBeep('error');
            } else if (expired) {
              setStatus('expired');
              setIsEarly(false);
              playBeep('error');
              toast.error('Gagal: Tiket ini sudah hangus / melewati batas waktu pengambilan!', { duration: 6000 });
            } else {
              const early = isBookingNotStartedYet(bData.tanggal, bData.jam);
              setIsEarly(early);
              setStatus('valid');
              if (early) {
                playBeep('error');
                toast.warning(`Peringatan: Jadwal pengambilan belum dimulai! Sesi ini adalah pukul ${bData.jam}.`, { duration: 6000 });
              } else {
                playBeep('success');
              }
            }
            return;
          }
        } catch (e) {
          // ignore parsing error
        }
      }
      
      if (snapBooking.empty) {
        setStatus('invalid');
        setBooking(null);
        setMahasiswa(null);
        setIsEarly(false);
        playBeep('error');
        toast.error('Data booking atau mahasiswa tidak ditemukan');
        return;
      }

      // Ambil booking pertama yang valid (yang tidak dibatalkan, preferensi yang belum diambil atau hangus)
      let selectedDoc = snapBooking.docs[0];
      if (snapBooking.docs.length > 1) {
        const activeBookings = snapBooking.docs.filter(d => d.data().status !== 'Batal');
        if (activeBookings.length > 0) {
          selectedDoc = activeBookings[0];
        }
      }

      const b = selectedDoc.data() as Booking;
      b.id = selectedDoc.id;
      setBooking(b);

      const mDoc = await getDoc(doc(db, 'mahasiswa', b.mahasiswa_id));
      if (mDoc.exists()) {
        setMahasiswa(mDoc.data() as Mahasiswa);
      }

      const expired = b.status === 'Hangus' || isBookingExpired(b.tanggal, b.jam);
      
      if (expired && b.status !== 'Hangus') {
        try {
          await updateDoc(doc(db, 'booking', b.id), { status: 'Hangus' });
          b.status = 'Hangus';
        } catch (err) {
          console.error('Failed to auto-update expired booking status:', err);
        }
      }

      if (b.status === 'Sudah Diambil') {
        setStatus('used');
        setIsEarly(false);
        playBeep('error');
      } else if (expired) {
        setStatus('expired');
        setIsEarly(false);
        playBeep('error');
        toast.error('Gagal: Tiket ini sudah hangus / melewati batas waktu pengambilan!', { duration: 6000 });
      } else {
        const early = isBookingNotStartedYet(b.tanggal, b.jam);
        setIsEarly(early);
        setStatus('valid');
        if (early) {
          playBeep('error');
          toast.warning(`Peringatan: Jadwal pengambilan belum dimulai! Sesi ini adalah pukul ${b.jam}.`, { duration: 6000 });
        } else {
          playBeep('success');
        }
      }
    } catch (e) {
      console.error(e);
      setStatus('invalid');
      setIsEarly(false);
      playBeep('error');
      toast.error('Terjadi kesalahan saat memverifikasi data');
    }
  };

  const handleSerahkan = async () => {
    if (!booking || !mahasiswa) return;
    setSubmitting(true);
    try {
      // Update booking
      await updateDoc(doc(db, 'booking', booking.id), {
        status: 'Sudah Diambil',
        updated_at: serverTimestamp()
      });

      // Update mahasiswa status
      await updateDoc(doc(db, 'mahasiswa', booking.mahasiswa_id), {
        status_ktm: 'Sudah diambil',
        tanggal_ambil: serverTimestamp()
      });

      // Add to distribusi activity log
      const distRef = await addDoc(collection(db, 'distribusi'), {
        booking_id: booking.id,
        admin_id: 'admin_1', // mocked for now
        waktu_pengambilan: serverTimestamp(),
        status: 'Sudah Diambil',
        nim: mahasiswa.nim,
        nama: mahasiswa.nama
      });

      // Add to local state
      setRecentLogs(prev => [{
        id: distRef.id,
        booking_id: booking.id,
        nim: mahasiswa.nim,
        nama: mahasiswa.nama,
        waktu: new Date()
      }, ...prev]);

      setStatus('used'); // Update local UI
      setIsEarly(false);
      setBooking({ ...booking, status: 'Sudah Diambil' });
      toast.success(`KTM ${mahasiswa.nama} berhasil diserahkan`);

      // Automatically reset scanner to idle state after 1.5 seconds so admin doesn't have to click anything
      autoResetTimeoutRef.current = setTimeout(() => {
        resetScanner();
      }, 1500);
    } catch (e) {
      console.error(e);
      toast.error('Gagal memproses penyerahan KTM');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndo = async (log: ScannedLog) => {
    try {
      // Revert booking status
      await updateDoc(doc(db, 'booking', log.booking_id), {
        status: 'Belum Diambil',
        updated_at: serverTimestamp()
      });

      // Revert mahasiswa status
      const bSnap = await getDoc(doc(db, 'booking', log.booking_id));
      if (bSnap.exists()) {
        const bData = bSnap.data();
        await updateDoc(doc(db, 'mahasiswa', bData.mahasiswa_id), {
          status_ktm: 'Tersedia',
          tanggal_ambil: null
        });
      }

      // Delete log
      await deleteDoc(doc(db, 'distribusi', log.id));

      setRecentLogs(prev => prev.filter(l => l.id !== log.id));
      toast.success(`Berhasil membatalkan penyerahan KTM untuk ${log.nama}`);
      
      // If currently showing the undone ticket, reset the scanner view
      if (booking && booking.id === log.booking_id) {
        resetScanner();
      }
    } catch (e) {
      console.error(e);
      toast.error('Gagal membatalkan penyerahan');
    }
  };

  const handleSelectHistoryLog = async (log: ScannedLog) => {
    setStatus('loading');
    try {
      const bDoc = await getDoc(doc(db, 'booking', log.booking_id));
      if (bDoc.exists()) {
        const bData = bDoc.data() as Booking;
        bData.id = bDoc.id;
        setBooking(bData);
        
        const mDoc = await getDoc(doc(db, 'mahasiswa', bData.mahasiswa_id));
        if (mDoc.exists()) {
          setMahasiswa(mDoc.data() as Mahasiswa);
        }
        
        setStatus('used');
        setIsEarly(false);
        toast.info(`Menampilkan detail riwayat KTM ${log.nama}`);
      } else {
        toast.error('Data booking tidak ditemukan');
        setStatus('idle');
      }
    } catch (e) {
      console.error(e);
      toast.error('Gagal memuat detail riwayat');
      setStatus('idle');
    }
  };

  const handleExportHistory = () => {
    if (recentLogs.length === 0) {
      toast.error('Tidak ada data riwayat untuk diexport');
      return;
    }
    
    try {
      const dataToExport = recentLogs.map((log, index) => ({
        'No': index + 1,
        'Booking ID': log.booking_id,
        'NIM': log.nim,
        'Nama': log.nama,
        'Waktu Penyerahan': format(log.waktu instanceof Date ? log.waktu : new Date(log.waktu), 'yyyy-MM-dd HH:mm:ss')
      }));
      
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Distribusi');
      
      const fileName = `Riwayat_Distribusi_KTM_Scanner_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Berhasil mengexport data riwayat ke Excel!');
    } catch (e) {
      console.error(e);
      toast.error('Gagal mengexport data riwayat');
    }
  };

  const resetScanner = () => {
    if (autoResetTimeoutRef.current) {
      clearTimeout(autoResetTimeoutRef.current);
      autoResetTimeoutRef.current = null;
    }
    setScanResult(null);
    setBooking(null);
    setMahasiswa(null);
    setStatus('idle');
    setIsEarly(false);
    setManualInput('');
  };

  const handleSerahkanQueue = async (item: any) => {
    setSubmitting(true);
    try {
      // 1. Update booking
      await updateDoc(doc(db, 'booking', item.booking_id), {
        status: 'Sudah Diambil',
        updated_at: serverTimestamp()
      });

      // Update mahasiswa status
      await updateDoc(doc(db, 'mahasiswa', item.mahasiswa_id), {
        status_ktm: 'Sudah diambil',
        tanggal_ambil: serverTimestamp()
      });

      // 2. Add to distribusi activity log
      const distRef = await addDoc(collection(db, 'distribusi'), {
        booking_id: item.booking_id,
        admin_id: 'admin_1', // mocked for now
        waktu_pengambilan: serverTimestamp(),
        status: 'Sudah Diambil',
        nim: item.nim,
        nama: item.nama
      });

      // 3. Mark live queue item as processed
      await updateDoc(doc(db, 'live_scans', item.id), {
        status: 'processed',
        processed_at: serverTimestamp()
      });

      // 4. Add to local state (recent logs)
      setRecentLogs(prev => [{
        id: distRef.id,
        booking_id: item.booking_id,
        nim: item.nim,
        nama: item.nama,
        waktu: new Date()
      }, ...prev]);

      // If currently showing this student in the admin local scanner, set status as used
      if (booking && booking.id === item.booking_id) {
        setStatus('used');
        setBooking({ ...booking, status: 'Sudah Diambil' });

        // Automatically reset scanner to idle state after 1.5 seconds so admin doesn't have to click anything
        autoResetTimeoutRef.current = setTimeout(() => {
          resetScanner();
        }, 1500);
      }

      toast.success(`KTM ${item.nama} berhasil diserahkan!`);
    } catch (e) {
      console.error(e);
      toast.error('Gagal menyerahkan KTM dari antrean');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismissQueue = async (item: any) => {
    try {
      await updateDoc(doc(db, 'live_scans', item.id), {
        status: 'skipped',
        skipped_at: serverTimestamp()
      });
      toast.success(`Antrean ${item.nama} dilewati`);
    } catch (e) {
      console.error(e);
      toast.error('Gagal melewati antrean');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Scan className="w-5 h-5 text-[#005BAC]" />
            Terminal Verifikasi & Scanner KTM
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Pindai QR Code tiket mahasiswa secara real-time atau pantau antrean penyerahan KTM langsung dari terminal scan publik.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Local Scanner & Live Queue / History */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Card 1: Camera Scanner */}
          <Card className="bg-white dark:bg-[#1E1E1E] dark:border-gray-800 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
              <CardTitle className="text-sm font-bold text-gray-900 dark:text-white flex items-center">
                <Scan className="w-4.5 h-4.5 mr-2 text-[#005BAC] dark:text-[#8AB4F8]" /> 
                Kamera QR Scanner Lokal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col items-center">
              <div className="relative w-full max-w-[320px] mx-auto overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 shadow-md bg-slate-50 dark:bg-zinc-900/50 p-2">
                {/* Corner brackets for tech feel */}
                <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-[#005BAC] dark:border-[#8AB4F8] z-10 rounded-tl-xs" />
                <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-[#005BAC] dark:border-[#8AB4F8] z-10 rounded-tr-xs" />
                <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-[#005BAC] dark:border-[#8AB4F8] z-10 rounded-bl-xs" />
                <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-[#005BAC] dark:border-[#8AB4F8] z-10 rounded-br-xs" />
                
                {/* Laser line animation */}
                {status === 'idle' && (
                  <div className="absolute top-2 left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-[#005BAC] dark:via-[#8AB4F8] to-transparent animate-bounce z-10 opacity-70" style={{ animationDuration: '2.5s' }} />
                )}
                {status === 'loading' && (
                  <div className="absolute inset-2 bg-black/40 backdrop-blur-xs flex items-center justify-center z-10 rounded-xl">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
                  </div>
                )}
                
                <div id="qr-reader" className="w-full"></div>
              </div>
              <p className="text-[10px] text-gray-400 mt-3 text-center mb-4">
                Berikan izin kamera untuk memindai tiket secara instan.
              </p>

              {/* Input Manual Section */}
              <div className="w-full border-t border-gray-100 dark:border-gray-800 pt-4 mt-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-1.5 text-left">
                  Verifikasi Manual (NIM / Token Tiket)
                </label>
                <div className="flex gap-2 w-full">
                  <input 
                    type="text"
                    placeholder="Masukkan NIM atau Kode Tiket..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleManualVerify(manualInput);
                      }
                    }}
                    className="flex-1 min-w-0 bg-slate-50 dark:bg-[#2A2A2A] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#005BAC] dark:focus:ring-[#8AB4F8] dark:text-white"
                  />
                  <Button 
                    size="sm"
                    onClick={() => handleManualVerify(manualInput)}
                    className="bg-[#005BAC] hover:bg-[#004B8C] text-white rounded-xl px-4 text-xs font-bold shrink-0 h-9"
                    disabled={status === 'loading'}
                  >
                    Verifikasi
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Live Queue & History */}
          <Card className="bg-white dark:bg-[#1E1E1E] dark:border-gray-800 shadow-sm overflow-hidden flex flex-col lg:h-[460px] rounded-2xl">
            <CardHeader className="bg-gray-50/50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 py-3.5 px-4 sm:px-6">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-zinc-850 rounded-xl w-full">
                  <button 
                    onClick={() => setActiveTab('queue')}
                    className={`flex-1 rounded-lg text-xs py-1.5 font-bold flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === 'queue' 
                        ? 'bg-[#005BAC] text-white shadow-xs' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Antrean ({liveQueue.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 rounded-lg text-xs py-1.5 font-bold flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === 'history' 
                        ? 'bg-[#005BAC] text-white shadow-xs' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Riwayat ({recentLogs.length})
                  </button>
                </div>
                
                {activeTab === 'queue' && liveQueue.length > 0 && (
                  <span className="animate-pulse bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-extrabold py-1 px-3 rounded-full flex items-center justify-center gap-1.5 w-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    MONITOR ANTRIAN AKTIF
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              {activeTab === 'queue' ? (
                liveQueue.length === 0 ? (
                  <div className="min-h-[250px] flex flex-col items-center justify-center p-6 text-center text-gray-500 dark:text-gray-400">
                    <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl mb-3 border border-gray-100 dark:border-gray-800 shadow-xs">
                      <Scan className="w-8 h-8 opacity-30 text-gray-400" />
                    </div>
                    <p className="font-bold text-xs text-gray-800 dark:text-gray-200">Tidak Ada Antrean</p>
                    <p className="text-[10px] text-gray-400 mt-1 max-w-[200px] mx-auto">
                      Mahasiswa dapat scan tiket mandiri di PC luar untuk masuk antrean.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                    {liveQueue.map((item) => (
                      <li key={item.id} className="p-3.5 hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition-colors flex flex-col gap-3 group">
                        <div className="flex items-start gap-2.5">
                          <div className="bg-[#E8F0FE] dark:bg-[#1A2E4C] p-2 rounded-lg text-[#005BAC] dark:text-[#8AB4F8] mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold text-gray-900 dark:text-gray-100 flex flex-wrap items-center gap-1.5 leading-tight">
                              {item.nama}
                              {item.is_early && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-extrabold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                                  Belum Sesi
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold mt-0.5 truncate">{item.nim} • {item.prodi}</p>
                            <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1 font-medium">
                              <Clock className="w-2.5 h-2.5" />
                              Masuk: {item.scanned_at ? format(item.scanned_at.toDate ? item.scanned_at.toDate() : new Date(item.scanned_at), 'HH:mm:ss') : 'Baru saja'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-2 border-t border-gray-50 dark:border-gray-800/40">
                          <Button 
                            size="sm" 
                            onClick={() => handleDismissQueue(item)}
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-7 px-2.5 text-[10px] font-bold rounded-lg"
                          >
                            Lewati
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleSerahkanQueue(item)}
                            className="bg-[#005BAC] hover:bg-[#004B8C] text-white h-7 px-3 rounded-lg flex items-center gap-1 font-bold text-[10px] shadow-xs"
                            disabled={submitting}
                          >
                            <ArrowRight className="w-3 h-3" />
                            Pilih & Serahkan
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <div className="flex flex-col h-full">
                  {/* Search and Export Action Bar */}
                  <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-zinc-800/20 flex flex-col sm:flex-row gap-2 items-center justify-between">
                    <div className="relative w-full sm:max-w-[200px]">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Cari nama atau NIM..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className="pl-8 h-8 text-xs rounded-xl dark:bg-[#2A2A2A] border-gray-200 dark:border-gray-700 w-full font-semibold placeholder:text-gray-400"
                      />
                    </div>
                    <Button
                      onClick={handleExportHistory}
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-xl text-xs font-bold border-gray-200 dark:border-gray-750 flex items-center gap-1.5 w-full sm:w-auto"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Export Excel</span>
                    </Button>
                  </div>

                  {filteredHistoryLogs.length === 0 ? (
                    <div className="min-h-[250px] flex flex-col items-center justify-center p-6 text-center text-gray-500 dark:text-gray-400">
                      <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl mb-3 border border-gray-100 dark:border-gray-800 shadow-xs">
                        <Search className="w-8 h-8 opacity-30 text-gray-400" />
                      </div>
                      <p className="font-bold text-xs text-gray-800 dark:text-gray-200">Tidak Ada Hasil</p>
                      <p className="text-[10px] text-gray-400 mt-1">Coba cari dengan kata kunci lain.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[350px] overflow-y-auto">
                      {filteredHistoryLogs.map((log) => (
                        <li key={log.id} className="p-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition-colors flex items-center justify-between gap-2.5 group">
                          <div 
                            className="flex items-start gap-2.5 min-w-0 flex-1 cursor-pointer"
                            onClick={() => handleSelectHistoryLog(log)}
                            title="Klik untuk lihat detail di papan verifikasi"
                          >
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded-lg text-emerald-600 dark:text-emerald-400 mt-0.5 group-hover:scale-105 transition-transform shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-extrabold text-gray-900 dark:text-gray-100 truncate group-hover:text-[#005BAC] dark:group-hover:text-[#8AB4F8] transition-colors">{log.nama}</p>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold">{log.nim}</p>
                              <p className="text-[9px] text-gray-450 dark:text-gray-500 mt-0.5 flex items-center gap-1 font-medium flex-wrap">
                                <Clock className="w-2.5 h-2.5" />
                                <span>Selesai: {format(log.waktu instanceof Date ? log.waktu : new Date(log.waktu), 'HH:mm:ss')}</span>
                                {log.booking_id && (
                                  <span className="text-[8px] px-1 py-0.1 bg-gray-100 dark:bg-zinc-800 text-gray-400 rounded">ID: {log.booking_id.substring(0, 5)}...</span>
                                )}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectHistoryLog(log)}
                              className="text-gray-400 hover:text-[#005BAC] dark:hover:text-[#8AB4F8] hover:bg-gray-100 dark:hover:bg-zinc-800 h-7 w-7 p-0 rounded-lg shrink-0"
                              title="Lihat Detail"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleUndo(log)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:text-red-400 h-7 px-2 rounded-lg flex items-center gap-1 font-bold text-[10px] transition-all shrink-0"
                              title="Batalkan Penyerahan"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span className="hidden sm:inline">Batal</span>
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Verification Results (Prominent Space) */}
        <div className="lg:col-span-7 flex flex-col">
          <Card className={`transition-all duration-300 border shadow-md rounded-2xl lg:min-h-[580px] flex flex-col justify-between ${
            status === 'valid' && isEarly ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/10' :
            status === 'valid' ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/10' :
            status === 'used' ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/10' :
            status === 'expired' ? 'border-red-500 bg-red-50/40 dark:bg-red-950/10' :
            status === 'invalid' ? 'border-red-500 bg-red-50/40 dark:bg-red-950/10' :
            'border-gray-200 bg-white dark:bg-[#1E1E1E] dark:border-gray-800'
          }`}>
            <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-zinc-800/10">
              <CardTitle className="text-sm font-bold text-gray-900 dark:text-white flex items-center justify-between w-full">
                <span className="flex items-center">
                  <CheckCircle2 className="w-4.5 h-4.5 mr-2 text-[#005BAC] dark:text-[#8AB4F8]" /> 
                  Detail Hasil Pemindaian & Verifikasi
                </span>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-gray-500 font-mono tracking-wider">
                  STATUS: {status.toUpperCase()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 flex-1 flex flex-col items-center justify-center text-center">
              {status === 'idle' && (
                <div className="text-gray-400 dark:text-gray-500 flex flex-col items-center py-12 max-w-sm mx-auto">
                  <div className="p-5 bg-slate-50 dark:bg-zinc-800/50 rounded-full mb-5 border border-gray-100 dark:border-gray-800 shadow-sm animate-pulse">
                    <Scan className="w-14 h-14 text-[#005BAC]/50" />
                  </div>
                  <h3 className="text-base font-extrabold text-gray-800 dark:text-gray-200">Terminal Siap Menerima Tiket</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                    Silakan arahkan tiket mahasiswa ke kamera scanner lokal atau klik tombol <strong>"Pilih & Serahkan"</strong> pada daftar antrean scan publik di sebelah kiri untuk memproses verifikasi KTM.
                  </p>
                </div>
              )}

              {status === 'loading' && (
                <div className="flex flex-col items-center py-16">
                  <span className="animate-spin h-10 w-10 border-4 border-[#005BAC] border-t-transparent rounded-full mb-4" />
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Mengambil & memvalidasi data...</p>
                  <p className="text-xs text-gray-400 mt-1">Harap tunggu sebentar</p>
                </div>
              )}

              {status === 'invalid' && (
                <div className="text-red-600 dark:text-red-400 flex flex-col items-center max-w-sm mx-auto py-12">
                  <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-full mb-4 border border-red-100 dark:border-red-900/40">
                    <XCircle className="w-12 h-12" />
                  </div>
                  <h3 className="text-lg font-extrabold mb-1.5">Tiket QR Tidak Dikenal</h3>
                  <p className="text-xs text-red-500 dark:text-red-400 leading-relaxed mb-6">
                    Kode QR yang dipindai tidak terdaftar di sistem pengambilan KTM Universitas Islam Indonesia atau format kode tidak sesuai.
                  </p>
                  <Button variant="outline" size="sm" className="w-full rounded-xl bg-white dark:bg-[#2A2A2A] h-10 font-bold" onClick={resetScanner}>Pindai Ulang</Button>
                </div>
              )}

              {(status === 'valid' || status === 'used' || status === 'expired') && booking && mahasiswa && (
                <div className="w-full flex flex-col h-full justify-between items-center space-y-6">
                  <div className="w-full max-w-md mx-auto">
                    <div className={`inline-flex items-center justify-center p-3 rounded-full mb-3 ${
                      status === 'valid' && isEarly ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' :
                      status === 'valid' ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 
                      status === 'expired' ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400' :
                      'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                    }`}>
                      {status === 'valid' && isEarly ? <AlertCircle className="w-8 h-8" /> :
                       status === 'valid' ? <CheckCircle2 className="w-8 h-8" /> : 
                       status === 'expired' ? <XCircle className="w-8 h-8" /> :
                       <AlertCircle className="w-8 h-8" />}
                    </div>
                    
                    <h3 className={`text-xl font-extrabold mb-1 ${
                      status === 'valid' && isEarly ? 'text-amber-700 dark:text-amber-400' :
                      status === 'valid' ? 'text-emerald-700 dark:text-emerald-400' : 
                      status === 'expired' ? 'text-red-700 dark:text-red-400' :
                      'text-amber-700 dark:text-amber-400'
                    }`}>
                      {status === 'valid' && isEarly ? 'Tiket Valid (Belum Waktunya)' :
                       status === 'valid' ? 'Tiket Valid - Siap Diambil' : 
                       status === 'expired' ? 'Tiket Hangus / Expired' :
                       'Tiket Sudah Digunakan'}
                    </h3>

                    {status === 'valid' && isEarly && (
                      <div className="mb-4 mt-3 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-left text-amber-800 dark:text-amber-300">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div>
                          <p className="font-extrabold text-xs">Peringatan Sesi Belum Masuk</p>
                          <p className="text-[11px] mt-0.5 leading-relaxed text-amber-700 dark:text-amber-400">
                            Jadwal pengambilan tiket ini belum masuk waktunya saat ini. Sesi terdaftar: <strong>{booking.tanggal} ({booking.jam})</strong>.
                          </p>
                        </div>
                      </div>
                    )}

                    {status === 'expired' && (
                      <div className="mb-4 mt-3 p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-left text-red-800 dark:text-red-300 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                        <div>
                          <p className="font-extrabold text-xs">Gagal: Tiket Hangus!</p>
                          <p className="text-[11px] mt-0.5 leading-relaxed text-red-700 dark:text-red-400">
                            Jadwal pengambilan tiket ini sudah berakhir pada <strong>{booking.tanggal} ({booking.jam})</strong>. Mahasiswa harus melakukan pengajuan ulang jadwal pengambilan.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* KTM Boarding Pass Style Card */}
                    <div className="relative overflow-hidden bg-white dark:bg-[#2A2A2A] rounded-2xl border border-gray-200 dark:border-gray-800 text-left mt-4 shadow-sm w-full">
                      {/* ID Header badge */}
                      <div className="bg-slate-50 dark:bg-zinc-800/40 px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <span className="text-[9px] font-extrabold tracking-widest text-gray-400 uppercase font-mono">UII KTM BOARDING PASS</span>
                        <img 
                          src="https://www.uii.ac.id/wp-content/uploads/2017/04/Logo-UII-Asli.png" 
                          alt="UII" 
                          className="w-5 h-5 object-contain opacity-80"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      
                      <div className="p-5 space-y-4">
                        <div className="flex items-center space-x-3.5">
                          <div className="w-11 h-11 rounded-full bg-[#E8F0FE] dark:bg-[#1A2E4C] flex items-center justify-center font-extrabold text-[#005BAC] dark:text-[#8AB4F8] text-base shadow-inner">
                            {mahasiswa.nama.charAt(0)}
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Nama Mahasiswa</p>
                            <p className="font-extrabold text-gray-900 dark:text-gray-100 text-base leading-tight mt-0.5">{mahasiswa.nama}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-3.5 border-t border-dashed border-gray-200 dark:border-gray-700">
                          <div>
                            <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">Nomor Induk Mahasiswa (NIM)</p>
                            <p className="font-bold text-gray-900 dark:text-gray-100 text-sm font-mono mt-0.5">{mahasiswa.nim}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">Program Studi</p>
                            <p className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate mt-0.5" title={mahasiswa.prodi}>{mahasiswa.prodi}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-3.5 border-t border-gray-100 dark:border-gray-800">
                          <div>
                            <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">Alokasi Jam Sesi</p>
                            <p className="font-extrabold text-[#005BAC] dark:text-[#8AB4F8] text-sm flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-4 h-4" /> {booking.jam} WIB
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">Tanggal Sesi</p>
                            <p className="font-bold text-gray-700 dark:text-gray-300 text-sm mt-0.5">
                              {(() => {
                                try {
                                  return format(parseISO(booking.tanggal), 'eeee, dd MMM yyyy', { locale: localeID });
                                } catch(e) {
                                  return booking.tanggal;
                                }
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full max-w-md mx-auto pt-4 flex flex-col gap-2">
                    <div className="flex gap-3 w-full">
                      <Button variant="outline" size="sm" className="flex-1 bg-white dark:bg-[#2A2A2A] text-gray-700 dark:text-gray-300 rounded-xl h-11 font-bold shadow-sm" onClick={resetScanner}>
                        {status === 'used' ? 'Reset Sekarang' : 'Batal / Reset'}
                      </Button>
                      {status === 'valid' && (
                        <Button 
                          className={`flex-1 text-white font-extrabold rounded-xl h-11 shadow-md transition-transform active:scale-95 ${
                            isEarly 
                              ? 'bg-amber-600 hover:bg-amber-700' 
                              : 'bg-emerald-600 hover:bg-emerald-700'
                          }`} 
                          onClick={handleSerahkan} 
                          disabled={submitting}
                        >
                          {submitting ? 'Memproses...' : 'Serahkan KTM'}
                        </Button>
                      )}
                    </div>
                    {status === 'used' && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium animate-pulse">
                        Mengatur ulang scanner otomatis dalam 1.5 detik...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
