import { useState, useEffect, FormEvent, ChangeEvent, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, writeBatch, doc, getDocs, updateDoc } from 'firebase/firestore';
import { Mahasiswa, Booking } from '@/types';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Download, Upload, Plus, FileSpreadsheet, Search, X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CheckSquare, Trash2, Check, AlertCircle } from 'lucide-react';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { isBookingExpired } from '@/lib/utils';

export default function MahasiswaPage() {
  const [mahasiswa, setMahasiswa] = useState<Mahasiswa[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newMhs, setNewMhs] = useState({ nama: '', nim: '', prodi: '', ttl: '', status_ktm: 'Tersedia', catatan_ktm: '' });
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [filterProdi, setFilterProdi] = useState('Semua');

  // Pagination & Sorting
  const [itemsPerPage, setItemsPerPage] = useState<'10' | '20' | '30' | 'Semua'>('10');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Mahasiswa; direction: 'asc' | 'desc' } | null>(null);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [editingMhs, setEditingMhs] = useState<Mahasiswa | null>(null);

  const getCombinedStatus = (mhs: Mahasiswa, bookingsList: Booking[]) => {
    if (mhs.status_ktm === 'Belum tersedia') {
      return 'Belum tersedia';
    }
    
    // Find booking for this student
    const mhsBooking = bookingsList.find(b => b.mahasiswa_id === mhs.id);
    
    if (mhs.status_ktm === 'Sudah diambil' || (mhsBooking && mhsBooking.status === 'Sudah Diambil')) {
      return 'Sudah diambil';
    }
    
    if (mhsBooking) {
      if (mhsBooking.status === 'Belum Diambil') {
        const isExpired = isBookingExpired(mhsBooking.tanggal, mhsBooking.jam);
        return isExpired ? 'Booking Hangus' : 'Sudah Booking';
      }
      if (mhsBooking.status === 'Hangus') {
        return 'Booking Hangus';
      }
    }
    
    return 'Tersedia'; // Tersedia (Belum Booking)
  };

  useEffect(() => {
    let mhsLoaded = false;
    let bLoaded = false;

    const unsubMhs = onSnapshot(collection(db, 'mahasiswa'), (snap) => {
      setMahasiswa(snap.docs.map(d => ({ id: d.id, ...d.data() } as Mahasiswa)));
      mhsLoaded = true;
      if (bLoaded) setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    const unsubBooking = onSnapshot(collection(db, 'booking'), (snap) => {
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
      bLoaded = true;
      if (mhsLoaded) setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => {
      unsubMhs();
      unsubBooking();
    };
  }, []);

  // Toggle selection for a single row
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const executeBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'mahasiswa', id));
      });
      await batch.commit();
      toast.success(`Berhasil menghapus ${selectedIds.length} data mahasiswa`);
      setSelectedIds([]);
    } catch (e) {
      console.error('Failed to bulk delete:', e);
      toast.error('Gagal menghapus data secara massal');
    }
  };

  const handleBulkUpdateStatus = async (status: 'Tersedia' | 'Belum tersedia') => {
    if (selectedIds.length === 0) return;

    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'mahasiswa', id), {
          status_ktm: status,
          updated_at: serverTimestamp()
        });
      });
      await batch.commit();
      toast.success(`Berhasil memperbarui status ${selectedIds.length} mahasiswa menjadi "${status}"`);
      setSelectedIds([]);
    } catch (e) {
      console.error('Failed to bulk update status:', e);
      toast.error('Gagal memperbarui status secara massal');
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'mahasiswa'), {
        ...newMhs,
        created_at: serverTimestamp()
      });
      toast.success('Berhasil menambahkan mahasiswa');
      setShowAdd(false);
      setNewMhs({ nama: '', nim: '', prodi: '', ttl: '', status_ktm: 'Tersedia', catatan_ktm: '' });
    } catch (e) {
      toast.error('Gagal menambahkan data');
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { raw: false });
        
        // Batch write to Firestore (max 500 per batch, simplify here)
        const batch = writeBatch(db);
        let count = 0;
        
        data.forEach((row: any) => {
          if (row.NIM && row.Nama) {
            const ref = doc(collection(db, 'mahasiswa'));
            batch.set(ref, {
              nim: String(row.NIM),
              nama: String(row.Nama),
              prodi: String(row['Program Studi'] || row.Prodi || ''),
              ttl: String(row.TTL || row['Tanggal Lahir'] || row['Tempat Tanggal Lahir'] || ''),
              status_ktm: String(row['Status KTM'] || 'Tersedia'),
              created_at: serverTimestamp()
            });
            count++;
          }
        });
        
        if (count > 0) {
          await batch.commit();
          toast.success(`Berhasil import ${count} data mahasiswa`);
        } else {
          toast.error('Format Excel tidak sesuai');
        }
      } catch (err) {
        console.error(err);
        toast.error('Gagal import data');
      } finally {
        setImporting(false);
        // Reset file input
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      NIM: '22531001',
      Nama: 'Ahmad Fulan',
      'Program Studi': 'Informatika',
      TTL: '5/02/95',
      'Status KTM': 'Tersedia'
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, "Template_Mahasiswa.xlsx");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const bookingsSnap = await getDocs(collection(db, 'booking'));
      const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
      
      const exportData = mahasiswa.map(mhs => {
        const mhsBooking = bookings.find(b => b.mahasiswa_id === mhs.id);
        return {
          'NIM': mhs.nim,
          'Nama': mhs.nama,
          'Program Studi': mhs.prodi,
          'TTL / Tanggal Lahir': mhs.ttl || '-',
          'Status Fisik KTM': mhs.status_ktm,
          'Status Pengambilan': mhsBooking ? mhsBooking.status : 'Belum Booking',
          'Tanggal Jadwal': mhsBooking ? mhsBooking.tanggal : '-',
          'Jam Jadwal': mhsBooking ? mhsBooking.jam : '-',
          'No WA': mhsBooking ? mhsBooking.wa : '-',
          'Booking ID': mhsBooking ? mhsBooking.booking_id : '-'
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data Mahasiswa & KTM");
      XLSX.writeFile(wb, "Export_Data_KTM_Mahasiswa.xlsx");
      toast.success('Berhasil export data');
    } catch (error) {
      toast.error('Gagal export data');
    } finally {
      setExporting(false);
    }
  };

  // Extract unique study programs for the filter dropdown
  const uniqueProdi = ['Semua', ...Array.from(new Set(mahasiswa.map(m => m.prodi).filter(Boolean)))];

  const processedMahasiswa = useMemo(() => {
    let result = mahasiswa.filter(m => {
      const matchesSearch = 
        (m.nama || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (m.nim || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const combStatus = getCombinedStatus(m, bookings);
      const matchesStatus = filterStatus === 'Semua' || combStatus === filterStatus;
      
      const matchesProdi = filterProdi === 'Semua' || m.prodi === filterProdi;
      
      return matchesSearch && matchesStatus && matchesProdi;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [mahasiswa, bookings, searchQuery, filterStatus, filterProdi, sortConfig]);

  const totalPages = itemsPerPage === 'Semua' ? 1 : Math.ceil(processedMahasiswa.length / parseInt(itemsPerPage));
  const currentData = itemsPerPage === 'Semua' 
    ? processedMahasiswa 
    : processedMahasiswa.slice((currentPage - 1) * parseInt(itemsPerPage), currentPage * parseInt(itemsPerPage));

  // Check if all current page items are selected
  const isAllSelected = currentData.length > 0 && currentData.every(m => m.id && selectedIds.includes(m.id));

  // Toggle selection for all items on current page
  const toggleSelectAll = () => {
    if (isAllSelected) {
      const pageIds = currentData.map(m => m.id!).filter(Boolean);
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      const pageIds = currentData.map(m => m.id!).filter(Boolean);
      setSelectedIds(prev => {
        const newSelection = [...prev];
        pageIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterProdi, itemsPerPage]);

  const handleSort = (key: keyof Mahasiswa) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIndicator = ({ columnKey }: { columnKey: keyof Mahasiswa }) => {
    if (sortConfig?.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1 inline-block" /> : <ChevronDown className="w-4 h-4 ml-1 inline-block" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Data Mahasiswa</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Menampilkan {currentData.length} dari {processedMahasiswa.length} mahasiswa
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="w-4 h-4 mr-2" /> Template</Button>
          <div className="relative">
             <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={importing} />
             <Button variant="outline" size="sm" disabled={importing}><Upload className="w-4 h-4 mr-2" /> {importing ? 'Importing...' : 'Import Excel'}</Button>
          </div>
          <Button size="sm" variant="secondary" onClick={handleExport} disabled={exporting || mahasiswa.length === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> {exporting ? 'Exporting...' : 'Export Semua Data'}
          </Button>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus className="w-4 h-4 mr-2" /> Tambah Manual</Button>
        </div>
      </div>

       {showAdd && (
        <Card className="bg-white dark:bg-[#1E1E1E] dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg">Tambah Mahasiswa Manual</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">NIM</label>
                  <Input value={newMhs.nim} onChange={e => setNewMhs({...newMhs, nim: e.target.value})} required className="dark:bg-[#2A2A2A] dark:border-gray-800" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Nama</label>
                  <Input value={newMhs.nama} onChange={e => setNewMhs({...newMhs, nama: e.target.value})} required className="dark:bg-[#2A2A2A] dark:border-gray-800" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Prodi</label>
                  <Input value={newMhs.prodi} onChange={e => setNewMhs({...newMhs, prodi: e.target.value})} required className="dark:bg-[#2A2A2A] dark:border-gray-800" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">TTL / Tanggal Lahir</label>
                  <Input placeholder="Contoh: 5/02/95" value={newMhs.ttl} onChange={e => setNewMhs({...newMhs, ttl: e.target.value})} required className="dark:bg-[#2A2A2A] dark:border-gray-800" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Status KTM</label>
                  <select 
                    className="flex h-10 w-full rounded-xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-[#2A2A2A] px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#005BAC]"
                    value={newMhs.status_ktm} onChange={e => setNewMhs({...newMhs, status_ktm: e.target.value})}
                  >
                    <option value="Tersedia" className="dark:bg-[#1E1E1E]">Tersedia</option>
                    <option value="Belum tersedia" className="dark:bg-[#1E1E1E]">Belum tersedia</option>
                    <option value="Sudah diambil" className="dark:bg-[#1E1E1E]">Sudah diambil</option>
                  </select>
                </div>
              </div>
              
              {newMhs.status_ktm === 'Belum tersedia' && (
                <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs text-gray-500 dark:text-gray-400 block">Catatan untuk KTM Belum Tersedia</label>
                  <Input 
                    placeholder="Contoh: Sedang dalam proses cetak / Ada kendala foto..." 
                    value={newMhs.catatan_ktm} 
                    onChange={e => setNewMhs({...newMhs, catatan_ktm: e.target.value})} 
                    className="w-full dark:bg-[#2A2A2A] dark:border-gray-800" 
                  />
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit">Simpan</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Global Search and Filter Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white dark:bg-[#1E1E1E] p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="md:col-span-5 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 dark:text-gray-500" />
          <Input 
            placeholder="Cari berdasarkan nama mahasiswa atau NIM..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-10 w-full dark:bg-[#2A2A2A] dark:border-gray-800 dark:text-gray-100"
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="md:col-span-3">
          <select 
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#2A2A2A] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#005BAC] focus:border-transparent transition-colors duration-150"
          >
            <option value="Semua">Semua Status KTM & Booking</option>
            <option value="Tersedia">Tersedia (Belum Booking)</option>
            <option value="Sudah Booking">Sudah Booking</option>
            <option value="Sudah diambil">Sudah Diambil</option>
            <option value="Booking Hangus">Booking Hangus / Terlewat</option>
            <option value="Belum tersedia">Fisik Belum Tersedia</option>
          </select>
        </div>

        <div className="md:col-span-3 flex gap-2">
          <select 
            value={filterProdi}
            onChange={e => setFilterProdi(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#2A2A2A] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#005BAC] focus:border-transparent transition-colors duration-150"
          >
            {uniqueProdi.map(prodi => (
              <option key={prodi} value={prodi}>{prodi === 'Semua' ? 'Semua Program Studi' : prodi}</option>
            ))}
          </select>

          {(searchQuery !== '' || filterStatus !== 'Semua' || filterProdi !== 'Semua') && (
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('Semua');
                setFilterProdi('Semua');
              }}
              className="h-10 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-950 dark:hover:bg-red-950/30 whitespace-nowrap"
            >
              Reset
            </Button>
          )}
        </div>
        
        <div className="md:col-span-1 flex items-center justify-end">
          <select 
            value={itemsPerPage}
            onChange={e => setItemsPerPage(e.target.value as any)}
            className="flex h-10 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#2A2A2A] px-2 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#005BAC]"
          >
            <option value="10">10 / hal</option>
            <option value="20">20 / hal</option>
            <option value="30">30 / hal</option>
            <option value="Semua">Semua</option>
          </select>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#005BAC]/5 border border-[#005BAC]/15 p-4 rounded-xl shadow-sm transition-all animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#005BAC] dark:text-blue-300">
              Terpilih <strong>{selectedIds.length}</strong> mahasiswa
            </span>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
            <Button 
              size="sm" 
              variant="outline"
              className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
              onClick={() => handleBulkUpdateStatus('Tersedia')}
            >
              Set Tersedia (Verifikasi)
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-950/40"
              onClick={() => handleBulkUpdateStatus('Belum tersedia')}
            >
              Set Belum Tersedia
            </Button>
            <Button 
              size="sm" 
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => setShowConfirmDelete(true)}
            >
              Hapus Massal
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setSelectedIds([])}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      <Card className="bg-white dark:bg-[#1E1E1E] dark:border-gray-800 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 uppercase border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="w-12 px-6 py-3.5">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 dark:border-gray-800 text-[#005BAC] focus:ring-[#005BAC] cursor-pointer"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-3.5 font-medium">No</th>
                <th className="px-6 py-3.5 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('nim')}>
                  NIM <SortIndicator columnKey="nim" />
                </th>
                <th className="px-6 py-3.5 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('nama')}>
                  Nama <SortIndicator columnKey="nama" />
                </th>
                <th className="px-6 py-3.5 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('prodi')}>
                  Program Studi <SortIndicator columnKey="prodi" />
                </th>
                <th className="px-6 py-3.5 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('ttl')}>
                  TTL <SortIndicator columnKey="ttl" />
                </th>
                <th className="px-6 py-3.5 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('status_ktm')}>
                  Status KTM <SortIndicator columnKey="status_ktm" />
                </th>
                <th className="px-6 py-3.5 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center dark:text-gray-400">Memuat data...</td></tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    {mahasiswa.length === 0 ? 'Data kosong' : 'Tidak ada mahasiswa yang cocok dengan pencarian / filter'}
                  </td>
                </tr>
              ) : (
                currentData.map((m, idx) => (
                  <tr key={m.id} className={`hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors duration-150 ${m.id && selectedIds.includes(m.id) ? 'bg-blue-50/30 dark:bg-[#005BAC]/5' : ''}`}>
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 dark:border-gray-800 text-[#005BAC] focus:ring-[#005BAC] cursor-pointer"
                        checked={m.id ? selectedIds.includes(m.id) : false}
                        onChange={() => m.id && toggleSelect(m.id)}
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">
                      {itemsPerPage === 'Semua' ? idx + 1 : (currentPage - 1) * parseInt(itemsPerPage) + idx + 1}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{m.nim}</td>
                    <td className="px-6 py-4 dark:text-gray-200">{m.nama}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{m.prodi}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{m.ttl || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        {(() => {
                          const status = getCombinedStatus(m, bookings);
                          if (status === 'Belum tersedia') {
                            return (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold w-fit bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300">
                                Fisik Belum Tersedia
                              </span>
                            );
                          } else if (status === 'Sudah Booking') {
                            const b = bookings.find(x => x.mahasiswa_id === m.id);
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="px-2.5 py-1 rounded-full text-xs font-semibold w-fit bg-blue-100 dark:bg-blue-950/40 text-[#005BAC] dark:text-blue-300">
                                  Sudah Booking
                                </span>
                                {b && (
                                  <span className="text-[10px] text-[#005BAC] dark:text-blue-400 font-medium">
                                    {b.tanggal} ({b.jam})
                                  </span>
                                )}
                              </div>
                            );
                          } else if (status === 'Sudah diambil') {
                            return (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold w-fit bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                                Sudah Diambil
                              </span>
                            );
                          } else if (status === 'Booking Hangus') {
                            return (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold w-fit bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300">
                                Booking Hangus / Terlewat
                              </span>
                            );
                          } else {
                            return (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold w-fit bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300">
                                Tersedia (Belum Booking)
                              </span>
                            );
                          }
                        })()}
                        {m.status_ktm === 'Belum tersedia' && m.catatan_ktm && (
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 italic font-normal max-w-[180px] break-words" title={m.catatan_ktm}>
                            Note: {m.catatan_ktm}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditingMhs(m)} className="h-8 px-2.5 text-[#005BAC] dark:text-blue-400 hover:bg-[#005BAC]/5">
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {itemsPerPage !== 'Semua' && totalPages > 1 && (
          <div className="border-t border-gray-100 dark:border-gray-800 p-4 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Halaman {currentPage} dari {totalPages}
            </div>
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ConfirmationModal
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={executeBulkDelete}
        title="Hapus Massal Mahasiswa"
        description={`Apakah Anda yakin ingin menghapus ${selectedIds.length} data mahasiswa secara massal? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Hapus Semua"
        cancelText="Batal"
        variant="danger"
      />

      {/* Edit Mahasiswa Modal */}
      {editingMhs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" id="edit-modal">
          <div className="bg-white dark:bg-[#1E1E1E] border dark:border-gray-800 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Edit Data Mahasiswa</h3>
              <button 
                onClick={() => setEditingMhs(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                id="close-edit-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const docRef = doc(db, 'mahasiswa', editingMhs.id);
                const updatedData: Partial<Mahasiswa> = {
                  nim: editingMhs.nim,
                  nama: editingMhs.nama,
                  prodi: editingMhs.prodi,
                  ttl: editingMhs.ttl,
                  status_ktm: editingMhs.status_ktm,
                  catatan_ktm: editingMhs.status_ktm === 'Belum tersedia' ? (editingMhs.catatan_ktm || '') : '',
                  updated_at: serverTimestamp()
                };
                
                await updateDoc(docRef, updatedData);
                toast.success('Berhasil memperbarui data mahasiswa');
                setEditingMhs(null);
              } catch (err) {
                console.error(err);
                toast.error('Gagal memperbarui data');
              }
            }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">NIM</label>
                  <Input 
                    value={editingMhs.nim} 
                    onChange={e => setEditingMhs({...editingMhs, nim: e.target.value})} 
                    required 
                    className="dark:bg-[#2A2A2A] dark:border-gray-800"
                    id="edit-nim"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Nama</label>
                  <Input 
                    value={editingMhs.nama} 
                    onChange={e => setEditingMhs({...editingMhs, nama: e.target.value})} 
                    required 
                    className="dark:bg-[#2A2A2A] dark:border-gray-800"
                    id="edit-nama"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Program Studi</label>
                  <Input 
                    value={editingMhs.prodi} 
                    onChange={e => setEditingMhs({...editingMhs, prodi: e.target.value})} 
                    required 
                    className="dark:bg-[#2A2A2A] dark:border-gray-800"
                    id="edit-prodi"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">TTL / Tanggal Lahir</label>
                  <Input 
                    value={editingMhs.ttl || ''} 
                    onChange={e => setEditingMhs({...editingMhs, ttl: e.target.value})} 
                    required 
                    className="dark:bg-[#2A2A2A] dark:border-gray-800"
                    id="edit-ttl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Status KTM</label>
                <select 
                  className="flex h-10 w-full rounded-xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-[#2A2A2A] px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#005BAC]"
                  value={editingMhs.status_ktm} 
                  onChange={e => setEditingMhs({...editingMhs, status_ktm: e.target.value as any})}
                  id="edit-status"
                >
                  <option value="Tersedia" className="dark:bg-[#1E1E1E]">Tersedia</option>
                  <option value="Belum tersedia" className="dark:bg-[#1E1E1E]">Belum tersedia</option>
                  <option value="Sudah diambil" className="dark:bg-[#1E1E1E]">Sudah diambil</option>
                </select>
              </div>

              {editingMhs.status_ktm === 'Belum tersedia' && (
                <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Catatan untuk KTM Belum Tersedia</label>
                  <Input 
                    placeholder="Contoh: Sedang dalam proses cetak / Ada kendala foto..." 
                    value={editingMhs.catatan_ktm || ''} 
                    onChange={e => setEditingMhs({...editingMhs, catatan_ktm: e.target.value})} 
                    className="w-full dark:bg-[#2A2A2A] dark:border-gray-800" 
                    id="edit-catatan"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditingMhs(null)} id="cancel-edit">Batal</Button>
                <Button type="submit" id="save-edit">Simpan Perubahan</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

