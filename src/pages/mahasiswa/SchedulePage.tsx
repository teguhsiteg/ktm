import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Jadwal, Mahasiswa, Booking } from '@/types';
import { format, parseISO } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { generateBookingId, isBookingExpired } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export default function SchedulePage() {
  const { id } = useParams(); // mahasiswa_id
  const navigate = useNavigate();
  const location = useLocation();
  const wa = location.state?.wa || '';

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
          } else if (activeBooking) {
            navigate(`/ticket/${activeBooking.booking_id}`, { replace: true });
            return;
          } else if (expiredBooking && !isReapply) {
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
        const jDoc = await transaction.get(jRef);
        if (!jDoc.exists()) throw new Error('Jadwal tidak ditemukan');
        
        const currentData = jDoc.data() as Jadwal;
        const currentBooked = currentData.booked_count || 0;
        
        if (currentBooked >= currentData.kuota) {
          throw new Error('Jadwal penuh');
        }

        // Add to booked count
        transaction.update(jRef, { booked_count: currentBooked + 1 });
        
        // Create booking
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
      });

      toast.success('Booking berhasil!');
      navigate(`/ticket/${newBookingId}`);

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
    return <div className="min-h-screen flex items-center justify-center">Memuat jadwal...</div>;
  }

  return (
    <div className="min-h-screen p-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-background flex flex-col items-center pb-24 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[5%] left-[5%] w-[30%] h-[30%] rounded-full bg-brand/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-5%] w-[40%] h-[40%] rounded-full bg-brand-light/5 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl pt-8 z-10"
      >
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Jadwal <span className="text-brand">Pengambilan</span></h2>
          <p className="text-slate-500 dark:text-slate-400">Pilih sesi waktu yang sesuai untuk mengambil KTM Anda.</p>
        </div>
        
        {Object.keys(groupedJadwal).length === 0 ? (
          <Card className="glass-card border-0">
            <CardContent className="p-16 text-center text-slate-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Belum ada jadwal yang tersedia saat ini.
            </CardContent>
          </Card>
        ) : (
          Object.keys(groupedJadwal).map((date, index) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.2, duration: 0.5 }}
              key={date} 
              className="mb-10"
            >
              <div className="flex items-center gap-4 mb-5">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-lg">
                  {format(parseISO(date), 'EEEE, dd MMMM yyyy', { locale: localeID })}
                </h3>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {groupedJadwal[date].map(j => {
                  const booked = j.booked_count || 0;
                  const isFull = booked >= j.kuota;
                  const isSelected = selectedJadwal?.id === j.id;
                  const sisa = j.kuota - booked;
                  
                  return (
                    <motion.div 
                      whileHover={!isFull ? { scale: 1.03, y: -2 } : {}}
                      whileTap={!isFull ? { scale: 0.97 } : {}}
                      key={j.id}
                      onClick={() => !isFull && setSelectedJadwal(j)}
                      className={`
                        relative p-4 rounded-2xl transition-all cursor-pointer text-center overflow-hidden
                        ${isFull ? 'bg-slate-100 dark:bg-slate-800/50 border-transparent text-slate-400 cursor-not-allowed' : 
                          isSelected ? 'bg-brand text-white shadow-lg shadow-brand/30 border-transparent ring-2 ring-brand ring-offset-2 dark:ring-offset-background' : 
                          'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand/50 hover:shadow-md text-slate-700 dark:text-slate-300'}
                      `}
                    >
                      <div className={`text-lg font-bold mb-1 ${isFull ? 'text-slate-400 dark:text-slate-500' : isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {j.jam_mulai} <span className="text-sm font-normal opacity-70">- {j.jam_selesai}</span>
                      </div>
                      <div className={`text-xs font-medium px-2 py-1 rounded-full inline-block ${
                        isFull ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400' : 
                        isSelected ? 'bg-white/20 text-white' : 
                        sisa <= 5 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {isFull ? 'Penuh' : `Sisa ${sisa} slot`}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))
        )}

        <AnimatePresence>
        {selectedJadwal && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-40 flex justify-center"
          >
            <div className="w-full max-w-3xl flex justify-between items-center gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">Jadwal Terpilih</p>
                <p className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                  {format(parseISO(selectedJadwal.tanggal), 'dd MMM yyyy', { locale: localeID })}, <span className="text-brand">{selectedJadwal.jam_mulai}</span>
                </p>
              </div>
              <Button onClick={() => setShowConfirm(true)} className="bg-brand hover:bg-brand-dark text-white shadow-lg shadow-brand/20 rounded-xl px-6 h-12 font-medium">
                Konfirmasi Jadwal
              </Button>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
      {showConfirm && selectedJadwal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !bookingLoading && setShowConfirm(false)}
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-sm z-10"
          >
            <Card className="glass-card border-0 shadow-2xl overflow-hidden">
              <div className="h-1.5 w-full bg-brand"></div>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Konfirmasi Tiket</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mb-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Nama</span> 
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-right">{mahasiswa?.nama}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">NIM</span> 
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{mahasiswa?.nim}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Tanggal</span> 
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{format(parseISO(selectedJadwal.tanggal), 'dd MMM yyyy', { locale: localeID })}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Jam</span> 
                    <span className="font-semibold text-brand">{selectedJadwal.jam_mulai} - {selectedJadwal.jam_selesai}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Nomor WA</span> 
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{wa}</span>
                  </div>
                </div>
                <p className="text-center font-medium text-sm text-slate-600 dark:text-slate-300 mb-6">Pastikan data di atas sudah benar.</p>
                <div className="flex space-x-3">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowConfirm(false)} disabled={bookingLoading}>Batal</Button>
                  <Button className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white" onClick={handleBooking} disabled={bookingLoading}>
                    {bookingLoading ? 'Memproses...' : 'Ya, Konfirmasi'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}
