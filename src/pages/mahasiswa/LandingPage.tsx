import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
      const q = query(collection(db, 'mahasiswa'), where('nim', '==', formData.nim));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setResult(null);
      } else {
        const mhs = querySnapshot.docs[0].data() as Mahasiswa;
        mhs.id = querySnapshot.docs[0].id;
        
        // Match TTL and Prodi with separation normalization
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
      // Pass the WA number in state
      navigate(`/schedule/${result.id}`, { state: { wa: formData.wa } });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#005BAC] mb-2">Booking Pengambilan KTM</h1>
          <p className="text-gray-600">Silakan lakukan reservasi jadwal pengambilan KTM sebelum datang ke kampus.</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cari Data Mahasiswa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nim" className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                  NIM <span className="text-red-500 font-bold">*</span>
                </Label>
                <Input 
                  id="nim" 
                  placeholder="Contoh: 22531001" 
                  value={formData.nim}
                  onChange={e => setFormData({...formData, nim: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ttl" className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                  Tanggal Lahir (TTL) <span className="text-red-500 font-bold">*</span>
                </Label>
                <Input 
                  id="ttl" 
                  placeholder="Contoh: dd/mm/yy atau mm/dd/yy" 
                  value={formData.ttl}
                  onChange={e => setFormData({...formData, ttl: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prodi" className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                  Program Studi <span className="text-red-500 font-bold">*</span>
                </Label>
                <select
                  id="prodi"
                  value={formData.prodi}
                  onChange={e => setFormData({...formData, prodi: e.target.value})}
                  className="flex h-12 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#2A2A2A] px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#005BAC] cursor-pointer"
                  required
                >
                  <option value="" className="text-gray-400">Pilih Program Studi</option>
                  {prodis.length === 0 ? (
                    <option value="" disabled>Memuat program studi...</option>
                  ) : (
                    prodis.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa" className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
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
                />
              </div>
              <Button type="submit" className="w-full mt-4" disabled={loading} size="lg">
                {loading ? 'Mencari...' : 'Cari Data'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {searchDone && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!result ? (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-6 text-center text-red-700 font-medium">
                  Data mahasiswa tidak ditemukan atau tidak cocok.
                </CardContent>
              </Card>
            ) : result.status_ktm === 'Belum tersedia' ? (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-6 text-center text-orange-700 font-medium">
                  <div className="font-bold text-lg mb-2 text-orange-800">KTM Belum Tersedia</div>
                  <p className="text-sm text-orange-700">KTM Anda belum tersedia saat ini.</p>
                  {result.catatan_ktm ? (
                    <div className="mt-4 p-3.5 bg-white/75 rounded-xl text-left text-sm border border-orange-200/50 shadow-sm">
                      <span className="font-semibold block mb-1 text-orange-800">Catatan dari Admin:</span>
                      <p className="text-gray-700 font-normal leading-relaxed">{result.catatan_ktm}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-orange-600 mt-2">Silakan cek kembali beberapa hari lagi secara berkala.</p>
                  )}
                </CardContent>
              </Card>
            ) : result.status_ktm === 'Sudah diambil' ? (
              <Card className="border-emerald-200 bg-emerald-50">
                <CardContent className="p-6 text-center text-emerald-700 font-medium">
                  <div className="font-bold text-lg mb-2 text-emerald-800">KTM Sudah Diambil</div>
                  <p className="text-sm text-emerald-700">KTM Anda telah berhasil diambil.</p>
                  {result.tanggal_ambil ? (
                    <div className="mt-4 p-3.5 bg-white/75 rounded-xl text-left text-sm border border-emerald-200/50 shadow-sm">
                      <span className="font-semibold block mb-1 text-emerald-800">Waktu Pengambilan:</span>
                      <p className="text-gray-700 font-semibold leading-relaxed">
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
                    <p className="text-xs text-emerald-600 mt-2">Data waktu pengambilan tidak tersedia.</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-[#005BAC]/20">
                <CardContent className="p-6">
                  <div className="space-y-3 mb-6">
                    <div>
                      <p className="text-sm text-gray-500">Nama</p>
                      <p className="font-semibold text-gray-900">{result.nama}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">NIM</p>
                      <p className="font-semibold text-gray-900">{result.nim}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Program Studi</p>
                      <p className="font-semibold text-gray-900">{result.prodi}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status KTM</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {result.status_ktm}
                      </span>
                    </div>
                  </div>
                  <Button onClick={proceedToSchedule} className="w-full">
                    Pilih Jadwal
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

      </div>
      
      <footer className="mt-12 text-center text-sm text-gray-500 pb-8">
        <p className="font-medium text-gray-700 mb-1">Universitas Islam Indonesia</p>
        <p>Developed by Guwigo Teknologi Indonesia</p>
      </footer>
    </div>
  );
}
