import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { Booking, Mahasiswa } from '@/types';
import { format, parseISO } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { Download, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CheckSquare, Trash2, Check, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { isBookingExpired } from '@/lib/utils';

export default function BookingPage() {
  const [bookings, setBookings] = useState<(Booking & { mhs?: Mahasiswa })[]>([]);
  const [mahasiswaMap, setMahasiswaMap] = useState<Record<string, Mahasiswa>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  const [filter, setFilter] = useState({ search: '', status: 'Semua', tanggal: '', sesi: 'Semua', prodi: 'Semua' });

  const uniqueSessions = useMemo(() => {
    const sessions = bookings.map(b => b.jam).filter(Boolean);
    return Array.from(new Set(sessions)).sort();
  }, [bookings]);

  const uniqueProdis = useMemo(() => {
    const prodis = bookings.map(b => mahasiswaMap[b.mahasiswa_id]?.prodi).filter(Boolean);
    return Array.from(new Set(prodis)).sort();
  }, [bookings, mahasiswaMap]);

  // Pagination & Sorting
  const [itemsPerPage, setItemsPerPage] = useState<'10' | '20' | '30' | 'Semua'>('10');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    // Fetch mahasiswa mapping first
    const unsubMhs = onSnapshot(collection(db, 'mahasiswa'), (snap) => {
      const mMap: Record<string, Mahasiswa> = {};
      snap.docs.forEach(d => {
        mMap[d.id] = { id: d.id, ...d.data() } as Mahasiswa;
      });
      setMahasiswaMap(mMap);
    });

    // Fetch bookings
    const q = query(collection(db, 'booking'), orderBy('created_at', 'desc'));
    const unsubBooking = onSnapshot(q, (snap) => {
      const bList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
      
      // Auto-expire bookings in database
      const expiredToUpdate = bList.filter(b => b.status === 'Belum Diambil' && isBookingExpired(b.tanggal, b.jam));
      if (expiredToUpdate.length > 0) {
        const batch = writeBatch(db);
        expiredToUpdate.forEach(b => {
          batch.update(doc(db, 'booking', b.id), { status: 'Hangus' });
        });
        batch.commit().catch(err => console.error('Failed to auto-expire bookings:', err));
      }

      setBookings(bList);
      setLoading(false);
    });

    return () => {
      unsubMhs();
      unsubBooking();
    };
  }, []);

  const formatClaimTime = (updated_at: any) => {
    if (!updated_at) return '-';
    try {
      if (typeof updated_at.toDate === 'function') {
        return format(updated_at.toDate(), 'dd MMM yyyy HH:mm', { locale: localeID });
      }
      if (updated_at.seconds) {
        return format(new Date(updated_at.seconds * 1000), 'dd MMM yyyy HH:mm', { locale: localeID });
      }
      if (updated_at instanceof Date) {
        return format(updated_at, 'dd MMM yyyy HH:mm', { locale: localeID });
      }
      if (typeof updated_at === 'string') {
        return format(parseISO(updated_at), 'dd MMM yyyy HH:mm', { locale: localeID });
      }
    } catch (e) {
      console.error('Error formatting updated_at:', e);
    }
    return '-';
  };

  const processedData = useMemo(() => {
    let result = bookings.map(b => ({ ...b, mhs: mahasiswaMap[b.mahasiswa_id] }))
      .filter(b => {
        if (filter.status !== 'Semua' && b.status !== filter.status) return false;
        if (filter.tanggal && b.tanggal !== filter.tanggal) return false;
        if (filter.sesi && filter.sesi !== 'Semua' && b.jam !== filter.sesi) return false;
        if (filter.prodi && filter.prodi !== 'Semua' && b.mhs?.prodi !== filter.prodi) return false;
        if (filter.search) {
          const s = filter.search.toLowerCase();
          const matchName = b.mhs?.nama?.toLowerCase().includes(s);
          const matchNim = b.mhs?.nim?.toLowerCase().includes(s);
          const matchBookingId = b.booking_id?.toLowerCase().includes(s);
          if (!matchName && !matchNim && !matchBookingId) return false;
        }
        return true;
      });

    if (sortConfig) {
      result.sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';

        if (sortConfig.key === 'booking_id') {
          aValue = a.booking_id || '';
          bValue = b.booking_id || '';
        } else if (sortConfig.key === 'nim') {
          aValue = a.mhs?.nim || '';
          bValue = b.mhs?.nim || '';
        } else if (sortConfig.key === 'mahasiswa') {
          aValue = a.mhs?.nama || '';
          bValue = b.mhs?.nama || '';
        } else if (sortConfig.key === 'wa') {
          aValue = a.wa || '';
          bValue = b.wa || '';
        } else if (sortConfig.key === 'jadwal') {
          aValue = `${a.tanggal} ${a.jam}`;
          bValue = `${b.tanggal} ${b.jam}`;
        } else if (sortConfig.key === 'status') {
          aValue = a.status || '';
          bValue = b.status || '';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default sorting: Sort chronologically by schedule date (tanggal) asc, then session (jam) asc, then student name asc
      result.sort((a, b) => {
        const dateA = a.tanggal || '';
        const dateB = b.tanggal || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);

        const timeA = a.jam || '';
        const timeB = b.jam || '';
        if (timeA !== timeB) return timeA.localeCompare(timeB);

        const nameA = a.mhs?.nama || '';
        const nameB = b.mhs?.nama || '';
        return nameA.localeCompare(nameB);
      });
    }

    return result;
  }, [bookings, mahasiswaMap, filter, sortConfig]);

  const totalPages = itemsPerPage === 'Semua' ? 1 : Math.ceil(processedData.length / parseInt(itemsPerPage));
  const currentData = itemsPerPage === 'Semua' 
    ? processedData 
    : processedData.slice((currentPage - 1) * parseInt(itemsPerPage), currentPage * parseInt(itemsPerPage));

  // Check if all current page items are selected
  const isAllSelected = currentData.length > 0 && currentData.every(b => b.id && selectedIds.includes(b.id));

  // Toggle selection for all items on current page
  const toggleSelectAll = () => {
    if (isAllSelected) {
      const pageIds = currentData.map(b => b.id!).filter(Boolean);
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      const pageIds = currentData.map(b => b.id!).filter(Boolean);
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
        batch.delete(doc(db, 'booking', id));
      });
      await batch.commit();
      toast.success(`Berhasil menghapus ${selectedIds.length} data booking`);
      setSelectedIds([]);
    } catch (e) {
      console.error('Failed to bulk delete:', e);
      toast.error('Gagal menghapus data secara massal');
    }
  };

  const handleBulkUpdateStatus = async (status: 'Belum Diambil' | 'Sudah Diambil') => {
    if (selectedIds.length === 0) return;

    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const b = bookings.find(item => item.id === id);
        batch.update(doc(db, 'booking', id), {
          status: status,
          updated_at: serverTimestamp()
        });
        
        if (b) {
          if (status === 'Sudah Diambil') {
            batch.update(doc(db, 'mahasiswa', b.mahasiswa_id), {
              status_ktm: 'Sudah diambil',
              tanggal_ambil: serverTimestamp()
            });
          } else {
            batch.update(doc(db, 'mahasiswa', b.mahasiswa_id), {
              status_ktm: 'Tersedia',
              tanggal_ambil: null
            });
          }
        }
      });
      await batch.commit();
      toast.success(`Berhasil memperbarui status ${selectedIds.length} booking menjadi "${status}"`);
      setSelectedIds([]);
    } catch (e) {
      console.error('Failed to bulk update status:', e);
      toast.error('Gagal memperbarui status secara massal');
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, itemsPerPage]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1 inline-block" /> : <ChevronDown className="w-4 h-4 ml-1 inline-block" />;
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const allBookingsWithMhs = bookings.map(b => ({
        ...b,
        mhs: mahasiswaMap[b.mahasiswa_id]
      }));

      const sortFunction = (a: any, b: any) => {
        const dateA = a.tanggal || '';
        const dateB = b.tanggal || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);

        const timeA = a.jam || '';
        const timeB = b.jam || '';
        if (timeA !== timeB) return timeA.localeCompare(timeB);

        const nameA = a.mhs?.nama || '';
        const nameB = b.mhs?.nama || '';
        return nameA.localeCompare(nameB);
      };

      const sudahDiambilList = allBookingsWithMhs.filter(b => b.status === 'Sudah Diambil').sort(sortFunction);
      const belumDiambilList = allBookingsWithMhs.filter(b => b.status !== 'Sudah Diambil').sort(sortFunction);

      const formatRow = (b: any) => ({
        'Booking ID': b.booking_id,
        'NIM': b.mhs?.nim || '-',
        'Nama': b.mhs?.nama || '-',
        'Program Studi': b.mhs?.prodi || '-',
        'No WA': b.wa,
        'Tanggal Jadwal': b.tanggal,
        'Jam Jadwal': b.jam,
        'Status Booking': b.status,
        'Waktu Diambil': b.status === 'Sudah Diambil' ? formatClaimTime(b.updated_at) : '-'
      });

      const dataSudahDiambil = sudahDiambilList.map(formatRow);
      const dataBelumDiambil = belumDiambilList.map(formatRow);

      const wb = XLSX.utils.book_new();

      // Tab 1: Sudah Diambil
      const wsSudah = XLSX.utils.json_to_sheet(dataSudahDiambil);
      XLSX.utils.book_append_sheet(wb, wsSudah, "Sudah Diambil");

      // Tab 2: Belum Diambil & Lainnya
      const wsBelum = XLSX.utils.json_to_sheet(dataBelumDiambil);
      XLSX.utils.book_append_sheet(wb, wsBelum, "Belum Diambil");

      XLSX.writeFile(wb, "Export_Laporan_KTM.xlsx");
      toast.success('Berhasil export semua data booking (2 Sheet)');
    } catch (error) {
      console.error(error);
      toast.error('Gagal export data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 w-full justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-[#005BAC]/10 text-[#005BAC] dark:text-[#8AB4F8] rounded-xl">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Data Booking</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Menampilkan {currentData.length} dari {processedData.length} data
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <Button onClick={handleExport} disabled={exporting || processedData.length === 0} variant="outline" size="sm" className="rounded-xl w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export Filtered Data'}
            </Button>
          </div>
        </div>
      </div>

      <Card className="bg-white dark:bg-[#1E1E1E] dark:border-gray-800">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-3">
            <Input 
              placeholder="Cari Nama, NIM, ID..." 
              value={filter.search}
              onChange={e => setFilter({ ...filter, search: e.target.value })}
              className="w-full dark:bg-[#2A2A2A] dark:border-gray-800"
            />
          </div>
          <div className="md:col-span-2">
            <Input
              type="date"
              value={filter.tanggal}
              onChange={e => setFilter({ ...filter, tanggal: e.target.value })}
              className="w-full dark:bg-[#2A2A2A] dark:border-gray-800"
            />
          </div>
          <div className="md:col-span-2">
            <select 
              className="flex h-10 w-full rounded-xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-[#2A2A2A] px-4 py-2 text-sm text-gray-900 dark:text-gray-100"
              value={filter.prodi}
              onChange={e => setFilter({ ...filter, prodi: e.target.value })}
            >
              <option value="Semua" className="dark:bg-[#1E1E1E]">Semua Prodi</option>
              {uniqueProdis.map(prodi => (
                <option key={prodi} value={prodi} className="dark:bg-[#1E1E1E]">{prodi}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <select 
              className="flex h-10 w-full rounded-xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-[#2A2A2A] px-2 py-2 text-sm text-gray-900 dark:text-gray-100"
              value={filter.sesi}
              onChange={e => setFilter({ ...filter, sesi: e.target.value })}
            >
              <option value="Semua" className="dark:bg-[#1E1E1E]">Sesi</option>
              {uniqueSessions.map(session => (
                <option key={session} value={session} className="dark:bg-[#1E1E1E]">{session}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <select 
              className="flex h-10 w-full rounded-xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-[#2A2A2A] px-4 py-2 text-sm text-gray-900 dark:text-gray-100"
              value={filter.status}
              onChange={e => setFilter({ ...filter, status: e.target.value })}
            >
              <option value="Semua" className="dark:bg-[#1E1E1E]">Semua Status</option>
              <option value="Belum Diambil" className="dark:bg-[#1E1E1E]">Belum Diambil</option>
              <option value="Sudah Diambil" className="dark:bg-[#1E1E1E]">Sudah Diambil</option>
              <option value="Hangus" className="dark:bg-[#1E1E1E]">Hangus</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <select 
              value={itemsPerPage}
              onChange={e => setItemsPerPage(e.target.value as any)}
              className="flex h-10 w-full rounded-xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-[#2A2A2A] px-2 py-2 text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
            >
              <option value="10">10 / hal</option>
              <option value="20">20 / hal</option>
              <option value="30">30 / hal</option>
              <option value="Semua">Semua</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#005BAC]/5 border border-[#005BAC]/15 p-4 rounded-xl shadow-sm transition-all animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#005BAC] dark:text-blue-300">
              Terpilih <strong>{selectedIds.length}</strong> booking
            </span>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
            <Button 
              size="sm" 
              variant="outline"
              className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
              onClick={() => handleBulkUpdateStatus('Sudah Diambil')}
            >
              Set Sudah Diambil
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-950/40"
              onClick={() => handleBulkUpdateStatus('Belum Diambil')}
            >
              Set Belum Diambil
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
            <thead className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 uppercase">
              <tr>
                <th className="w-12 px-6 py-3.5">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 dark:border-gray-800 text-[#005BAC] focus:ring-[#005BAC] cursor-pointer"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 font-medium">No</th>
                <th className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('booking_id')}>
                  Booking ID <SortIndicator columnKey="booking_id" />
                </th>
                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <span className="cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1" onClick={() => handleSort('mahasiswa')}>
                      Nama <SortIndicator columnKey="mahasiswa" />
                    </span>
                    <span className="text-gray-300 dark:text-gray-700">|</span>
                    <span className="cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1" onClick={() => handleSort('nim')}>
                      NIM <SortIndicator columnKey="nim" />
                    </span>
                  </div>
                </th>
                <th className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('wa')}>
                  WA <SortIndicator columnKey="wa" />
                </th>
                <th className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('jadwal')}>
                  Jadwal <SortIndicator columnKey="jadwal" />
                </th>
                <th className="px-6 py-3 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('status')}>
                  Status <SortIndicator columnKey="status" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-4 text-center dark:text-gray-400">Memuat data...</td></tr>
              ) : currentData.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-4 text-center dark:text-gray-400">Data kosong</td></tr>
              ) : (
                currentData.map((b, idx) => (
                  <tr key={b.id} className={`hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors duration-150 ${b.id && selectedIds.includes(b.id) ? 'bg-blue-50/30 dark:bg-[#005BAC]/5' : ''}`}>
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 dark:border-gray-800 text-[#005BAC] focus:ring-[#005BAC] cursor-pointer"
                        checked={b.id ? selectedIds.includes(b.id) : false}
                        onChange={() => b.id && toggleSelect(b.id)}
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">
                      {itemsPerPage === 'Semua' ? idx + 1 : (currentPage - 1) * parseInt(itemsPerPage) + idx + 1}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-[#005BAC] dark:text-[#8AB4F8] font-bold">{b.booking_id}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{b.mhs?.nama}</div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">{b.mhs?.nim} • {b.mhs?.prodi}</div>
                    </td>
                    <td className="px-6 py-4 dark:text-gray-200">
                      {(() => {
                        const formattedTanggal = (() => {
                          try {
                            return format(parseISO(b.tanggal), 'd MMMM yyyy', { locale: localeID });
                          } catch (e) {
                            return b.tanggal;
                          }
                        })();
                        const cleanJam = b.jam.toLowerCase().includes('wib') ? b.jam : `${b.jam} WIB`;
                        const waText = `Halo ${b.mhs?.nama || ''} ${b.mhs?.nim || ''}, Kami dari Admin Distribusi KTM UII. Kami ingin menginformasikan jadwal pengambilan KTM Anda yang telah terkonfirmasi pada:\n\n📅 Tanggal: ${formattedTanggal}\n⏰ Sesi Waktu: ${cleanJam}\n\nMohon hadir tepat waktu dan siapkan QR Tiket Anda. Terima kasih!`;
                        const cleanNumber = (b.wa || '').replace(/\D/g, '');
                        const waPhone = cleanNumber.startsWith('0') ? '62' + cleanNumber.slice(1) : cleanNumber;
                        return (
                          <a href={`https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
                            {b.wa}
                          </a>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{format(parseISO(b.tanggal), 'dd MMM yyyy', { locale: localeID })}</div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">{b.jam}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-xs font-medium ${
                          b.status === 'Sudah Diambil' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300' :
                          b.status === 'Hangus' ? 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300' :
                          'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                        }`}>
                          {b.status === 'Sudah Diambil' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                          {b.status}
                        </span>
                        {b.status === 'Sudah Diambil' && b.updated_at && (
                          <span className="text-[10px] text-gray-500 dark:text-gray-400">
                            Diambil: {formatClaimTime(b.updated_at)}
                          </span>
                        )}
                      </div>
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
        title="Hapus Massal Booking"
        description={`Apakah Anda yakin ingin menghapus ${selectedIds.length} data booking secara massal? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Hapus Semua"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
}
