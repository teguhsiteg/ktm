import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Mahasiswa } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { 
  Search, 
  Calendar, 
  UserCheck, 
  QrCode, 
  HelpCircle, 
  ShieldAlert, 
  Info, 
  CheckCircle, 
  MapPin, 
  ExternalLink,
  BookOpen,
  CheckCircle2,
  XCircle,
  FileText
} from 'lucide-react';

// Helper function to parse different date string formats from DB to DMY
function parseDateStringToDMY(str: string): { day: number; month: number; year: number } | null {
  if (!str) return null;
  let s = str.toLowerCase();
  
  // Normalize month names (Indonesian & English) to numbers
  const months = [
    { names: ['januari', 'january', 'jan'], val: 1 },
    { names: ['februari', 'february', 'feb'], val: 2 },
    { names: ['maret', 'march', 'mar'], val: 3 },
    { names: ['april', 'apr'], val: 4 },
    { names: ['mei', 'may'], val: 5 },
    { names: ['juni', 'june', 'jun'], val: 6 },
    { names: ['juli', 'july', 'jul'], val: 7 },
    { names: ['agustus', 'august', 'agt', 'aug'], val: 8 },
    { names: ['september', 'sep'], val: 9 },
    { names: ['oktober', 'october', 'okt', 'oct'], val: 10 },
    { names: ['november', 'nov'], val: 11 },
    { names: ['desember', 'december', 'des', 'dec'], val: 12 }
  ];
  
  let foundMonth: number | null = null;
  for (const m of months) {
    for (const name of m.names) {
      if (s.includes(name)) {
        foundMonth = m.val;
        s = s.replace(name, ' ' + m.val + ' ');
        break;
      }
    }
    if (foundMonth !== null) break;
  }
  
  // Extract all digit sequences
  const numbers = s.match(/\d+/g)?.map(Number) || [];
  if (numbers.length < 2) return null;
  
  // Case 1: 3 numbers, e.g. [20, 3, 2004] or [2004, 3, 20] or [5, 2, 95]
  if (numbers.length === 3) {
    let year = numbers[2];
    let month = numbers[1];
    let day = numbers[0];
    
    if (numbers[0] > 1000) { // yyyy-mm-dd format
      year = numbers[0];
      month = numbers[1];
      day = numbers[2];
    } else if (numbers[2] < 100) { // 2-digit year
      year = numbers[2] < 50 ? 2000 + numbers[2] : 1900 + numbers[2];
    }
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { day, month, year };
    }
    
    // Check if US format mm/dd/yyyy
    if (day >= 1 && day <= 12 && month >= 1 && month <= 31) {
      return { day: month, month: day, year };
    }
  }
  
  // Case 2: 2 numbers and we found a month name
  if (foundMonth !== null && numbers.length >= 2) {
    const yearNum = numbers.find(n => n > 31);
    const dayNum = numbers.find(n => n <= 31);
    if (yearNum && dayNum) {
      let year = yearNum;
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }
      return { day: dayNum, month: foundMonth, year };
    }
  }
  
  return null;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ nim: '', ttl: '', prodi: '', wa: '' });
  const [prodis, setProdis] = useState<string[]>([]);
  const [result, setResult] = useState<Mahasiswa | null>(null);
  const [searchDone, setSearchDone] = useState(false);

  useEffect(() => {
    const fetchProdis = async () => {
      try {
        const snap = await getDocs(collection(db, 'mahasiswa'));
        const list = snap.docs.map(d => (d.data().prodi || '') as string).filter(Boolean);
        const unique = Array.from(new Set(list)).sort();
        setProdis(unique);
      } catch (err) {
        console.error('Error fetching prodis:', err);
      }
    };
    fetchProdis();
  }, []);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.nim || !formData.ttl || !formData.prodi || !formData.wa) {
      toast.error('Harap lengkapi semua data');
      return;
    }
    
    if (formData.wa.length < 10 || formData.wa.length > 14) {
      toast.error('Nomor WhatsApp tidak valid (minimal 10 dan maksimal 14 angka)');
      return;
    }
    
    setLoading(true);
    setSearchDone(false);
    
    try {
      const q = query(collection(db, 'mahasiswa'), where('nim', '==', formData.nim.trim()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setResult(null);
      } else {
        const mhs = querySnapshot.docs[0].data() as Mahasiswa;
        mhs.id = querySnapshot.docs[0].id;
        
        // Match TTL and Prodi with advanced separation normalization
        const normalize = (val: string) => val.toLowerCase().replace(/[\/\s._-]/g, '').trim();
        
        const dbTtlRaw = mhs.ttl || '';
        const inputDateStr = formData.ttl; // 'yyyy-mm-dd'
        const dbProdi = normalize(mhs.prodi || '');
        const inputProdi = normalize(formData.prodi);

        let isTtlMatch = false;
        
        // 1. Try parsed DMY comparison
        const dbParsed = parseDateStringToDMY(dbTtlRaw);
        if (dbParsed && inputDateStr) {
          const [iYear, iMonth, iDay] = inputDateStr.split('-').map(Number);
          // Compare day and month directly
          if (dbParsed.day === iDay && dbParsed.month === iMonth) {
            const dbYearStr = String(dbParsed.year);
            const iYearStr = String(iYear);
            if (dbYearStr === iYearStr || dbYearStr.slice(-2) === iYearStr.slice(-2)) {
              isTtlMatch = true;
            }
          }
        }
        
        // 2. Fallback: Generate potential permutations and compare
        if (!isTtlMatch && inputDateStr) {
          const [iYear, iMonth, iDay] = inputDateStr.split('-').map(Number);
          const iYearStr = String(iYear);
          const iYearShort = iYearStr.slice(-2);
          const iMonthStrStr = String(iMonth);
          const iMonthStrPad = String(iMonth).padStart(2, '0');
          const iDayStrStr = String(iDay);
          const iDayStrPad = String(iDay).padStart(2, '0');
          
          const dbTtlNormalized = normalize(dbTtlRaw);
          
          const candidates = [
            `${iDayStrPad}${iMonthStrPad}${iYearStr}`,
            `${iDayStrStr}${iMonthStrStr}${iYearStr}`,
            `${iDayStrPad}${iMonthStrStr}${iYearStr}`,
            `${iDayStrStr}${iMonthStrPad}${iYearStr}`,
            
            `${iDayStrPad}${iMonthStrPad}${iYearShort}`,
            `${iDayStrStr}${iMonthStrStr}${iYearShort}`,
            `${iDayStrPad}${iMonthStrStr}${iYearShort}`,
            `${iDayStrStr}${iMonthStrPad}${iYearShort}`,
            
            `${iMonthStrPad}${iDayStrPad}${iYearStr}`,
            `${iMonthStrStr}${iDayStrStr}${iYearStr}`,
            `${iMonthStrPad}${iDayStrPad}${iYearShort}`,
            `${iMonthStrStr}${iDayStrStr}${iYearShort}`,
            
            `${iYearStr}${iMonthStrPad}${iDayStrPad}`,
            `${iYearStr}${iMonthStrStr}${iDayStrStr}`,
          ].map(c => normalize(c));
          
          if (candidates.some(c => dbTtlNormalized.includes(c) || c.includes(dbTtlNormalized))) {
            isTtlMatch = true;
          }
        }

        if (!isTtlMatch) {
          toast.error('Kombinasi NIM dan Tanggal Lahir tidak cocok');
          setResult(null);
        } else if (dbProdi !== inputProdi) {
          toast.error('Program Studi tidak sesuai');
          setResult(null);
        } else {
          setResult(mhs);
          toast.success('Data mahasiswa ditemukan!');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengambil data dari server');
    } finally {
      setLoading(false);
      setSearchDone(true);
    }
  };

  const proceedToSchedule = () => {
    if (result) {
      navigate(`/schedule/${result.id}`, { state: { wa: formData.wa } });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#121212] text-gray-800 dark:text-gray-100 flex flex-col">
      {/* Top Header */}
      <header className="bg-white dark:bg-[#1E1E1E] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src="https://www.uii.ac.id/wp-content/uploads/2017/04/Logo-UII-Asli.png" 
              alt="Logo UII" 
              className="w-10 h-10 object-contain"
              referrerPolicy="no-referrer"
            />
            <div>
              <span className="font-bold text-gray-900 dark:text-white block tracking-tight text-sm sm:text-base">
                Universitas Islam Indonesia
              </span>
              <span className="text-[10px] text-[#005BAC] dark:text-[#8AB4F8] font-semibold tracking-wider block uppercase">
                Sistem Reservasi KTM
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Professional Information and Guides */}
        <section className="lg:col-span-7 space-y-6 w-full">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-[#005BAC]/10 text-[#005BAC] dark:text-[#8AB4F8] dark:bg-[#005BAC]/20 px-3 py-1 rounded-full text-xs font-semibold">
              <Info className="w-3.5 h-3.5" />
              Layanan Mandiri Pengambilan Kartu Tanda Mahasiswa
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">
              Reservasi Pengambilan <span className="text-[#005BAC]">KTM UII</span> Baru Lebih Mudah
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed max-w-xl">
              Hindari antrean panjang dan pastikan Kartu Tanda Mahasiswa (KTM) fisik Anda telah siap sebelum datang ke Kantor Pelayanan Akademik. Silakan cari data diri Anda dan jadwalkan pengambilan.
            </p>
          </div>

          {/* Stepper Guide */}
          <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
            <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
              <BookOpen className="w-5 h-5 text-[#005BAC]" />
              Panduan 4 Langkah Reservasi KTM
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center font-bold text-sm text-[#005BAC] dark:text-[#8AB4F8]">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Verifikasi Data</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    Masukkan NIM, Tanggal Lahir (kalender), Prodi, dan nomor WhatsApp aktif Anda.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center font-bold text-sm text-[#005BAC] dark:text-[#8AB4F8]">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Status Fisik KTM</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    Sistem akan mengecek apakah pencetakan fisik KTM Anda sudah siap di kantor layanan.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center font-bold text-sm text-[#005BAC] dark:text-[#8AB4F8]">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Pilih Sesi Jadwal</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    Tentukan hari dan jam pengambilan yang fleksibel sesuai sisa slot kuota harian.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center font-bold text-sm text-[#005BAC] dark:text-[#8AB4F8]">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Dapatkan E-Tiket</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    Unduh PDF, Simpan Gambar, atau cetak Tiket QR Anda untuk discan petugas saat pengambilan.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Requirements Info Card */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 rounded-xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-400">PENTING: Persyaratan yang Harus Dibawa</p>
              <ul className="list-disc list-inside text-[11px] text-amber-800 dark:text-amber-500 mt-1 space-y-1">
                <li>Bukti Identitas Diri Sementara (KTM Sementara/KTP Asli)</li>
                <li>Bukti printout E-Tiket QR / screenshot HP secara jelas</li>
                <li>Hadir tepat waktu sesuai jam reservasi yang dipilih</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Right Side: Verification and Reservation Form */}
        <section className="lg:col-span-5 w-full">
          <Card className="border border-gray-200 dark:border-gray-800 shadow-lg bg-white dark:bg-[#1E1E1E] rounded-2xl overflow-hidden transition-colors">
            <CardHeader className="bg-[#005BAC]/5 border-b border-gray-100 dark:border-gray-800 p-6">
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-[#005BAC]" />
                Cari & Reservasi KTM
              </CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Isi data di bawah ini untuk memulai pencarian status KTM Anda.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSearch} className="space-y-4">
                
                {/* NIM Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="nim" className="flex items-center gap-1 font-semibold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    NIM Mahasiswa <span className="text-red-500 font-bold">*</span>
                  </Label>
                  <div className="relative">
                    <Input 
                      id="nim" 
                      placeholder="Contoh: 236102601" 
                      value={formData.nim}
                      onChange={e => setFormData({...formData, nim: e.target.value})}
                      required
                      className="h-11 border-gray-200 focus:ring-[#005BAC] dark:bg-[#2A2A2A] dark:border-gray-800 text-sm rounded-xl"
                    />
                  </div>
                </div>

                {/* TTL Calendar Picker */}
                <div className="space-y-1.5">
                  <Label htmlFor="ttl" className="flex items-center gap-1 font-semibold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Tanggal Lahir <span className="text-red-500 font-bold">*</span>
                  </Label>
                  <div className="relative">
                    <Input 
                      id="ttl" 
                      type="date"
                      value={formData.ttl}
                      onChange={e => setFormData({...formData, ttl: e.target.value})}
                      required
                      className="h-11 border-gray-200 focus:ring-[#005BAC] dark:bg-[#2A2A2A] dark:border-gray-800 text-sm rounded-xl cursor-pointer"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" /> Pilih tanggal lahir Anda melalui kalender di atas
                  </p>
                </div>

                {/* Prodi Selector */}
                <div className="space-y-1.5">
                  <Label htmlFor="prodi" className="flex items-center gap-1 font-semibold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Program Studi <span className="text-red-500 font-bold">*</span>
                  </Label>
                  <select
                    id="prodi"
                    value={formData.prodi}
                    onChange={e => setFormData({...formData, prodi: e.target.value})}
                    className="flex h-11 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#2A2A2A] px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#005BAC] focus:border-transparent cursor-pointer transition-colors"
                    required
                  >
                    <option value="" className="text-gray-400">-- Pilih Program Studi --</option>
                    {prodis.length === 0 ? (
                      <option value="" disabled>Memuat daftar program studi...</option>
                    ) : (
                      prodis.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))
                    )}
                  </select>
                </div>

                {/* WhatsApp Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="wa" className="flex items-center gap-1 font-semibold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Nomor WhatsApp <span className="text-red-500 font-bold">*</span>
                  </Label>
                  <Input 
                    id="wa"
                    type="tel"
                    placeholder="Contoh: 081234567890" 
                    value={formData.wa}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setFormData({...formData, wa: val});
                    }}
                    required
                    className="h-11 border-gray-200 focus:ring-[#005BAC] dark:bg-[#2A2A2A] dark:border-gray-800 text-sm rounded-xl"
                  />
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Digunakan untuk pengiriman notifikasi/tiket cadangan.
                  </p>
                </div>

                {/* Submit Button */}
                <Button type="submit" className="w-full mt-2 bg-[#005BAC] hover:bg-[#004B8C] font-semibold text-sm rounded-xl shadow-md h-12 transition-all duration-200" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Mencari Data...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Search className="w-4 h-4" /> Cari Data Mahasiswa
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Results Block */}
          {searchDone && (
            <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
              {!result ? (
                <Card className="border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/10 rounded-2xl">
                  <CardContent className="p-6 text-center text-red-700 dark:text-red-400 font-medium">
                    <div className="flex justify-center mb-2">
                      <XCircle className="w-10 h-10 text-red-500" />
                    </div>
                    <div className="font-bold text-sm">Data Mahasiswa Tidak Ditemukan</div>
                    <p className="text-xs text-red-600 dark:text-red-500 mt-1 leading-relaxed">
                      NIM atau Program Studi Anda tidak cocok dengan database kami. Pastikan juga tanggal lahir Anda telah dimasukkan dengan benar di kalender.
                    </p>
                  </CardContent>
                </Card>
              ) : result.status_ktm === 'Belum tersedia' ? (
                <Card className="border-orange-200 dark:border-orange-900/30 bg-orange-50 dark:bg-orange-950/10 rounded-2xl">
                  <CardContent className="p-6 text-center text-orange-700 dark:text-orange-400">
                    <div className="flex justify-center mb-2">
                      <Info className="w-10 h-10 text-orange-500" />
                    </div>
                    <div className="font-bold text-base text-orange-800 dark:text-orange-400">KTM Belum Siap Diambil</div>
                    <p className="text-xs text-orange-700 dark:text-orange-400 mt-1.5 leading-relaxed">
                      Maaf, fisik KTM Anda saat ini masih dalam proses cetak atau verifikasi dokumen.
                    </p>
                    {result.catatan_ktm ? (
                      <div className="mt-4 p-3 bg-white/80 dark:bg-gray-800 border border-orange-200/50 dark:border-orange-900/30 rounded-xl text-left text-xs shadow-sm">
                        <span className="font-bold block text-orange-800 dark:text-orange-400 mb-0.5">Catatan dari Akademik:</span>
                        <p className="text-gray-700 dark:text-gray-300">{result.catatan_ktm}</p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-orange-600 dark:text-orange-500 mt-2 italic">
                        Silakan cek kembali halaman ini secara berkala dalam beberapa hari ke depan.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : result.status_ktm === 'Sudah diambil' ? (
                <Card className="border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/10 rounded-2xl">
                  <CardContent className="p-6 text-center text-emerald-700 dark:text-emerald-400">
                    <div className="flex justify-center mb-2">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <div className="font-bold text-base text-emerald-800 dark:text-emerald-400">KTM Sudah Berhasil Diambil</div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1.5 leading-relaxed">
                      Kartu Tanda Mahasiswa (KTM) fisik Anda telah tercatat diserahkan oleh petugas.
                    </p>
                    {result.tanggal_ambil ? (
                      <div className="mt-4 p-3 bg-white/80 dark:bg-gray-800 border border-emerald-200/50 dark:border-emerald-900/30 rounded-xl text-left text-xs shadow-sm">
                        <span className="font-bold block text-emerald-800 dark:text-emerald-400 mb-0.5">Diserahkan pada tanggal:</span>
                        <p className="text-gray-700 dark:text-gray-300 font-semibold">
                          {(() => {
                            try {
                              const dateObj = result.tanggal_ambil?.toDate ? result.tanggal_ambil.toDate() : new Date(result.tanggal_ambil);
                              return format(dateObj, 'eeee, dd MMMM yyyy HH:mm', { locale: localeID }) + ' WIB';
                            } catch (e) {
                              return 'Telah diambil';
                            }
                          })()}
                        </p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-[#005BAC]/20 dark:border-blue-900/30 rounded-2xl shadow-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-[#005BAC]/10 px-6 py-3.5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <span className="text-xs font-bold text-[#005BAC] dark:text-[#8AB4F8] uppercase tracking-wider">Verifikasi Berhasil</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" /> KTM Siap Diambil
                    </span>
                  </div>
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-3.5 text-sm">
                      <div className="flex justify-between py-1.5 border-b border-gray-50 dark:border-gray-800">
                        <span className="text-gray-500 text-xs">Nama Lengkap</span>
                        <span className="font-bold text-gray-900 dark:text-white text-right">{result.nama}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-gray-50 dark:border-gray-800">
                        <span className="text-gray-500 text-xs">NIM</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{result.nim}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-gray-50 dark:border-gray-800">
                        <span className="text-gray-500 text-xs">Program Studi</span>
                        <span className="font-semibold text-gray-900 dark:text-white text-right">{result.prodi}</span>
                      </div>
                    </div>

                    <Button onClick={proceedToSchedule} className="w-full bg-[#005BAC] hover:bg-[#004B8C] font-semibold text-sm rounded-xl py-2.5 h-11 flex items-center justify-center gap-2">
                      <span>Lanjut Pilih Sesi Jadwal</span>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Footer Branding */}
      <footer className="bg-white dark:bg-[#1E1E1E] border-t border-gray-200 dark:border-gray-800 mt-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center space-x-3 justify-center md:justify-start">
            <img 
              src="https://www.uii.ac.id/wp-content/uploads/2017/04/Logo-UII-Asli.png" 
              alt="Logo UII" 
              className="w-8 h-8 object-contain"
              referrerPolicy="no-referrer"
            />
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-white tracking-tight">Universitas Islam Indonesia</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Jl. Kaliurang KM. 14,5, Yogyakarta, Indonesia</p>
            </div>
          </div>
          <div className="text-center md:text-right space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Developed by Guwigo Teknologi Indonesia</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">&copy; {new Date().getFullYear()} Universitas Islam Indonesia. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
