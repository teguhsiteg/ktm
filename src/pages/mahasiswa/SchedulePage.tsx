import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Jadwal, Mahasiswa, Booking } from '@/types';
import { format, parseISO } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { generateBookingId, isBookingExpired } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, User, ArrowLeft, Check, CheckCircle2, AlertCircle, Info, ChevronRight, RefreshCw, Sparkles, Phone, ShieldCheck } from 'lucide-react';

export default function SchedulePage() {
  const { id } = useParams(); // mahasiswa_id
  const navigate = useNavigate();
  const location = useLocation();
  const wa = location.state?.wa || '';
  const isReschedule = location.state?.reschedule || false;
  const oldBookingId = location.state?.oldBookingId || '';
  const oldJadwalId = location.state?.oldJadwalId || '';
  const oldBookingCode = location.state?.oldBookingCode || '';

  const [mahasiswa, setMahasiswa] = useState<Mahasiswa | null>(null);
  const [jadwal, setJadwal] = useState<Jadwal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJadwal, setSelectedJadwal] = useState<Jadwal | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      navigate('/');
      return;
    }

    if (!wa) {
      toast.error('Harap masukkan nomor WhatsApp terlebih dahulu di halaman pencarian');
      navigate('/');
      return;
    }

    const isReapply = location.state?.reapply || false;

    const fetchData = async () => {
      try {
        // Check if student already booked
        const bookingQ = query(collection(db, 'booking'), where('mahasiswa_id', '==', id));
        const bookingSnap = await getDocs(bookingQ);
        if (!bookingSnap.empty) {
          const mbs = bookingSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
          
          const activeBooking = mbs.find(b => b.status === 'Belum Diambil' && !isBookingExpired(b.tanggal, b.jam));
          const takenBooking = mbs.find(b => b.status === 'Sudah Diambil');
          const expiredBooking = mbs.find(b => b.status === 'Hangus' || (b.status === 'Belum Diambil' && isBookingExpired(b.tanggal, b.jam)));
          
          if (takenBooking) {
            navigate(`/ticket/${takenBooking.booking_id}`, { replace: true });
            return;
          } else if (activeBooking && !isReschedule) {
            navigate(`/ticket/${activeBooking.booking_id}`, { replace: true });
            return;
          } else if (expiredBooking && !isReapply && !isReschedule) {
            // Update expired bookings to 'Hangus' in Firestore if it wasn't already
            if (expiredBooking.status !== 'Hangus') {
              await updateDoc(doc(db, 'booking', expiredBooking.id), {
                status: 'Hangus',
                updated_at: serverTimestamp()
              });
            }
            navigate(`/ticket/${expiredBooking.booking_id}`, { replace: true });
            return;
          } else {
            // If they are reapplying, ensure we clean/update old expired bookings in DB to 'Hangus'
            for (const b of mbs) {
              if (b.status === 'Belum Diambil' && isBookingExpired(b.tanggal, b.jam)) {
                await updateDoc(doc(db, 'booking', b.id), {
                  status: 'Hangus',
                  updated_at: serverTimestamp()
                });
              }
            }
          }
        }

        const mhsDoc = await getDoc(doc(db, 'mahasiswa', id));
        if (mhsDoc.exists()) {
          setMahasiswa({ id: mhsDoc.id, ...mhsDoc.data() } as Mahasiswa);
        } else {
          toast.error('Data mahasiswa tidak ditemukan');
          navigate('/');
          return;
        }

        // Fetch active schedules
        const jQ = query(collection(db, 'jadwal'), where('status', '==', 'Aktif'));
        const jSnap = await getDocs(jQ);
        const jList = jSnap.docs.map(d => ({ id: d.id, ...d.data() } as Jadwal));
        
        // Sort schedules
        jList.sort((a, b) => {
          if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
          return a.jam_mulai.localeCompare(b.jam_mulai);
        });
        
        setJadwal(jList);
      } catch (err) {
        console.error(err);
        toast.error('Gagal memuat jadwal');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  const handleBooking = async () => {
    if (!selectedJadwal || !mahasiswa) return;
    setBookingLoading(true);
    
    try {
      const jRef = doc(db, 'jadwal', selectedJadwal.id);
      const newBookingId = generateBookingId();

      await runTransaction(db, async (transaction) => {
        // Prepare document references
        const oldJRef = (isReschedule && oldJadwalId) ? doc(db, 'jadwal', oldJadwalId) : null;
        
        // 1. PERFORM ALL READS FIRST
        let oldJDoc = null;
        if (oldJRef) {
          oldJDoc = await transaction.get(oldJRef);
        }
        
        const jDoc = await transaction.get(jRef);
        
        // 2. RUN VALIDATIONS & COMPUTE NEW STATES
        if (!jDoc.exists()) throw new Error('Jadwal tidak ditemukan');
        const currentData = jDoc.data() as Jadwal;
        const currentBooked = currentData.booked_count || 0;
        
        if (currentBooked >= currentData.kuota) {
          throw new Error('Jadwal penuh');
        }

        let oldBooked = 0;
        let oldJDocExists = false;
        if (oldJDoc && oldJDoc.exists()) {
          oldJDocExists = true;
          const oldData = oldJDoc.data() as Jadwal;
          oldBooked = oldData.booked_count || 0;
        }

        // 3. PERFORM ALL WRITES LAST
        if (oldJRef && oldJDocExists) {
          transaction.update(oldJRef, { booked_count: Math.max(0, oldBooked - 1) });
        }

        // Add to booked count of the new schedule
        transaction.update(jRef, { booked_count: currentBooked + 1 });
        
        if (isReschedule && oldBookingId) {
          // Update the existing booking document
          const bookingRef = doc(db, 'booking', oldBookingId);
          transaction.update(bookingRef, {
            jadwal_id: selectedJadwal.id,
            tanggal: selectedJadwal.tanggal,
            jam: `${selectedJadwal.jam_mulai}-${selectedJadwal.jam_selesai}`,
            updated_at: serverTimestamp()
          });
        } else {
          // Create new booking
          const newBookingRef = doc(collection(db, 'booking'));
          transaction.set(newBookingRef, {
            booking_id: newBookingId,
            mahasiswa_id: mahasiswa.id,
            jadwal_id: selectedJadwal.id,
            tanggal: selectedJadwal.tanggal,
            jam: `${selectedJadwal.jam_mulai}-${selectedJadwal.jam_selesai}`,
            wa: wa,
            status: 'Belum Diambil',
            qr_token: newBookingId, // For simplicity using booking ID as token
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
          });
        }
      });

      toast.success(isReschedule ? 'Jadwal berhasil diubah!' : 'Booking berhasil!');
      navigate(`/ticket/${isReschedule ? oldBookingCode : newBookingId}`);

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal melakukan booking');
    } finally {
      setBookingLoading(false);
      setShowConfirm(false);
    }
  };

  // Group schedules by date
  const groupedJadwal = jadwal.reduce((acc, curr) => {
    if (!acc[curr.tanggal]) acc[curr.tanggal] = [];
    acc[curr.tanggal].push(curr);
    return acc;
  }, {} as Record<string, Jadwal[]>);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#121212]">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-100 dark:border-slate-800 border-t-[#005BAC] rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">Memuat jadwal yang tersedia...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#121212] pb-32">
      {/* Background patterns */}
      <div className="absolute top-0 left-0 w-full h-[320px] bg-gradient-to-b from-blue-50/60 to-transparent dark:from-[#005BAC]/5 pointer-events-none" />
      
      <div className="w-full max-w-2xl mx-auto px-4 pt-6">
        
        {/* Navigation back and title */}
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            asChild
            className="rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-gray-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Link to={isReschedule ? `/ticket/${oldBookingCode}` : '/'}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <span className="text-[10px] tracking-wider uppercase font-bold text-[#005BAC] dark:text-blue-400">
              Langkah 2 dari 3
            </span>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {isReschedule ? 'Ubah Jadwal Pengambilan' : 'Pilih Jadwal Pengambilan'}
            </h1>
          </div>
        </div>

        {/* Stepper progress indicator */}
        <div className="w-full bg-white dark:bg-[#1E1E1E] rounded-2xl p-4 mb-6 border border-slate-200/60 dark:border-slate-800/80 shadow-sm flex items-center justify-between text-xs font-semibold text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>1. Verifikasi</span>
          </div>
          <div className="w-8 h-[2px] bg-emerald-100 dark:bg-emerald-950/40 flex-1 mx-2" />
          <div className="flex items-center gap-1.5 text-[#005BAC] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-lg">
            <Calendar className="w-4 h-4 animate-pulse" />
            <span>2. Pilih Jadwal</span>
          </div>
          <div className="w-8 h-[2px] bg-slate-100 dark:bg-slate-800 flex-1 mx-2" />
          <div className="flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>3. Dapat Tiket</span>
          </div>
        </div>

        {/* Student Profile Card */}
        {mahasiswa && (
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm p-5 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-[#005BAC] dark:text-blue-400 border border-blue-100/60 dark:border-blue-950">
                <User className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">Mahasiswa Pemohon</div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate mt-0.5">{mahasiswa.nama}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-mono">{mahasiswa.nim}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span>{mahasiswa.prodi}</span>
                </div>
              </div>
            </div>
            
            {/* Reschedule Warning Alert */}
            {isReschedule && (
              <div className="mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-950/80 rounded-xl flex gap-2.5 items-start">
                <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-spin" style={{ animationDuration: '4s' }} />
                <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                  <span className="font-bold">Mode Mengubah Jadwal:</span> Jadwal lama Anda ({oldBookingCode}) akan dipindahkan ke slot yang Anda pilih di bawah ini secara otomatis setelah konfirmasi.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Schedules list container */}
        <div className="space-y-6">
          {Object.keys(groupedJadwal).length === 0 ? (
            <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-950/20 rounded-full flex items-center justify-center text-red-500 dark:text-red-400 mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Belum Ada Jadwal Aktif</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                Admin belum mempublikasikan jadwal pengambilan KTM baru. Silakan cek berkala beberapa saat lagi.
              </p>
            </div>
          ) : (
            Object.keys(groupedJadwal).map((date, idx) => {
              const parsedDate = parseISO(date);
              const isToday = format(new Date(), 'yyyy-MM-dd') === date;

              return (
                <motion.div 
                  key={date} 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm overflow-hidden"
                >
                  {/* Sticky styled group date header */}
                  <div className="bg-slate-50/80 dark:bg-slate-900/40 backdrop-blur-sm px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/60 flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-[#005BAC] dark:text-blue-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
                        {format(parsedDate, 'EEEE, dd MMMM yyyy', { locale: localeID })}
                      </span>
                    </div>
                    {isToday && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#005BAC]/10 dark:bg-blue-950/50 text-[#005BAC] dark:text-blue-400 uppercase tracking-wider">
                        Hari Ini
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {groupedJadwal[date].map(j => {
                        const booked = j.booked_count || 0;
                        const sisa = Math.max(0, j.kuota - booked);
                        const isFull = sisa <= 0;
                        const isSelected = selectedJadwal?.id === j.id;
                        
                        // Remaining ratio
                        const ratio = sisa / j.kuota;
                        const isLow = sisa > 0 && sisa <= 3;

                        return (
                          <div 
                            key={j.id}
                            onClick={() => !isFull && setSelectedJadwal(j)}
                            className={`
                              relative p-4 rounded-xl border-2 transition-all duration-200 select-none group flex flex-col justify-between h-24
                              ${isFull 
                                ? 'bg-slate-50 dark:bg-slate-950/20 border-slate-100 dark:border-slate-900 cursor-not-allowed opacity-50' 
                                : isSelected 
                                  ? 'border-[#005BAC] bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-[#005BAC]/10 cursor-pointer' 
                                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E1E1E] hover:border-[#005BAC]/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer'}
                            `}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-1.5">
                                <Clock className={`w-4 h-4 ${isSelected ? 'text-[#005BAC] dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />
                                <span className={`font-bold text-sm ${isSelected ? 'text-[#005BAC] dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                  {j.jam_mulai} - {j.jam_selesai}
                                </span>
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-[#005BAC] text-white flex items-center justify-center shadow-sm">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              )}
                            </div>

                            <div className="mt-2 w-full">
                              {/* Seat Capacity Status */}
                              <div className="flex justify-between items-center mb-1 text-[11px] font-medium">
                                <span className="text-gray-400 dark:text-gray-500">Kapasitas Sesi</span>
                                <span className={`font-semibold ${
                                  isFull ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-emerald-500'
                                }`}>
                                  {isFull ? 'Sesi Penuh' : `Sisa ${sisa} Kuota`}
                                </span>
                              </div>
                              
                              {/* Custom miniature progress bar */}
                              <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isFull ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`} 
                                  style={{ width: `${ratio * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Bottom Floating Action Bar */}
        <AnimatePresence>
          {selectedJadwal && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-4 left-4 right-4 md:left-1/2 md:right-auto md:w-[672px] md:-translate-x-1/2 p-4 bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl z-30 flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-[#005BAC] dark:text-blue-400 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-extrabold">Jadwal yang Anda Pilih</p>
                  <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 truncate mt-0.5">
                    {format(parseISO(selectedJadwal.tanggal), 'EEEE, dd MMM yyyy', { locale: localeID })}
                  </p>
                  <p className="text-[11px] font-medium text-[#005BAC] dark:text-blue-400">
                    Sesi Jam {selectedJadwal.jam_mulai} - {selectedJadwal.jam_selesai} WIB
                  </p>
                </div>
              </div>

              <Button 
                onClick={() => setShowConfirm(true)}
                className="bg-[#005BAC] hover:bg-[#004B8C] text-white font-bold h-11 px-5 rounded-xl shadow-md flex items-center gap-1 shrink-0 transition-all duration-150 active:scale-95"
              >
                <span>Lanjutkan</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirmation Backdrop & Dialog */}
      <AnimatePresence>
        {showConfirm && selectedJadwal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-white dark:bg-[#1E1E1E] rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden relative"
            >
              {/* UII Brand Accent Ribbon */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#005BAC]" />

              <div className="flex items-center gap-3 mb-5 mt-1">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-[#005BAC] dark:text-blue-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 dark:text-gray-100 text-lg">Konfirmasi Jadwal</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Periksa kembali detail pemesanan Anda</p>
                </div>
              </div>

              <div className="space-y-3 mb-6 bg-slate-50 dark:bg-slate-950/40 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-900/60 text-xs text-gray-700 dark:text-gray-300">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-900 pb-2">
                  <span className="text-gray-400 dark:text-gray-500 font-medium">MAHASISWA</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 text-right">{mahasiswa?.nama}</span>
                </div>
                
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-900 pb-2">
                  <span className="text-gray-400 dark:text-gray-500 font-medium">NIM</span>
                  <span className="font-bold text-gray-950 dark:text-gray-50 text-right font-mono">{mahasiswa?.nim}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-900 pb-2">
                  <span className="text-gray-400 dark:text-gray-500 font-medium">PROGRAM STUDI</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 text-right">{mahasiswa?.prodi}</span>
                </div>

                <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-900 pb-2">
                  <span className="text-gray-400 dark:text-gray-500 font-medium">TANGGAL</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 text-right">
                    {format(parseISO(selectedJadwal.tanggal), 'EEEE, dd MMMM yyyy', { locale: localeID })}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-900 pb-2">
                  <span className="text-gray-400 dark:text-gray-500 font-medium">SESI JAM</span>
                  <span className="font-bold text-[#005BAC] dark:text-blue-400 text-right">{selectedJadwal.jam_mulai} - {selectedJadwal.jam_selesai} WIB</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400 dark:text-gray-500 font-medium">WHATSAPP</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 text-right flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{wa}</span>
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-950 rounded-xl mb-6 flex gap-2.5 items-start">
                <Info className="w-4 h-4 text-[#005BAC] dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[10.5px] text-blue-900 dark:text-blue-300 leading-relaxed font-medium">
                  Harap hadir tepat waktu sesuai sesi yang dipilih dan membawa identitas pendukung (KTM lama, KTP, atau KRS aktif).
                </p>
              </div>

              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl h-11 border-slate-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 font-semibold" 
                  onClick={() => setShowConfirm(false)} 
                  disabled={bookingLoading}
                >
                  Batal
                </Button>
                <Button 
                  className="flex-1 rounded-xl h-11 bg-[#005BAC] hover:bg-[#004B8C] text-white font-bold shadow-md active:scale-95 transition-all" 
                  onClick={handleBooking} 
                  disabled={bookingLoading}
                >
                  {bookingLoading ? 'Memproses...' : 'Ya, Konfirmasi'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

