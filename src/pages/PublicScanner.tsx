import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Booking, Mahasiswa } from '@/types';
import { CheckCircle2, XCircle, Scan, AlertCircle } from 'lucide-react';
import { isBookingNotStartedYet, isBookingExpired } from '@/lib/utils';
import { toast } from 'sonner';

export default function PublicScannerPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [mahasiswa, setMahasiswa] = useState<Mahasiswa | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'valid' | 'used' | 'invalid' | 'expired'>('idle');
  const [isEarly, setIsEarly] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

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
      let mData: Mahasiswa | null = null;
      if (mDoc.exists()) {
        mData = mDoc.data() as Mahasiswa;
        setMahasiswa(mData);
      }

      const expired = b.status === 'Hangus' || isBookingExpired(b.tanggal, b.jam);
      
      if (expired && b.status !== 'Hangus') {
        try {
          await updateDoc(doc(db, 'booking', b.id), { status: 'Hangus' });
          b.status = 'Hangus';
        } catch (err) {
          console.error('Failed to auto-update expired booking status on public scan:', err);
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
          toast.warning(`Peringatan: Jadwal pengambilan belum dimulai! Sesi Anda adalah pukul ${b.jam}.`, { duration: 6000 });
        } else {
          playBeep('success');
        }

        // Add to live_scans queue for real-time monitoring on admin PC
        if (mData) {
          const activeQueueQ = query(
            collection(db, 'live_scans'), 
            where('booking_id', '==', b.id),
            where('status', '==', 'pending')
          );
          const activeQueueSnap = await getDocs(activeQueueQ);
          
          if (activeQueueSnap.empty) {
            await addDoc(collection(db, 'live_scans'), {
              booking_id: b.id,
              mahasiswa_id: b.mahasiswa_id,
              nim: mData.nim,
              nama: mData.nama,
              prodi: mData.prodi,
              scanned_at: serverTimestamp(),
              status: 'pending',
              is_early: early
            });
          }
        }
      }
    } catch (e) {
      console.error(e);
      setStatus('invalid');
      setIsEarly(false);
      playBeep('error');
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setBooking(null);
    setMahasiswa(null);
    setStatus('idle');
    setIsEarly(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#121212] flex flex-col items-center justify-center p-6">
      
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-[#005BAC] dark:text-[#8AB4F8] mb-2">Scanner Publik KTM</h1>
          <p className="text-gray-500 dark:text-gray-400">Pindai tiket Anda di sini untuk memeriksa status.</p>
        </div>

        <Card className="bg-white dark:bg-[#1E1E1E] dark:border-gray-800 shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
            <CardTitle className="text-lg flex items-center justify-center">
              <Scan className="w-5 h-5 mr-2 text-[#005BAC] dark:text-[#8AB4F8]" /> 
              QR Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex justify-center">
            <div className="w-full max-w-[400px] overflow-hidden rounded-xl border-2 border-gray-100 dark:border-gray-800">
              <div id="qr-reader" className="w-full"></div>
            </div>
          </CardContent>
        </Card>

        <Card className={`transition-colors duration-300 border shadow-sm ${
          status === 'valid' && isEarly ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20' :
          status === 'valid' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' :
          status === 'used' ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20' :
          status === 'expired' ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20' :
          status === 'invalid' ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20' :
          'border-gray-200 bg-white dark:bg-[#1E1E1E] dark:border-gray-800'
        }`}>
          <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
            {status === 'idle' && (
              <div className="text-gray-400 dark:text-gray-500 flex flex-col items-center">
                <Scan className="w-16 h-16 mb-4 opacity-50 text-gray-400 dark:text-gray-500" />
                <p className="text-lg">Arahkan kamera ke QR Code Tiket Anda</p>
              </div>
            )}

            {status === 'loading' && (
              <div className="text-[#005BAC] dark:text-[#8AB4F8] font-medium text-lg">Memeriksa QR Code...</div>
            )}

            {status === 'invalid' && (
              <div className="text-red-600 dark:text-red-400 flex flex-col items-center w-full">
                <XCircle className="w-16 h-16 mb-4" />
                <h3 className="text-2xl font-bold mb-2">QR Tidak Dikenal</h3>
                <p className="text-base text-red-500 dark:text-red-400">Pastikan QR Code berasal dari tiket yang valid.</p>
                <Button variant="outline" className="mt-8 w-full max-w-[200px]" onClick={resetScanner}>Scan Ulang</Button>
              </div>
            )}

            {(status === 'valid' || status === 'used' || status === 'expired') && booking && mahasiswa && (
              <div className="w-full max-w-[400px] flex flex-col justify-between items-center mx-auto">
                <div className="w-full">
                  <div className={`inline-flex items-center justify-center p-4 rounded-full mb-6 ${
                    status === 'valid' && isEarly ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' :
                    status === 'valid' ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 
                    status === 'expired' ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400' :
                    'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                  }`}>
                    {status === 'valid' && isEarly ? <AlertCircle className="w-10 h-10" /> :
                     status === 'valid' ? <CheckCircle2 className="w-10 h-10" /> : 
                     status === 'expired' ? <XCircle className="w-10 h-10" /> :
                     <AlertCircle className="w-10 h-10" />}
                  </div>
                  
                  <h3 className={`text-2xl font-bold mb-2 ${
                    status === 'valid' && isEarly ? 'text-amber-700 dark:text-amber-400' :
                    status === 'valid' ? 'text-emerald-700 dark:text-emerald-400' : 
                    status === 'expired' ? 'text-red-700 dark:text-red-400' :
                    'text-amber-700 dark:text-amber-400'
                  }`}>
                    {status === 'valid' && isEarly ? 'Tiket Valid (Belum Waktunya)' :
                     status === 'valid' ? 'Tiket Valid' : 
                     status === 'expired' ? 'Tiket Hangus / Expired' :
                     'Tiket Sudah Digunakan'}
                  </h3>
                  
                  {status === 'valid' && (
                    isEarly ? (
                      <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3 text-left text-amber-800 dark:text-amber-300 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div>
                          <p className="font-bold text-sm">Peringatan: Belum Waktunya!</p>
                          <p className="text-xs mt-0.5 leading-relaxed text-amber-700 dark:text-amber-400">
                            Jadwal pengambilan tiket Anda belum dimulai. Sesi terdaftar: <strong>{booking.tanggal} ({booking.jam})</strong>. Silakan kembali pada jam tersebut.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Silakan menuju ke petugas untuk mengambil KTM Anda.</p>
                    )
                  )}

                  {status === 'expired' && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 text-left text-red-800 dark:text-red-300 animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                      <div>
                        <p className="font-bold text-sm">Gagal: Tiket Hangus!</p>
                        <p className="text-xs mt-0.5 leading-relaxed text-red-700 dark:text-red-400">
                          Jadwal pengambilan tiket Anda sudah berakhir pada <strong>{booking.tanggal} ({booking.jam})</strong>. Silakan lakukan pengajuan ulang jadwal pengambilan baru di halaman pencarian.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-white dark:bg-[#2A2A2A] rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-left mt-4 space-y-4 shadow-sm w-full">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Nama</p>
                      <p className="font-bold text-lg text-gray-900 dark:text-gray-100">{mahasiswa.nama}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">NIM</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{mahasiswa.nim}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Prodi</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{mahasiswa.prodi}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 w-full max-w-[200px]">
                  <Button variant="outline" className="w-full bg-white dark:bg-[#2A2A2A] text-gray-700 dark:text-gray-300" onClick={resetScanner}>
                    Scan Ulang
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
