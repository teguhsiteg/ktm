import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp, deleteDoc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Booking, Mahasiswa } from '@/types';
import { format, parseISO } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { CheckCircle2, XCircle, Scan, AlertCircle, RotateCcw, Trash2, Clock, Check, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { isBookingNotStartedYet, isBookingExpired } from '@/lib/utils';

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
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const prevQueueLengthRef = useRef(0);

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

  useEffect(() => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: {width: 200, height: 200}, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] },
        false
      );
      
      scannerRef.current.render(onScanSuccess, onScanFailure);
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
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

  const resetScanner = () => {
    setScanResult(null);
    setBooking(null);
    setMahasiswa(null);
    setStatus('idle');
    setIsEarly(false);
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
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      
      {/* Left Column: Scanner & Result (Compact) */}
      <div className="w-full lg:w-[45%] flex flex-col gap-6">
        <Card className="bg-white dark:bg-[#1E1E1E] dark:border-gray-800 shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
            <CardTitle className="text-lg flex items-center">
              <Scan className="w-5 h-5 mr-2 text-[#005BAC] dark:text-[#8AB4F8]" /> 
              QR Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex justify-center">
            <div className="w-full max-w-[300px] overflow-hidden rounded-xl border-2 border-gray-100 dark:border-gray-800">
              <div id="qr-reader" className="w-full"></div>
            </div>
          </CardContent>
        </Card>

        <Card className={`flex-1 transition-colors duration-300 border shadow-sm ${
          status === 'valid' && isEarly ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20' :
          status === 'valid' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' :
          status === 'used' ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20' :
          status === 'expired' ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20' :
          status === 'invalid' ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20' :
          'border-gray-200 bg-white dark:bg-[#1E1E1E] dark:border-gray-800'
        }`}>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center min-h-[300px]">
            {status === 'idle' && (
              <div className="text-gray-400 dark:text-gray-500 flex flex-col items-center">
                <Scan className="w-12 h-12 mb-3 opacity-50 text-gray-400 dark:text-gray-500" />
                <p className="text-sm">Arahkan kamera ke QR Code Tiket</p>
              </div>
            )}

            {status === 'loading' && (
              <div className="text-[#005BAC] dark:text-[#8AB4F8] font-medium">Memeriksa QR Code...</div>
            )}

            {status === 'invalid' && (
              <div className="text-red-600 dark:text-red-400 flex flex-col items-center w-full">
                <XCircle className="w-12 h-12 mb-3" />
                <h3 className="text-lg font-bold mb-1">QR Tidak Dikenal</h3>
                <p className="text-sm text-red-500 dark:text-red-400">Pastikan QR dari tiket yang benar.</p>
                <Button variant="outline" size="sm" className="mt-6 w-full" onClick={resetScanner}>Scan Ulang</Button>
              </div>
            )}

            {(status === 'valid' || status === 'used' || status === 'expired') && booking && mahasiswa && (
              <div className="w-full flex flex-col h-full justify-between items-center">
                <div className="w-full">
                  <div className={`inline-flex items-center justify-center p-3 rounded-full mb-4 ${
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
                  
                  <h3 className={`text-xl font-bold mb-1 ${
                    status === 'valid' && isEarly ? 'text-amber-700 dark:text-amber-400' :
                    status === 'valid' ? 'text-emerald-700 dark:text-emerald-400' : 
                    status === 'expired' ? 'text-red-700 dark:text-red-400' :
                    'text-amber-700 dark:text-amber-400'
                  }`}>
                    {status === 'valid' && isEarly ? 'Tiket Valid (Belum Waktunya)' :
                     status === 'valid' ? 'Tiket Valid' : 
                     status === 'expired' ? 'Tiket Hangus / Expired' :
                     'Sudah Digunakan'}
                  </h3>

                  {status === 'valid' && isEarly && (
                    <div className="mb-4 mt-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-left text-amber-800 dark:text-amber-300">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="font-bold text-sm">Peringatan: Belum Waktunya!</p>
                        <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-400">
                          Jadwal pengambilan tiket ini belum masuk waktunya. Sesi terdaftar: <strong>{booking.tanggal} ({booking.jam})</strong>.
                        </p>
                      </div>
                    </div>
                  )}

                  {status === 'expired' && (
                    <div className="mb-4 mt-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-left text-red-800 dark:text-red-300 animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                      <div>
                        <p className="font-bold text-sm">Gagal: Tiket Hangus!</p>
                        <p className="text-xs mt-0.5 text-red-700 dark:text-red-400">
                          Jadwal pengambilan tiket ini sudah berakhir pada <strong>{booking.tanggal} ({booking.jam})</strong>. Mahasiswa harus melakukan pengajuan ulang jadwal pengambilan.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-white dark:bg-[#2A2A2A] rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-left mt-4 space-y-2 shadow-sm text-sm w-full">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Nama</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{mahasiswa.nama}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">NIM</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{mahasiswa.nim}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Prodi</p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{mahasiswa.prodi}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 w-full space-y-2">
                  {status === 'valid' && (
                    <Button 
                      className={`w-full text-white shadow-sm ${
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
                  <Button variant="outline" size="sm" className="w-full bg-white dark:bg-[#2A2A2A] text-gray-700 dark:text-gray-300" onClick={resetScanner}>
                    Reset Scanner
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Live Queue & History */}
      <div className="w-full lg:w-[55%] flex flex-col h-full">
        <Card className="flex-1 bg-white dark:bg-[#1E1E1E] dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 py-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button 
                  variant={activeTab === 'queue' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setActiveTab('queue')}
                  className="rounded-full text-xs"
                >
                  <Clock className="w-4 h-4 mr-1.5" />
                  Antrean Scan Publik ({liveQueue.length})
                </Button>
                <Button 
                  variant={activeTab === 'history' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setActiveTab('history')}
                  className="rounded-full text-xs"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  Riwayat ({recentLogs.length})
                </Button>
              </div>
              
              {activeTab === 'queue' && liveQueue.length > 0 && (
                <span className="animate-pulse bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold py-0.5 px-2.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  LIVE
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {activeTab === 'queue' ? (
              liveQueue.length === 0 ? (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400">
                  <Scan className="w-12 h-12 mb-3 opacity-20" />
                  <p className="font-medium text-sm">Belum ada antrean scan aktif.</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs">Mahasiswa dapat memindai tiket mereka di PC 1 / halaman Scanner Publik.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {liveQueue.map((item) => (
                    <li key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors flex items-center justify-between group">
                      <div className="flex items-start gap-3">
                        <div className="bg-[#E8F0FE] dark:bg-[#1A2E4C] p-2 rounded-full text-[#005BAC] dark:text-[#8AB4F8] mt-0.5">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                            {item.nama}
                            {item.is_early && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 ml-2 animate-pulse">
                                Belum Waktunya
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">NIM: {item.nim} • {item.prodi}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                            Menunggu sejak: {item.scanned_at ? format(item.scanned_at.toDate ? item.scanned_at.toDate() : new Date(item.scanned_at), 'HH:mm:ss') : 'Baru saja'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleDismissQueue(item)}
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-8 px-2 text-xs"
                        >
                          Lewati
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleSerahkanQueue(item)}
                          className="bg-[#005BAC] hover:bg-[#004B8C] dark:bg-[#1A73E8] dark:hover:bg-[#1557B0] text-white h-8 px-3 rounded-lg flex items-center gap-1 font-medium text-xs"
                          disabled={submitting}
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          Serahkan KTM
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              recentLogs.length === 0 ? (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400">
                  <CheckCircle2 className="w-12 h-12 mb-3 opacity-20" />
                  <p className="font-medium text-sm">Belum ada data KTM yang diserahkan pada sesi ini.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {recentLogs.map((log) => (
                    <li key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors flex items-center justify-between group">
                      <div className="flex items-start gap-3">
                        <div className="bg-emerald-100 dark:bg-emerald-950/40 p-2 rounded-full text-emerald-600 dark:text-emerald-400 mt-0.5">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{log.nama}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{log.nim}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">
                            {format(log.waktu instanceof Date ? log.waktu : new Date(), 'HH:mm:ss')}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleUndo(log)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:text-red-400 h-8 px-2 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                        title="Batalkan Penyerahan"
                      >
                        <RotateCcw className="w-4 h-4 mr-1.5" />
                        <span className="text-xs">Batal</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
