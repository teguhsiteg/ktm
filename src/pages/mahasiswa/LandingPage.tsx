import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Mahasiswa } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Search, CalendarCheck, QrCode, ArrowRight } from 'lucide-react';

const UII_PRODIS = [
  "Akuntansi", "Arsitektur", "Biologi", "Ekonomi", "Ekonomi Islam", "Farmasi", 
  "Hubungan Internasional", "Hukum", "Hukum Keluarga", "Ilmu Agama Islam", 
  "Ilmu Komunikasi", "Informatika", "Kedokteran", "Kimia", "Manajemen", 
  "Pendidikan Agama Islam", "Pendidikan Bahasa Inggris", "Pendidikan Kimia", 
  "Psikologi", "Rekayasa Tekstil", "Statistika", "Teknik Elektro", 
  "Teknik Industri", "Teknik Kimia", "Teknik Lingkungan", "Teknik Mesin", "Teknik Sipil"
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ nim: '', ttl: '', prodi: '', wa: '' });
  const [result, setResult] = useState<Mahasiswa | null>(null);
  const [searchDone, setSearchDone] = useState(false);

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
      const docRef = doc(db, 'mahasiswa', formData.nim);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        setResult(null);
      } else {
        const mhs = docSnap.data() as Mahasiswa;
        mhs.id = docSnap.id;
        
        const normalize = (val: string) => val.toLowerCase().replace(/[\/\s._-]/g, '').trim();
        
        const dbTtl = normalize(mhs.ttl || '');
        const inputTtl = normalize(formData.ttl);
        const dbProdi = normalize(mhs.prodi || '');
        const inputProdi = normalize(formData.prodi);

        if (dbTtl !== inputTtl) {
           toast.error('Data NIM dan TTL tidak cocok');
           setResult(null);
        } else if (dbProdi !== inputProdi) {
           toast.error('Program Studi tidak sesuai');
           setResult(null);
        } else {
           setResult(mhs);
           toast.success('Data mahasiswa ditemukan');
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
    <div className="min-h-screen flex flex-col p-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-background relative overflow-hidden transition-colors duration-500">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-light/10 blur-[120px] pointer-events-none" />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-5xl mx-auto z-10 py-12">
        <AnimatePresence mode="wait">
          {!showForm ? (
            <motion.div 
              key="hero"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="text-center w-full"
            >
              <div className="inline-flex items-center justify-center p-3 bg-brand/10 text-brand rounded-2xl mb-6 shadow-sm shadow-brand/5">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="14" x="3" y="5" rx="2" ry="2"/><path d="M7 15h4M15 15h2M7 11h2M13 11h4"/></svg>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-text-main mb-6 tracking-tight leading-tight">
                Portal Pengambilan <br className="hidden md:block"/> <span className="text-brand">KTM UII</span>
              </h1>
              <p className="text-text-muted text-base md:text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
                Selamat datang! Dapatkan Kartu Tanda Mahasiswa Anda melalui 3 langkah mudah. Lakukan reservasi antrean secara daring untuk menghindari kerumunan di kampus.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12 text-left">
                <div className="glass-card p-6 rounded-[24px] flex flex-col items-start hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 text-brand rounded-xl flex items-center justify-center mb-4">
                    <Search className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-text-main text-lg mb-2">1. Cek Data</h3>
                  <p className="text-text-muted text-sm">Masukkan NIM dan tanggal lahir untuk memverifikasi ketersediaan KTM fisik Anda.</p>
                </div>
                <div className="glass-card p-6 rounded-[24px] flex flex-col items-start hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                    <CalendarCheck className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-text-main text-lg mb-2">2. Pilih Jadwal</h3>
                  <p className="text-text-muted text-sm">Pilih hari dan sesi waktu yang tersedia sesuai dengan kelonggaran jadwal Anda.</p>
                </div>
                <div className="glass-card p-6 rounded-[24px] flex flex-col items-start hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 text-purple-600 rounded-xl flex items-center justify-center mb-4">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-text-main text-lg mb-2">3. Dapatkan Tiket</h3>
                  <p className="text-text-muted text-sm">Simpan tiket digital (QR Code) dan tunjukkan kepada petugas saat tiba di lokasi.</p>
                </div>
              </div>

              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-block">
                <Button 
                  onClick={() => setShowForm(true)} 
                  size="lg"
                  className="bg-brand hover:bg-brand-dark text-white rounded-2xl h-14 px-8 shadow-xl shadow-brand/25 text-lg font-semibold group"
                >
                  Mulai Cek Data
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div 
              key="form"
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -30 }}
              transition={{ duration: 0.5, type: "spring", bounce: 0.3 }}
              className="w-full max-w-md"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-text-main tracking-tight">Cari Data Mahasiswa</h2>
                <p className="text-text-muted text-sm mt-2">Silakan isi formulir di bawah ini dengan data yang valid.</p>
              </div>

              <Card className="mb-6 glass-card border-0 shadow-2xl shadow-brand/5 dark:shadow-none overflow-hidden rounded-[24px]">
                <div className="h-1.5 w-full bg-gradient-to-r from-brand-light to-brand"></div>
                <CardContent className="p-6 md:p-8">
                  <form onSubmit={handleSearch} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="nim" className="flex items-center gap-1 font-medium text-text-main">
                        NIM <span className="text-red-500 font-bold">*</span>
                      </Label>
                      <Input 
                        id="nim" 
                        placeholder="Contoh: 22531001" 
                        value={formData.nim}
                        onChange={e => setFormData({...formData, nim: e.target.value})}
                        required
                        className="h-12 bg-surface/50 border-border-main focus-visible:ring-brand rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ttl" className="flex items-center gap-1 font-medium text-text-main">
                        Tanggal Lahir (TTL) <span className="text-red-500 font-bold">*</span>
                      </Label>
                      <Input 
                        id="ttl" 
                        placeholder="Contoh: dd/mm/yy atau mm/dd/yy" 
                        value={formData.ttl}
                        onChange={e => setFormData({...formData, ttl: e.target.value})}
                        required
                        className="h-12 bg-surface/50 border-border-main focus-visible:ring-brand rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prodi" className="flex items-center gap-1 font-medium text-text-main text-sm">
                        Program Studi <span className="text-red-500 font-bold">*</span>
                      </Label>
                      <div className="relative">
                        <select
                          id="prodi"
                          value={formData.prodi}
                          onChange={e => setFormData({...formData, prodi: e.target.value})}
                          className="flex h-12 w-full appearance-none rounded-xl border border-border-main bg-surface/50 px-4 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent cursor-pointer transition-all backdrop-blur-sm"
                          required
                        >
                          <option value="" className="text-text-muted">Pilih Program Studi</option>
                          {UII_PRODIS.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-muted">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wa" className="flex items-center gap-1 font-medium text-text-main">
                        Nomor WhatsApp <span className="text-red-500 font-bold">*</span>
                      </Label>
                      <Input 
                        id="wa"
                        type="tel"
                        placeholder="Contoh: 08123456789" 
                        value={formData.wa}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          setFormData({...formData, wa: val});
                        }}
                        required
                        className="h-12 bg-surface/50 border-border-main focus-visible:ring-brand rounded-xl"
                      />
                    </div>
                    
                    <div className="pt-2 flex gap-3">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setShowForm(false)}
                        className="h-12 rounded-xl flex-1 border-border-main hover:bg-surface text-text-main"
                      >
                        Kembali
                      </Button>
                      <Button 
                        type="submit" 
                        className="h-12 rounded-xl flex-[2] bg-brand hover:bg-brand-dark text-white shadow-lg shadow-brand/25 transition-all font-medium text-base" 
                        disabled={loading}
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Mencari...
                          </span>
                        ) : 'Cari Data'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <AnimatePresence mode="wait">
              {searchDone && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, y: 20 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
                  className="overflow-hidden"
                >
                  {!result ? (
                    <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 rounded-[24px]">
                      <CardContent className="p-6 text-center text-red-700 dark:text-red-400 font-medium">
                        Data mahasiswa tidak ditemukan atau tidak cocok.
                      </CardContent>
                    </Card>
                  ) : result.status_ktm === 'Belum tersedia' ? (
                    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900/50 rounded-[24px]">
                      <CardContent className="p-6 text-center text-orange-700 dark:text-orange-400 font-medium">
                        <div className="font-bold text-lg mb-2 text-orange-800 dark:text-orange-300">KTM Belum Tersedia</div>
                        <p className="text-sm">KTM Anda belum tersedia saat ini.</p>
                        {result.catatan_ktm ? (
                          <div className="mt-4 p-3.5 bg-white/75 dark:bg-slate-900/50 rounded-xl text-left text-sm border border-orange-200/50 dark:border-orange-900/30 shadow-sm">
                            <span className="font-semibold block mb-1 text-orange-800 dark:text-orange-300">Catatan dari Admin:</span>
                            <p className="font-normal leading-relaxed text-orange-900 dark:text-orange-200">{result.catatan_ktm}</p>
                          </div>
                        ) : (
                          <p className="text-xs mt-2 opacity-80">Silakan cek kembali beberapa hari lagi secara berkala.</p>
                        )}
                      </CardContent>
                    </Card>
                  ) : result.status_ktm === 'Sudah diambil' ? (
                    <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/50 rounded-[24px]">
                      <CardContent className="p-6 text-center text-emerald-700 dark:text-emerald-400 font-medium">
                        <div className="font-bold text-lg mb-2 text-emerald-800 dark:text-emerald-300">KTM Sudah Diambil</div>
                        <p className="text-sm">KTM Anda telah berhasil diambil.</p>
                        {result.tanggal_ambil ? (
                          <div className="mt-4 p-3.5 bg-white/75 dark:bg-slate-900/50 rounded-xl text-left text-sm border border-emerald-200/50 dark:border-emerald-900/30 shadow-sm">
                            <span className="font-semibold block mb-1 text-emerald-800 dark:text-emerald-300">Waktu Pengambilan:</span>
                            <p className="font-semibold leading-relaxed text-emerald-900 dark:text-emerald-200">
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
                        ) : (
                          <p className="text-xs mt-2 opacity-80">Data waktu pengambilan tidak tersedia.</p>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-brand/20 bg-brand/5 rounded-[24px]">
                      <CardContent className="p-6">
                        <div className="space-y-4 mb-6 text-left">
                          <div>
                            <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Nama Mahasiswa</p>
                            <p className="font-bold text-text-main text-lg">{result.nama}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">NIM</p>
                              <p className="font-semibold text-text-main">{result.nim}</p>
                            </div>
                            <div>
                              <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Status KTM</p>
                              <span className="inline-flex items-center px-2.5 py-0.5 mt-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400">
                                {result.status_ktm}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Program Studi</p>
                            <p className="font-medium text-text-main">{result.prodi}</p>
                          </div>
                        </div>
                        <Button onClick={proceedToSchedule} className="w-full h-12 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold text-base shadow-lg shadow-brand/20">
                          Pilih Jadwal Sekarang
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <footer className="mt-auto text-center text-sm text-text-muted pb-6 relative z-10">
        <p className="font-medium text-text-main mb-1">Universitas Islam Indonesia</p>
        <p>Developed by Guwigo Teknologi Indonesia</p>
      </footer>
    </div>
  );
}
