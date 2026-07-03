import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Booking, Mahasiswa } from '@/types';
import { format, parseISO } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Download, Image as ImageIcon, Printer, CheckCircle2, XCircle, ChevronLeft } from 'lucide-react';
import { toPng, toCanvas } from 'html-to-image';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { isBookingExpired } from '@/lib/utils';
import { motion } from 'motion/react';

export default function TicketPage() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [mahasiswa, setMahasiswa] = useState<Mahasiswa | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

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
        const b = snap.docs[0].data() as Booking;
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm text-center"
        >
          {/* UII Badge */}
          <motion.div 
            animate={{ 
              boxShadow: ["0px 0px 0px 0px rgba(0,91,172,0.2)", "0px 0px 0px 20px rgba(0,91,172,0)", "0px 0px 0px 0px rgba(0,91,172,0)"] 
            }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6 shadow-lg shadow-brand/20"
          >
            UII
          </motion.div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Memuat Tiket Booking...</h2>
          <p className="text-sm text-slate-500 mb-6 font-medium">Harap tunggu sebentar</p>
          
          {/* Progress bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 mb-3 overflow-hidden shadow-inner">
            <div 
              className="bg-brand h-full rounded-full transition-all duration-150 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          {/* Percentage */}
          <div className="text-2xl font-black text-brand font-mono tracking-wider">
            {progress}%
          </div>
        </motion.div>
      </div>
    );
  }

  if (!booking || !mahasiswa) return <div className="min-h-screen flex items-center justify-center">Tiket tidak valid.</div>;

  const isExpired = booking.status === 'Hangus' || isBookingExpired(booking.tanggal, booking.jam);

  return (
    <div className="min-h-screen bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-background p-4 py-8 md:py-12 flex flex-col items-center print:bg-white print:p-0 print:min-h-0 print:block relative overflow-hidden">
      
      {/* Decorative blobs for ticket page */}
      <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-brand/10 blur-[100px] pointer-events-none print:hidden" />
      
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mb-6 flex justify-between items-center print:hidden z-10"
      >
        <Link to="/" className="text-brand font-medium text-sm hover:underline flex items-center bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-sm transition-all hover:bg-white dark:hover:bg-slate-800">
          <ChevronLeft className="w-4 h-4 mr-1" /> Beranda
        </Link>
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" className="rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-white border-slate-200/50 dark:border-slate-700/50 shadow-sm" onClick={handleDownloadImage} disabled={downloadingImage || isExpired} title="Simpan Gambar">
            <ImageIcon className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-white border-slate-200/50 dark:border-slate-700/50 shadow-sm" onClick={handleDownloadPDF} disabled={downloadingPDF || isExpired} title="Download PDF">
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-white border-slate-200/50 dark:border-slate-700/50 shadow-sm" onClick={handlePrint} disabled={isExpired} title="Cetak">
            <Printer className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 100 }} 
        ref={ticketRef}
        className={`w-full max-w-md rounded-[28px] overflow-hidden shadow-2xl shadow-brand/10 border relative print:shadow-none print:border-2 print:border-slate-800 print:rounded-2xl print:mx-auto z-10 backdrop-blur-sm ${
          isExpired 
            ? 'bg-slate-50 border-slate-300 filter grayscale-[40%] contrast-[95%] opacity-95' 
            : 'bg-white/95 dark:bg-slate-900/95 border-slate-200/50 dark:border-slate-700/50'
        }`}
        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
      >
        {/* Ticket Header */}
        <div className={`p-8 pb-10 text-white text-center relative print:bg-opacity-100 ${isExpired ? 'bg-slate-500' : 'bg-gradient-to-br from-brand to-brand-dark'}`}>
           {/* Notches for boarding pass look */}
           <div className="absolute -bottom-4 -left-4 w-8 h-8 bg-background rounded-full print:border-r-2 print:border-t-2 print:border-slate-800 print:bg-white"></div>
           <div className="absolute -bottom-4 -right-4 w-8 h-8 bg-background rounded-full print:border-l-2 print:border-t-2 print:border-slate-800 print:bg-white"></div>
           
           <h2 className="text-2xl font-bold tracking-wide">Universitas Islam Indonesia</h2>
           <p className="text-white/80 text-sm mt-1.5 font-medium tracking-widest uppercase">E-Tiket Pengambilan KTM</p>
        </div>

        {/* Divider dashed */}
        <div className="border-t-2 border-dashed border-slate-200 dark:border-slate-700 w-full relative print:border-slate-800"></div>

        {/* Ticket Body */}
        <div className="p-8 flex flex-col items-center relative">
           
           {/* Status Badge */}
           {booking.status === 'Sudah Diambil' ? (
             <div className="mb-8 flex items-center bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-5 py-2 rounded-full text-sm font-semibold border border-emerald-200 dark:border-emerald-800/50 print:bg-emerald-50 print:border-emerald-400">
               <CheckCircle2 className="w-4 h-4 mr-2" /> Sudah Diambil
             </div>
           ) : isExpired ? (
             <div className="mb-8 flex items-center bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-5 py-2 rounded-full text-xs font-black border border-slate-400 dark:border-slate-600 tracking-wider uppercase shadow-sm animate-pulse">
               <XCircle className="w-4 h-4 mr-2" /> Hangus
             </div>
           ) : (
             <div className="mb-8 flex items-center bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-5 py-2 rounded-full text-sm font-semibold border border-amber-200 dark:border-amber-800/50 print:bg-amber-50 print:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
               Belum Diambil
             </div>
           )}

           {/* QR Code */}
           <div className={`p-4 rounded-[20px] shadow-sm border mb-4 flex justify-center items-center print:border-slate-300 print:shadow-none bg-white ${
             isExpired ? 'border-slate-200 opacity-60' : 'border-slate-100 ring-4 ring-slate-50 dark:ring-slate-800'
           }`}>
              <QRCodeCanvas value={booking.qr_token} size={200} level="H" fgColor={isExpired ? "#94a3b8" : "#0f172a"} />
           </div>
           
           <p className={`font-mono text-xl font-bold tracking-[0.2em] mb-10 ${isExpired ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'}`}>{booking.booking_id}</p>

           {/* Details Grid */}
           <div className="w-full grid grid-cols-2 gap-y-7 gap-x-4 bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Nama</p>
                <p className={`font-bold mt-1 text-sm md:text-base leading-tight ${isExpired ? 'text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>{mahasiswa.nama}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">NIM</p>
                <p className={`font-bold mt-1 text-sm md:text-base ${isExpired ? 'text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>{mahasiswa.nim}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Program Studi</p>
                <p className={`font-bold mt-1 text-sm md:text-base ${isExpired ? 'text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>{mahasiswa.prodi}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Tanggal</p>
                <p className={`font-bold mt-1 text-sm md:text-base ${isExpired ? 'text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                  {format(parseISO(booking.tanggal), 'dd MMM yyyy', { locale: localeID })}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Jam</p>
                <p className={`font-bold mt-1 text-sm md:text-base ${isExpired ? 'text-slate-500' : 'text-brand'}`}>{booking.jam}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">WhatsApp</p>
                <p className={`font-bold mt-1 text-sm md:text-base ${isExpired ? 'text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>{booking.wa}</p>
              </div>
           </div>

           {/* Rebooking options for expired ticket */}
           {isExpired && (
             <div className="mt-8 w-full flex flex-col items-center">
               <p className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center mb-4 leading-relaxed">
                 Jadwal pengambilan tiket Anda telah hangus karena melewati batas waktu. Silakan ajukan ulang jadwal baru untuk mengambil KTM.
               </p>
               <Button asChild className="w-full bg-brand hover:bg-brand-dark text-white font-semibold h-12 rounded-xl shadow-lg shadow-brand/20 transition-all duration-300">
                 <Link to={`/schedule/${booking.mahasiswa_id}`} state={{ wa: booking.wa, reapply: true }}>
                   Ajukan Ulang Jadwal
                 </Link>
               </Button>
             </div>
           )}
           
        </div>
      </motion.div>
      
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-sm text-slate-500 dark:text-slate-400 mt-8 max-w-sm text-center print:hidden font-medium z-10"
      >
        Harap simpan tiket ini dan tunjukkan QR Code kepada petugas saat mengambil KTM.
      </motion.p>

    </div>
  );
}
