import { useState, useEffect, FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { Jadwal } from '@/types';
import { toast } from 'sonner';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  TrendingUp,
  Sliders,
  Sparkles,
  Info,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  X
} from 'lucide-react';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { format, parseISO } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

export default function JadwalPage() {
  const [jadwal, setJadwal] = useState<Jadwal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    tanggal: '',
    jam_mulai: '',
    jam_selesai: '',
    kuota: 50,
    status: 'Aktif'
  });

  // Filters & Pagination State
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Semua' | 'Aktif' | 'Tidak aktif'>('Semua');
  const [filterKapasitas, setFilterKapasitas] = useState<'Semua' | 'Penuh' | 'Tersedia'>('Semua');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterDate, filterStatus, filterKapasitas, itemsPerPage]);

  // Filtered schedules calculation
  const filteredJadwal = jadwal.filter(j => {
    if (filterStatus !== 'Semua' && j.status !== filterStatus) return false;
    
    const booked = j.booked_count || 0;
    const isFull = booked >= j.kuota;
    if (filterKapasitas === 'Penuh' && !isFull) return false;
    if (filterKapasitas === 'Tersedia' && isFull) return false;
    
    if (filterDate && j.tanggal !== filterDate) return false;
    
    return true;
  });

  const totalFiltered = filteredJadwal.length;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalFiltered);
  const paginatedJadwal = filteredJadwal.slice(startIndex, endIndex);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'jadwal'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Jadwal));
      data.sort((a, b) => {
        if (a.tanggal !== b.tanggal) return b.tanggal.localeCompare(a.tanggal);
        return a.jam_mulai.localeCompare(b.jam_mulai);
      });
      setJadwal(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const resetForm = () => {
    setFormData({ tanggal: '', jam_mulai: '', jam_selesai: '', kuota: 50, status: 'Aktif' });
    setEditingId(null);
    setShowAdd(false);
  };

  const handleAddOrEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.tanggal || !formData.jam_mulai || !formData.jam_selesai) {
      toast.error('Harap isi semua kolom formulir');
      return;
    }
    
    // Check if end time is after start time
    if (formData.jam_mulai >= formData.jam_selesai) {
      toast.error('Jam selesai harus lebih akhir dari jam mulai');
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'jadwal', editingId), {
          ...formData,
          kuota: Number(formData.kuota),
          updated_at: serverTimestamp()
        });

        // Update all associated bookings
        try {
          const bookingQuery = query(collection(db, 'booking'), where('jadwal_id', '==', editingId));
          const bookingSnap = await getDocs(bookingQuery);
          if (!bookingSnap.empty) {
            const batch = writeBatch(db);
            const formattedJam = `${formData.jam_mulai} - ${formData.jam_selesai}`;
            bookingSnap.docs.forEach((bookingDoc) => {
              batch.update(bookingDoc.ref, {
                tanggal: formData.tanggal,
                jam: formattedJam,
                updated_at: serverTimestamp()
              });
            });
            await batch.commit();
            console.log(`Successfully updated ${bookingSnap.size} associated booking documents.`);
          }
        } catch (bookingErr) {
          console.error('Failed to update associated bookings:', bookingErr);
        }

        toast.success('Jadwal berhasil diperbarui');
      } else {
        await addDoc(collection(db, 'jadwal'), {
          ...formData,
          kuota: Number(formData.kuota),
          booked_count: 0,
          created_at: serverTimestamp()
        });
        toast.success('Jadwal berhasil ditambahkan');
      }
      resetForm();
    } catch (e) {
      console.error(e);
      toast.error(editingId ? 'Gagal memperbarui jadwal' : 'Gagal menambahkan jadwal');
    }
  };

  const handleEditClick = (j: Jadwal) => {
    setFormData({
      tanggal: j.tanggal,
      jam_mulai: j.jam_mulai,
      jam_selesai: j.jam_selesai,
      kuota: j.kuota,
      status: j.status
    });
    setEditingId(j.id);
    setShowAdd(true);
    // Smooth scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteDoc(doc(db, 'jadwal', deletingId));
      toast.success('Jadwal berhasil dihapus');
      setDeletingId(null);
    } catch (e) {
      console.error(e);
      toast.error('Gagal menghapus jadwal');
    }
  };

  const toggleStatus = async (j: Jadwal) => {
    try {
      const newStatus = j.status === 'Aktif' ? 'Tidak aktif' : 'Aktif';
      await updateDoc(doc(db, 'jadwal', j.id), {
        status: newStatus,
        updated_at: serverTimestamp()
      });
      toast.success(`Jadwal diubah menjadi ${newStatus}`);
    } catch (e) {
      console.error(e);
      toast.error('Gagal mengubah status');
    }
  };

  // Calculations for quick dashboard insights
  const totalSessions = jadwal.length;
  const activeSessions = jadwal.filter(j => j.status === 'Aktif').length;
  const totalQuota = jadwal.reduce((acc, curr) => acc + (curr.kuota || 0), 0);
  const totalBooked = jadwal.reduce((acc, curr) => acc + (curr.booked_count || 0), 0);
  const percentageBooked = totalQuota > 0 ? Math.round((totalBooked / totalQuota) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#005BAC]" />
            Manajemen Jadwal Pengambilan KTM
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Kelola tanggal, sesi jam, kuota kapasitas, dan status aktif untuk reservasi mahasiswa.
          </p>
        </div>
        <Button 
          size="sm" 
          onClick={() => {
            if (showAdd) {
              resetForm();
            } else {
              setShowAdd(true);
            }
          }}
          className={showAdd ? 'bg-gray-500 hover:bg-gray-600' : 'bg-[#005BAC] hover:bg-[#004B8C]'}
        >
          {showAdd ? 'Batal' : <><Plus className="w-4 h-4 mr-2" /> Tambah Sesi Jadwal</>}
        </Button>
      </div>

      {/* Overview Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-[#1E1E1E] dark:border-gray-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-5 flex items-center space-x-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-[#005BAC] dark:text-[#8AB4F8] rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total Sesi</p>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{totalSessions}</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">{activeSessions} Sesi Aktif Reservasi</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[#1E1E1E] dark:border-gray-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-5 flex items-center space-x-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total Kuota</p>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{totalQuota}</h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Kapasitas Tempat Disediakan</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[#1E1E1E] dark:border-gray-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-5 flex items-center space-x-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total Ter-Booking</p>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{totalBooked}</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">{totalQuota - totalBooked} Kuota Tersisa</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[#1E1E1E] dark:border-gray-800 shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-5 flex items-center space-x-4">
            <div className="p-3 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Persentase Keterisian</p>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{percentageBooked}%</h3>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mt-1 overflow-hidden">
                <div 
                  className="bg-purple-500 h-1.5 rounded-full" 
                  style={{ width: `${Math.min(100, percentageBooked)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Form Panel */}
      {showAdd && (
        <Card className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-md overflow-hidden animate-in slide-in-from-top-4 duration-300">
          <CardHeader className="bg-slate-50 dark:bg-[#252525] border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#005BAC]" />
              {editingId ? 'Sempurnakan / Perbarui Sesi Jadwal' : 'Buat Sesi Jadwal Baru'}
            </CardTitle>
            <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
              {editingId ? `ID: ${editingId}` : 'Konfigurasi Kuota'}
            </span>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleAddOrEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Tanggal */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" /> Tanggal Sesi
                  </label>
                  <Input 
                    type="date" 
                    value={formData.tanggal} 
                    onChange={e => setFormData({...formData, tanggal: e.target.value})} 
                    required 
                    className="h-10 border-gray-200 dark:bg-[#2A2A2A] dark:border-gray-800 rounded-xl cursor-pointer focus:ring-[#005BAC]"
                  />
                </div>

                {/* Jam Mulai */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" /> Jam Mulai
                  </label>
                  <Input 
                    type="time" 
                    value={formData.jam_mulai} 
                    onChange={e => setFormData({...formData, jam_mulai: e.target.value})} 
                    required 
                    className="h-10 border-gray-200 dark:bg-[#2A2A2A] dark:border-gray-800 rounded-xl focus:ring-[#005BAC]"
                  />
                </div>

                {/* Jam Selesai */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" /> Jam Selesai
                  </label>
                  <Input 
                    type="time" 
                    value={formData.jam_selesai} 
                    onChange={e => setFormData({...formData, jam_selesai: e.target.value})} 
                    required 
                    className="h-10 border-gray-200 dark:bg-[#2A2A2A] dark:border-gray-800 rounded-xl focus:ring-[#005BAC]"
                  />
                </div>

                {/* Kuota Kapasitas */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-gray-400" /> Kuota Sesi (Siswa)
                  </label>
                  <Input 
                    type="number" 
                    min="1" 
                    value={formData.kuota} 
                    onChange={e => setFormData({...formData, kuota: Number(e.target.value)})} 
                    required 
                    className="h-10 border-gray-200 dark:bg-[#2A2A2A] dark:border-gray-800 rounded-xl focus:ring-[#005BAC]"
                  />
                </div>

              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2.5">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={resetForm}
                  className="rounded-xl h-10 px-4 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Batal
                </Button>
                <Button 
                  type="submit" 
                  className="bg-[#005BAC] hover:bg-[#004B8C] text-white rounded-xl h-10 px-6 text-xs font-semibold shadow-sm"
                >
                  {editingId ? 'Simpan Perubahan' : 'Buat Sesi'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Main Schedule List Card */}
      <Card className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-gray-400" />
            Daftar Jadwal Pengambilan KTM Terdaftar
          </h3>
          <span className="bg-slate-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] font-bold px-2.5 py-1 rounded-full">
            {totalFiltered !== totalSessions ? `Terfilter: ${totalFiltered} dari ${totalSessions}` : `Total ${totalSessions} Jadwal`}
          </span>
        </div>

        {/* Filters Panel */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-slate-50/40 dark:bg-slate-900/10 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
              <Filter className="w-4 h-4 text-gray-400" />
              <span>FILTER JADWAL</span>
              {(filterDate || filterStatus !== 'Semua' || filterKapasitas !== 'Semua') && (
                <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  Terfilter
                </span>
              )}
            </div>
            
            {(filterDate || filterStatus !== 'Semua' || filterKapasitas !== 'Semua') && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setFilterDate('');
                  setFilterStatus('Semua');
                  setFilterKapasitas('Semua');
                }}
                className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 px-2 rounded-lg flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Filter Tanggal */}
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Cari Tanggal</span>
              <div className="relative">
                <Input 
                  type="date" 
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="h-9 text-xs border-gray-200 dark:bg-[#1E1E1E] dark:border-gray-800 rounded-xl w-full"
                />
                {filterDate && (
                  <button 
                    onClick={() => setFilterDate('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Status */}
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Status Sesi</span>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E1E] px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#005BAC]"
              >
                <option value="Semua">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Tidak aktif">Tidak Aktif</option>
              </select>
            </div>

            {/* Filter Kapasitas */}
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Ketersediaan Kuota</span>
              <select
                value={filterKapasitas}
                onChange={e => setFilterKapasitas(e.target.value as any)}
                className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E1E] px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#005BAC]"
              >
                <option value="Semua">Semua Kuota</option>
                <option value="Tersedia">Masih Ada Sisa</option>
                <option value="Penuh">Sesi Penuh</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50/70 dark:bg-[#252525]/30 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold text-center w-14">No</th>
                <th className="px-6 py-4 font-semibold">Tanggal Pengambilan</th>
                <th className="px-6 py-4 font-semibold">Sesi Waktu (Jam)</th>
                <th className="px-6 py-4 font-semibold text-center">Reservasi / Kapasitas</th>
                <th className="px-6 py-4 font-semibold">Status Reservasi</th>
                <th className="px-6 py-4 font-semibold text-right pr-6">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="animate-spin h-5 w-5 border-2 border-[#005BAC] border-t-transparent rounded-full" />
                      <span className="text-xs font-semibold">Menyinkronkan data dari Firestore...</span>
                    </div>
                  </td>
                </tr>
              ) : jadwal.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Info className="w-8 h-8 text-gray-300" />
                      <span className="text-xs font-semibold">Belum ada sesi jadwal yang dibuat</span>
                      <p className="text-[10px] text-gray-400">Klik tombol "Tambah Sesi Jadwal" di kanan atas untuk memulai.</p>
                    </div>
                  </td>
                </tr>
              ) : totalFiltered === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-amber-500" />
                      <span className="text-xs font-semibold">Tidak ada jadwal yang sesuai filter</span>
                      <p className="text-[10px] text-gray-400">Silakan ubah pengaturan filter Anda atau reset pencarian.</p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        onClick={() => {
                          setFilterDate('');
                          setFilterStatus('Semua');
                          setFilterKapasitas('Semua');
                        }}
                        className="text-xs font-semibold text-[#005BAC] mt-1"
                      >
                        Reset Filter
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedJadwal.map((j, idx) => {
                  const isFull = (j.booked_count || 0) >= j.kuota;
                  const isCurrentlyActive = j.status === 'Aktif';
                  
                  // Format readable Indonesian Date
                  let formattedDate = j.tanggal;
                  try {
                    formattedDate = format(parseISO(j.tanggal), 'eeee, dd MMMM yyyy', { locale: localeID });
                  } catch (e) {
                    // Fail gracefully
                  }

                  return (
                    <tr key={j.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors duration-150">
                      <td className="px-6 py-4 text-center font-mono text-xs font-bold text-gray-400 dark:text-gray-500">
                        {startIndex + idx + 1}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                        {formattedDate}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg text-xs font-semibold">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {j.jam_mulai} - {j.jam_selesai} WIB
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-xs font-extrabold ${isFull ? 'text-red-500' : 'text-gray-950 dark:text-white'}`}>
                            {j.booked_count || 0} / {j.kuota}
                          </span>
                          <div className="w-20 bg-gray-100 dark:bg-gray-800 rounded-full h-1 mt-1 overflow-hidden">
                            <div 
                              className={`h-1 rounded-full ${isFull ? 'bg-red-500' : 'bg-emerald-500'}`} 
                              style={{ width: `${Math.min(100, ((j.booked_count || 0) / j.kuota) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => toggleStatus(j)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase shadow-xs transition-transform hover:scale-105 active:scale-95 ${
                            isCurrentlyActive 
                              ? 'bg-blue-50 dark:bg-blue-950/30 text-[#005BAC] dark:text-blue-300 border border-blue-200 dark:border-blue-900/40' 
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                          }`}
                          title="Klik untuk mengubah status"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isCurrentlyActive ? 'bg-[#005BAC] animate-pulse' : 'bg-gray-400'}`} />
                          {j.status}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right pr-6 flex justify-end gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEditClick(j)}
                          className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20 rounded-lg text-gray-400 dark:text-gray-500"
                          title="Edit Jadwal"
                          id={`edit-schedule-${j.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setDeletingId(j.id)}
                          className="h-8 w-8 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 rounded-lg text-gray-400 dark:text-gray-500"
                          title="Hapus Jadwal"
                          id={`delete-schedule-${j.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Cards Layout */}
        <div className="block md:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {loading ? (
            <div className="p-6 text-center text-gray-400">
              <span className="animate-spin h-5 w-5 border-2 border-[#005BAC] border-t-transparent rounded-full inline-block" />
              <p className="text-xs font-semibold mt-2">Menyinkronkan data dari Firestore...</p>
            </div>
          ) : jadwal.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Info className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-xs font-semibold">Belum ada sesi jadwal yang dibuat</p>
            </div>
          ) : totalFiltered === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center">
              <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
              <p className="text-xs font-semibold">Tidak ada jadwal yang sesuai filter</p>
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => {
                  setFilterDate('');
                  setFilterStatus('Semua');
                  setFilterKapasitas('Semua');
                }}
                className="text-xs font-semibold text-[#005BAC]"
              >
                Reset Filter
              </Button>
            </div>
          ) : (
            paginatedJadwal.map((j, idx) => {
              const isFull = (j.booked_count || 0) >= j.kuota;
              const isCurrentlyActive = j.status === 'Aktif';
              let formattedDate = j.tanggal;
              try {
                formattedDate = format(parseISO(j.tanggal), 'eeee, dd MMM yyyy', { locale: localeID });
              } catch (e) {
                // Fail gracefully
              }

              return (
                <div key={j.id} className="p-4 space-y-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/10">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-500 font-mono mr-2">#{startIndex + idx + 1}</span>
                      <span className="font-bold text-gray-950 dark:text-white text-sm">{formattedDate}</span>
                    </div>
                    <button 
                      onClick={() => toggleStatus(j)}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase transition-transform hover:scale-105 active:scale-95 ${
                        isCurrentlyActive 
                          ? 'bg-blue-50 dark:bg-blue-950/30 text-[#005BAC] dark:text-blue-300 border border-blue-200 dark:border-blue-900/40' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {j.status}
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 items-center text-xs justify-between">
                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg font-semibold text-gray-700 dark:text-gray-300">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {j.jam_mulai} - {j.jam_selesai} WIB
                    </span>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Booked:</span>
                      <span className={`text-xs font-extrabold ${isFull ? 'text-red-500' : 'text-gray-950 dark:text-white'}`}>
                        {j.booked_count || 0} / {j.kuota}
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full ${isFull ? 'bg-red-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${Math.min(100, ((j.booked_count || 0) / j.kuota) * 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEditClick(j)}
                      className="h-8 text-xs font-semibold px-3 flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setDeletingId(j.id)}
                      className="h-8 text-xs font-semibold px-3 text-red-500 hover:text-red-600 flex items-center gap-1 border-red-100 hover:bg-red-50 dark:border-red-950"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Footer */}
        {totalFiltered > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30 dark:bg-slate-900/5">
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>
                Menampilkan <strong className="font-extrabold text-gray-800 dark:text-gray-200">{totalFiltered === 0 ? 0 : startIndex + 1}</strong> - <strong className="font-extrabold text-gray-800 dark:text-gray-200">{endIndex}</strong> dari <strong className="font-extrabold text-gray-800 dark:text-gray-200">{totalFiltered}</strong> jadwal
              </span>
              
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">Tampilkan:</span>
                <select
                  value={itemsPerPage}
                  onChange={e => setItemsPerPage(Number(e.target.value))}
                  className="h-7 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E1E] px-2 py-0.5 text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg border-gray-200 dark:border-gray-800"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  if (
                    page === 1 || 
                    page === totalPages || 
                    Math.abs(page - currentPage) <= 1
                  ) {
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-bold ${
                          currentPage === page 
                            ? 'bg-[#005BAC] hover:bg-[#004B8C] text-white font-bold' 
                            : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-slate-50'
                        }`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    );
                  } else if (
                    page === 2 || 
                    page === totalPages - 1
                  ) {
                    return <span key={page} className="px-1 text-gray-400 select-none" style={{ alignSelf: 'center' }}>...</span>;
                  }
                  return null;
                }).filter((val, i, arr) => {
                  if (val === null) return false;
                  if (val.type === 'span' && arr[i - 1]?.type === 'span') return false;
                  return true;
                })}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg border-gray-200 dark:border-gray-800"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Elegant Deletion Confirmation Modal */}
      <ConfirmationModal
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={executeDelete}
        title="Hapus Sesi Jadwal"
        description="Apakah Anda yakin ingin menghapus sesi jadwal pengambilan ini secara permanen dari basis data? Pendaftaran yang sudah terlanjur memesan sesi ini mungkin akan mengalami kendala sinkronisasi."
        confirmText="Ya, Hapus Permanen"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
}
