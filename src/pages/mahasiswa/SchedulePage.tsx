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
        // If rescheduling, decrement old schedule's booked_count
        if (isReschedule && oldJadwalId) {
          const oldJRef = doc(db, 'jadwal', oldJadwalId);
          const oldJDoc = await transaction.get(oldJRef);
          if (oldJDoc.exists()) {
            const oldData = oldJDoc.data() as Jadwal;
            const oldBooked = oldData.booked_count || 0;
            transaction.update(oldJRef, { booked_count: Math.max(0, oldBooked - 1) });
          }
        }

        const jDoc = await transaction.get(jRef);
        if (!jDoc.exists()) throw new Error('Jadwal tidak ditemukan');
        
        const currentData = jDoc.data() as Jadwal;
        const currentBooked = currentData.booked_count || 0;
        
        if (currentBooked >= currentData.kuota) {
          throw new Error('Jadwal penuh');
        }

        // Add to booked count
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
    return <div className="min-h-screen flex items-center justify-center">Memuat jadwal...</div>;
  }

  return (
    <div className="min-h-screen p-4 bg-gray-50 flex justify-center">
      <div className="w-full max-w-2xl pt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Pilih Jadwal Pengambilan</h2>
        
        {Object.keys(groupedJadwal).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-gray-500">
              Belum ada jadwal yang tersedia saat ini.
            </CardContent>
          </Card>
        ) : (
          Object.keys(groupedJadwal).map(date => (
            <div key={date} className="mb-8">
              <h3 className="font-medium text-gray-700 mb-3 sticky top-0 bg-gray-50 py-2 z-10">
                {format(parseISO(date), 'EEEE, dd MMMM yyyy', { locale: localeID })}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {groupedJadwal[date].map(j => {
                  const booked = j.booked_count || 0;
                  const isFull = booked >= j.kuota;
                  const isSelected = selectedJadwal?.id === j.id;
                  
                  return (
                    <div 
                      key={j.id}
                      onClick={() => !isFull && setSelectedJadwal(j)}
                      className={`
                        relative p-4 rounded-xl border-2 transition-all cursor-pointer text-center
                        ${isFull ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-60' : 
                          isSelected ? 'border-[#005BAC] bg-blue-50 ring-2 ring-[#005BAC] ring-opacity-20' : 
                          'border-gray-200 bg-white hover:border-[#005BAC]/50'}
                      `}
                    >
                      <div className="font-semibold text-gray-900">{j.jam_mulai} - {j.jam_selesai}</div>
                      <div className="text-xs mt-1 text-gray-500">
                        {isFull ? 'Penuh' : `Sisa: ${j.kuota - booked}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {selectedJadwal && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] z-20 flex justify-center">
            <div className="w-full max-w-2xl flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Jadwal Terpilih:</p>
                <p className="font-semibold text-gray-900">
                  {format(parseISO(selectedJadwal.tanggal), 'dd MMM yyyy', { locale: localeID })}, {selectedJadwal.jam_mulai}
                </p>
              </div>
              <Button onClick={() => setShowConfirm(true)}>Lanjutkan Booking</Button>
            </div>
          </div>
        )}
      </div>

      {showConfirm && selectedJadwal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm animate-in zoom-in-95 duration-200">
            <CardHeader>
              <CardTitle>Konfirmasi Booking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-xl">
                <div><span className="text-sm text-gray-500 block">Nama</span> <span className="font-medium text-gray-900">{mahasiswa?.nama}</span></div>
                <div><span className="text-sm text-gray-500 block">NIM</span> <span className="font-medium text-gray-900">{mahasiswa?.nim}</span></div>
                <div><span className="text-sm text-gray-500 block">Tanggal</span> <span className="font-medium text-gray-900">{format(parseISO(selectedJadwal.tanggal), 'dd MMMM yyyy', { locale: localeID })}</span></div>
                <div><span className="text-sm text-gray-500 block">Jam</span> <span className="font-medium text-gray-900">{selectedJadwal.jam_mulai} - {selectedJadwal.jam_selesai}</span></div>
                <div><span className="text-sm text-gray-500 block">Nomor WA</span> <span className="font-medium text-gray-900">{wa}</span></div>
              </div>
              <p className="text-center font-medium mb-6">Apakah data sudah benar?</p>
              <div className="flex space-x-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)} disabled={bookingLoading}>Kembali</Button>
                <Button className="flex-1" onClick={handleBooking} disabled={bookingLoading}>
                  {bookingLoading ? 'Memproses...' : 'Konfirmasi'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
