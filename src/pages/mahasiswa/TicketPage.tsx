import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Booking, Mahasiswa } from '@/types';
import { getFacultyInfo } from '@/utils/prodiMapping';
import { format, parseISO } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Download, Image as ImageIcon, Printer, CheckCircle2, XCircle, MapPin } from 'lucide-react';
import { toPng, toCanvas } from 'html-to-image';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { isBookingExpired } from '@/lib/utils';

export default function TicketPage() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [mahasiswa, setMahasiswa] = useState<Mahasiswa | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);
  const [customMappings, setCustomMappings] = useState<any[]>([]);

  useEffect(() => {
    const fetchMappings = async () => {
      try {
        const snap = await getDocs(collection(db, 'prodi_mapping'));
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCustomMappings(data);
      } catch (e) {
        console.error("Gagal mengambil prodi_mapping:", e);
      }
    };
    fetchMappings();
  }, []);

  const getFacultyInfoWithCustom = (prodiName: string) => {
    const normalize = (val: string) => val.toLowerCase().replace(/[\/\s._-]/g, '').trim();
    const matched = customMappings.find(
      m => normalize(m.prodi) === normalize(prodiName)
    );
    if (matched) {
      return {
        fakultas: matched.fakultas,
        lokasi: matched.lokasi
      };
    }
    return getFacultyInfo(prodiName);
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    // Simulate loading progress smoothly
    setProgress(0);
    intervalId = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 96) {
          clearInterval(intervalId);
          return 96;
        }
        const step = Math.floor(Math.random() * 8) + 3; // 3% to 10% step
        return Math.min(prev + step, 96);
      });
    }, 40);

    const fetchBooking = async () => {
      try {
        const q = query(collection(db, 'booking'), where('booking_id', '==', bookingId));
        const snap = await getDocs(q);
        if (snap.empty) {
          toast.error('Tiket tidak ditemukan');
          setProgress(100);
          setLoading(false);
          clearInterval(intervalId);
          return;
        }
        const b = { id: snap.docs[0].id, ...snap.docs[0].data() } as Booking;
        setBooking(b);
        
        const mDoc = await getDoc(doc(db, 'mahasiswa', b.mahasiswa_id));
        if (mDoc.exists()) {
          setMahasiswa(mDoc.data() as Mahasiswa);
        }
        
        // Rapid completion
        setProgress(100);
        setTimeout(() => {
          setLoading(false);
          clearInterval(intervalId);
        }, 120);
      } catch (e) {
        console.error(e);
        toast.error('Gagal memuat tiket');
        clearInterval(intervalId);
        setLoading(false);
      }
    };
    fetchBooking();

    return () => clearInterval(intervalId);
  }, [bookingId]);

  const handleDownloadImage = async () => {
    if (!ticketRef.current || downloadingImage) return;
    setDownloadingImage(true);
    const toastId = toast.loading('Sedang menyiapkan gambar tiket...');
    try {
      const dataUrl = await toPng(ticketRef.current, { 
        quality: 1, 
        pixelRatio: 3,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `Tiket-KTM-${booking?.booking_id}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Tiket berhasil disimpan sebagai gambar', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Gagal menyimpan gambar tiket', { id: toastId });
    } finally {
      setDownloadingImage(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!ticketRef.current || downloadingPDF) return;
    setDownloadingPDF(true);
    const toastId = toast.loading('Sedang membuat file PDF tiket...');
    try {
      const canvas = await toCanvas(ticketRef.current, { 
        pixelRatio: 3,
        backgroundColor: '#ffffff'
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Tiket-KTM-${booking?.booking_id}.pdf`);
      toast.success('Tiket berhasil diunduh sebagai PDF', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Gagal membuat PDF', { id: toastId });
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          {/* UII Badge */}
          <div className="w-16 h-16 bg-white border dark:border-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md p-2">
            <img 
              src="/logo-uii.png" 
              alt="Logo UII" 
              className="w-full h-full object-contain animate-pulse"
              referrerPolicy="no-referrer"
            />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Memuat Tiket Booking...</h2>
          <p className="text-sm text-gray-500 mb-6 font-medium">Harap tunggu sebentar</p>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden shadow-inner">
            <div 
              className="bg-[#005BAC] h-full rounded-full transition-all duration-150 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          {/* Percentage */}
          <div className="text-2xl font-black text-[#005BAC] font-mono tracking-wider">
            {progress}%
          </div>
        </div>
      </div>
    );
  }

  if (!booking || !mahasiswa) return <div className="min-h-screen flex items-center justify-center">Tiket tidak valid.</div>;

  if (booking.status === 'Sudah Diambil') {
    return (
      <div className="min-h-screen bg-gray-100 p-4 py-12 flex flex-col items-center justify-center">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-[24px] overflow-hidden shadow-xl p-8 flex flex-col items-center text-center">
          {/* UII Badge */}
          <div className="w-16 h-16 bg-white border rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md p-2">
            <img 
              src="/logo-uii.png" 
              alt="Logo UII" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-6 border border-emerald-200 text-emerald-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">KTM Sudah Diambil</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed max-w-xs mx-auto">
            Kartu Tanda Mahasiswa (KTM) Anda telah berhasil diambil dan diserahkan oleh petugas administrasi.
          </p>

          <div className="w-full bg-slate-50 rounded-2xl p-5 mb-8 border border-slate-100 text-left space-y-3">
            <div className="flex justify-between text-xs border-b border-dashed border-slate-200 pb-2">
              <span className="text-gray-500 font-medium">NAMA</span>
              <span className="font-bold text-gray-800 text-right">{mahasiswa.nama}</span>
            </div>
            <div className="flex justify-between text-xs border-b border-dashed border-slate-200 pb-2">
              <span className="text-gray-500 font-medium">NIM</span>
              <span className="font-bold text-gray-800 text-right font-mono">{mahasiswa.nim}</span>
            </div>
            <div className="flex justify-between text-xs border-b border-dashed border-slate-200 pb-2">
              <span className="text-gray-500 font-medium">PRODI</span>
              <span className="font-bold text-gray-800 text-right">{mahasiswa.prodi}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium">ID BOOKING</span>
              <span className="font-bold text-[#005BAC] text-right font-mono">{booking.booking_id}</span>
            </div>
          </div>

          <Button asChild className="w-full bg-[#005BAC] hover:bg-[#004B8C] font-semibold h-11 rounded-xl shadow-md">
            <Link to="/">
              Kembali ke Beranda
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const isExpired = booking.status === 'Hangus' || isBookingExpired(booking.tanggal, booking.jam);

  return (
    <div className="min-h-screen bg-gray-100 p-4 py-12 flex flex-col items-center print:bg-white print:p-0 print:min-h-0 print:block">
      
      <div className="w-full max-w-md mb-6 flex justify-between items-center print:hidden">
        <Link to="/" className="text-[#005BAC] font-medium text-sm hover:underline">← Kembali ke Beranda</Link>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={handleDownloadImage} disabled={downloadingImage || isExpired} title="Simpan Gambar">
            <ImageIcon className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={downloadingPDF || isExpired} title="Download PDF">
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={isExpired} title="Cetak"><Printer className="w-4 h-4" /></Button>
        </div>
      </div>

      <div 
        ref={ticketRef}
        className={`w-full max-w-md rounded-[24px] overflow-hidden shadow-xl border relative print:shadow-none print:border-2 print:border-gray-800 print:rounded-2xl print:mx-auto ${
          isExpired 
            ? 'bg-slate-50 border-slate-300 filter grayscale-[40%] contrast-[95%] opacity-90' 
            : 'bg-white border-gray-200'
        }`}
        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
      >
        {/* Ticket Header */}
        <div className={`p-6 text-white text-center relative print:bg-opacity-100 ${isExpired ? 'bg-slate-500' : 'bg-[#005BAC]'}`}>
           {/* Notches for boarding pass look */}
           <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-gray-100 rounded-full print:border-r-2 print:border-t-2 print:border-gray-800 print:bg-white"></div>
           <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-gray-100 rounded-full print:border-l-2 print:border-t-2 print:border-gray-800 print:bg-white"></div>
           
           <h2 className="text-xl font-bold tracking-wide">Universitas Islam Indonesia</h2>
           <p className="text-blue-100 text-sm mt-1">Booking Pengambilan KTM</p>
        </div>

        {/* Divider dashed */}
        <div className="border-t-2 border-dashed border-gray-200 w-full relative print:border-gray-800"></div>

        {/* Ticket Body */}
        <div className="p-8 flex flex-col items-center relative">
           
           {/* Status Badge */}
           {booking.status === 'Sudah Diambil' ? (
             <div className="mb-6 flex items-center bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-semibold border border-emerald-200 print:bg-emerald-50 print:border-emerald-400">
               <CheckCircle2 className="w-4 h-4 mr-2" /> Sudah Diambil
             </div>
           ) : isExpired ? (
             <div className="mb-6 flex items-center bg-gray-200 text-gray-700 px-4 py-1.5 rounded-full text-xs font-black border border-gray-400 tracking-wider uppercase shadow-sm animate-pulse">
               <XCircle className="w-4 h-4 mr-2 text-gray-600" /> Hangus
             </div>
           ) : (
             <div className="mb-6 flex items-center bg-amber-50 text-amber-700 px-4 py-1.5 rounded-full text-sm font-semibold border border-amber-200 print:bg-amber-50 print:border-amber-400">
               Belum Diambil
             </div>
           )}

           {/* QR Code */}
           <div className={`p-3 rounded-2xl shadow-sm border mb-4 flex justify-center items-center print:border-gray-300 print:shadow-none ${
             isExpired ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-white border-gray-100'
           }`}>
              <QRCodeCanvas value={booking.qr_token} size={180} level="H" />
           </div>
           
           <p className={`font-mono text-lg font-bold tracking-widest mb-8 ${isExpired ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{booking.booking_id}</p>

           {/* Details Grid */}
           {(() => {
              const facInfo = getFacultyInfoWithCustom(mahasiswa.prodi);
              return (
                <div className="w-full space-y-5 text-left">
                  <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                     <div>
                       <p className="text-xs text-gray-500 uppercase tracking-wider">Nama</p>
                       <p className={`font-bold mt-0.5 leading-tight ${isExpired ? 'text-gray-500' : 'text-gray-900'}`}>{mahasiswa.nama}</p>
                     </div>
                     <div>
                       <p className="text-xs text-gray-500 uppercase tracking-wider">NIM</p>
                       <p className={`font-semibold mt-0.5 ${isExpired ? 'text-gray-500' : 'text-gray-900'}`}>{mahasiswa.nim}</p>
                     </div>
                     <div className="col-span-2">
                       <p className="text-xs text-gray-500 uppercase tracking-wider">Fakultas</p>
                       <p className={`font-semibold mt-0.5 ${isExpired ? 'text-gray-500' : 'text-gray-900'}`}>{facInfo.fakultas}</p>
                     </div>
                     <div className="col-span-2">
                       <p className="text-xs text-gray-500 uppercase tracking-wider">Program Studi</p>
                       <p className={`font-semibold mt-0.5 ${isExpired ? 'text-gray-500' : 'text-gray-900'}`}>{mahasiswa.prodi}</p>
                     </div>
                     <div>
                       <p className="text-xs text-gray-500 uppercase tracking-wider">Tanggal</p>
                       <p className={`font-semibold mt-0.5 ${isExpired ? 'text-gray-500' : 'text-gray-900'}`}>
                         {format(parseISO(booking.tanggal), 'dd MMM yyyy', { locale: localeID })}
                       </p>
                     </div>
                     <div>
                       <p className="text-xs text-gray-500 uppercase tracking-wider">Jam</p>
                       <p className={`font-semibold mt-0.5 ${isExpired ? 'text-gray-500' : 'text-gray-900'}`}>{booking.jam}</p>
                     </div>
                     <div className="col-span-2">
                       <p className="text-xs text-gray-500 uppercase tracking-wider">WhatsApp</p>
                       <p className={`font-semibold mt-0.5 ${isExpired ? 'text-gray-500' : 'text-gray-900'}`}>{booking.wa}</p>
                     </div>
                  </div>

                  {/* Tempat Pengambilan Ticket Banner */}
                  <div className="pt-4 border-t border-dashed border-gray-200 print:border-gray-800">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#005BAC] print:text-black shrink-0" />
                      <span>Lokasi Pengambilan KTM</span>
                    </p>
                    <p className={`font-bold text-xs leading-relaxed ${isExpired ? 'text-gray-500' : 'text-gray-900'}`}>
                      {facInfo.lokasi}
                    </p>
                  </div>
                </div>
              );
           })()}

           {/* Rebooking options for expired ticket */}
           {isExpired && (
             <div className="mt-8 pt-6 border-t border-gray-200 w-full flex flex-col items-center">
               <p className="text-xs text-gray-500 font-medium text-center mb-4 leading-relaxed">
                 Jadwal pengambilan tiket Anda telah hangus karena melewati batas waktu. Silakan ajukan ulang jadwal baru untuk mengambil KTM.
               </p>
               <Button asChild className="w-full bg-[#005BAC] hover:bg-[#004B8C] font-semibold h-11 rounded-xl shadow-md transition-all duration-200">
                 <Link to={`/schedule/${booking.mahasiswa_id}`} state={{ wa: booking.wa, reapply: true }}>
                   Ajukan Ulang
                 </Link>
               </Button>
             </div>
           )}

           {/* Rescheduling options for active ticket */}
           {!isExpired && booking.status === 'Belum Diambil' && (
             <div className="mt-8 pt-6 border-t border-gray-200 w-full flex flex-col items-center print:hidden">
               <p className="text-xs text-gray-500 font-medium text-center mb-4 leading-relaxed">
                 Ingin mengubah hari atau jam pengambilan? Anda bisa menjadwalkan ulang pengambilan KTM Anda di sini.
               </p>
               <Button asChild variant="outline" className="w-full border-[#005BAC] text-[#005BAC] hover:bg-blue-50 font-semibold h-11 rounded-xl shadow-sm transition-all duration-200">
                 <Link to={`/schedule/${booking.mahasiswa_id}`} state={{ wa: booking.wa, reschedule: true, oldBookingId: booking.id, oldJadwalId: booking.jadwal_id, oldBookingCode: booking.booking_id }}>
                   Ganti Jadwal Booking
                 </Link>
               </Button>
             </div>
           )}
           
        </div>
      </div>
      
      <p className="text-sm text-gray-500 mt-8 max-w-sm text-center print:hidden">
        Harap simpan tiket ini dan tunjukkan QR Code kepada petugas saat mengambil KTM.
      </p>

    </div>
  );
}
