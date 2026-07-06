import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  MapPin, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Building2, 
  Sparkles, 
  AlertCircle, 
  X,
  ChevronLeft,
  ChevronRight,
  Database,
  ArrowRight,
  FileSpreadsheet,
  Download,
  Upload
} from 'lucide-react';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ProdiMapping } from '@/types';
import { PRODI_TO_FACULTY_MAP } from '@/utils/prodiMapping';
import { useAdmin } from '@/contexts/AdminContext';
import * as XLSX from 'xlsx';

export default function LokasiPage() {
  const { adminData } = useAdmin();
  const [mappings, setMappings] = useState<ProdiMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    prodi: '',
    fakultas: '',
    lokasi: ''
  });
  const [selectedStandardProdi, setSelectedStandardProdi] = useState<string>('');

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  // Load mappings from firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'prodi_mapping'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProdiMapping));
      // Sort alphabetically by Fakultas then Prodi
      data.sort((a, b) => {
        if (a.fakultas !== b.fakultas) return a.fakultas.localeCompare(b.fakultas);
        return a.prodi.localeCompare(b.prodi);
      });
      setMappings(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const resetForm = () => {
    setFormData({ prodi: '', fakultas: '', lokasi: '' });
    setSelectedStandardProdi('');
    setEditingId(null);
    setShowAdd(false);
  };

  const handleStandardProdiChange = (prodiName: string) => {
    setSelectedStandardProdi(prodiName);
    if (prodiName === 'custom') {
      setFormData({ prodi: '', fakultas: '', lokasi: '' });
    } else if (prodiName && PRODI_TO_FACULTY_MAP[prodiName]) {
      const info = PRODI_TO_FACULTY_MAP[prodiName];
      setFormData({
        prodi: prodiName,
        fakultas: info.fakultas,
        lokasi: info.lokasi
      });
    } else {
      setFormData({ prodi: '', fakultas: '', lokasi: '' });
    }
  };

  const handleAddOrEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.prodi.trim() || !formData.fakultas.trim() || !formData.lokasi.trim()) {
      toast.error('Harap isi semua kolom formulir');
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'prodi_mapping', editingId), {
          prodi: formData.prodi.trim(),
          fakultas: formData.fakultas.trim(),
          lokasi: formData.lokasi.trim(),
          updated_at: serverTimestamp()
        });
        toast.success('Lokasi pengambilan prodi berhasil diperbarui');
      } else {
        // Check duplicate
        const isDuplicate = mappings.some(
          m => m.prodi.toLowerCase().trim() === formData.prodi.toLowerCase().trim()
        );
        if (isDuplicate) {
          toast.error(`Pemetaan untuk Program Studi "${formData.prodi}" sudah terdaftar.`);
          return;
        }

        await addDoc(collection(db, 'prodi_mapping'), {
          prodi: formData.prodi.trim(),
          fakultas: formData.fakultas.trim(),
          lokasi: formData.lokasi.trim(),
          created_at: serverTimestamp()
        });
        toast.success('Lokasi pengambilan prodi berhasil ditambahkan');
      }
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan pemetaan lokasi');
    }
  };

  const handleEditClick = (m: ProdiMapping) => {
    setFormData({
      prodi: m.prodi,
      fakultas: m.fakultas,
      lokasi: m.lokasi
    });
    // Find standard prodi matching this
    const standardKey = Object.keys(PRODI_TO_FACULTY_MAP).find(
      k => k.toLowerCase().replace(/[\/\s._-]/g, '').trim() === m.prodi.toLowerCase().replace(/[\/\s._-]/g, '').trim()
    );
    if (standardKey) {
      setSelectedStandardProdi(standardKey);
    } else {
      setSelectedStandardProdi('custom');
    }
    setEditingId(m.id || null);
    setShowAdd(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteDoc(doc(db, 'prodi_mapping', deletingId));
      setSelectedIds(prev => prev.filter(id => id !== deletingId));
      toast.success('Pemetaan berhasil dihapus');
      setDeletingId(null);
    } catch (e) {
      console.error(e);
      toast.error('Gagal menghapus pemetaan');
    }
  };

  const executeBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'prodi_mapping', id));
      });
      await batch.commit();
      toast.success(`${selectedIds.length} pemetaan lokasi berhasil dihapus massal`);
      setSelectedIds([]);
      setShowBulkDeleteConfirm(false);
    } catch (e) {
      console.error(e);
      toast.error('Gagal menghapus massal pemetaan lokasi');
    }
  };

  // Seeding default values to firestore
  const seedDefaultMappings = async () => {
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      Object.entries(PRODI_TO_FACULTY_MAP).forEach(([prodiName, info]) => {
        const docRef = doc(collection(db, 'prodi_mapping'));
        batch.set(docRef, {
          prodi: prodiName,
          fakultas: info.fakultas,
          lokasi: info.lokasi,
          created_at: serverTimestamp()
        });
      });
      await batch.commit();
      toast.success('Berhasil mengimpor data pemetaan program studi standar!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal melakukan impor data standar');
    } finally {
      setSeeding(false);
    }
  };

  // Download Excel Template for Program Studi & Fakultas
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          "Program Studi": "Informatika",
          "Fakultas": "Fakultas Teknologi Industri (FTI)",
          "Lokasi Pengambilan KTM": "Kantor Layanan Akademik FTI, Gedung KH. Mas Mansur, Kampus Terpadu UII"
        },
        {
          "Program Studi": "Akuntansi",
          "Fakultas": "Fakultas Bisnis dan Ekonomika (FBE)",
          "Lokasi Pengambilan KTM": "Gedung Ace Partadiredja, Kampus Terpadu UII"
        },
        {
          "Program Studi": "Hukum",
          "Fakultas": "Fakultas Hukum (FH)",
          "Lokasi Pengambilan KTM": "Gedung Moh. Yamin, Kampus Terpadu UII"
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

      // Auto-fit column widths
      const cols = ["Program Studi", "Fakultas", "Lokasi Pengambilan KTM"];
      worksheet["!cols"] = cols.map(col => ({
        wch: Math.max(col.length, ...templateData.map(row => row[col as keyof typeof row]?.length || 0)) + 3
      }));

      XLSX.writeFile(workbook, "template_database_prodi_fakultas.xlsx");
      toast.success("Template Excel berhasil diunduh");
    } catch (error: any) {
      console.error(error);
      toast.error("Gagal mengunduh template: " + error.message);
    }
  };

  // Upload and parse Excel File
  const handleUploadExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingExcel(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (rows.length === 0) {
          toast.error("File Excel tidak memiliki baris data.");
          setUploadingExcel(false);
          return;
        }

        const parsedMappings: Omit<ProdiMapping, 'id'>[] = [];
        for (const row of rows) {
          const prodiRaw = row["Program Studi"] || row["program studi"] || row["Prodi"] || row["prodi"] || row["Program_Studi"];
          const fakultasRaw = row["Fakultas"] || row["fakultas"] || row["Faculty"] || row["faculty"];
          const lokasiRaw = row["Lokasi Pengambilan KTM"] || row["lokasi pengambilan ktm"] || row["Lokasi"] || row["lokasi"] || row["Lokasi Pengambilan"] || row["lokasi_pengambilan"];

          const prodi = prodiRaw?.toString().trim();
          const fakultas = fakultasRaw?.toString().trim();
          const lokasi = lokasiRaw?.toString().trim();

          if (prodi && fakultas && lokasi) {
            parsedMappings.push({ prodi, fakultas, lokasi });
          }
        }

        if (parsedMappings.length === 0) {
          toast.error("Tidak ada data valid. Pastikan kolom sesuai template: 'Program Studi', 'Fakultas', 'Lokasi Pengambilan KTM'");
          setUploadingExcel(false);
          return;
        }

        // Write batch
        const batchChunks = [];
        let currentBatch = writeBatch(db);
        let opCount = 0;
        let successCount = 0;
        let updateCount = 0;

        for (const item of parsedMappings) {
          // Check if mapping exists
          const existing = mappings.find(m => m.prodi.toLowerCase().trim() === item.prodi.toLowerCase().trim());

          if (existing && existing.id) {
            const docRef = doc(db, 'prodi_mapping', existing.id);
            currentBatch.update(docRef, {
              fakultas: item.fakultas,
              lokasi: item.lokasi,
              updated_at: serverTimestamp()
            });
            updateCount++;
          } else {
            const docRef = doc(collection(db, 'prodi_mapping'));
            currentBatch.set(docRef, {
              prodi: item.prodi,
              fakultas: item.fakultas,
              lokasi: item.lokasi,
              created_at: serverTimestamp()
            });
            successCount++;
          }

          opCount++;
          if (opCount === 450) {
            batchChunks.push(currentBatch);
            currentBatch = writeBatch(db);
            opCount = 0;
          }
        }

        if (opCount > 0) {
          batchChunks.push(currentBatch);
        }

        for (const chunk of batchChunks) {
          await chunk.commit();
        }

        toast.success(`Berhasil mengimpor: ${successCount} baru ditambahkan, ${updateCount} diperbarui!`);
      } catch (err: any) {
        console.error(err);
        toast.error("Gagal memproses file Excel: " + (err.message || "format salah"));
      } finally {
        setUploadingExcel(false);
        // Reset file input
        e.target.value = '';
      }
    };

    reader.onerror = () => {
      toast.error("Gagal membaca file.");
      setUploadingExcel(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // Search logic
  const filteredMappings = mappings.filter(m => {
    const term = searchQuery.toLowerCase();
    return (
      m.prodi.toLowerCase().includes(term) ||
      m.fakultas.toLowerCase().includes(term) ||
      m.lokasi.toLowerCase().includes(term)
    );
  });

  const totalFiltered = filteredMappings.length;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalFiltered);
  const paginatedMappings = filteredMappings.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#005BAC]" />
            Database Fakultas & Program Studi (Prodi)
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Kelola daftar program studi, fakultas, dan instruksi lokasi pengambilan KTM secara dinamis tanpa perlu merubah coding aplikasi.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {mappings.length === 0 && !loading && (
            <Button
              onClick={seedDefaultMappings}
              disabled={seeding}
              variant="outline"
              size="sm"
              className="text-amber-600 dark:text-amber-400 border-amber-200/50 hover:bg-amber-50 dark:hover:bg-amber-950/20"
            >
              <Database className="w-4 h-4 mr-2" />
              {seeding ? 'Mengimpor...' : 'Impor Data Standar'}
            </Button>
          )}
          <Button 
            size="sm" 
            onClick={() => {
              if (showAdd) {
                resetForm();
              } else {
                setShowAdd(true);
              }
            }}
            className={showAdd ? 'bg-gray-500 hover:bg-gray-600' : 'bg-[#005BAC] hover:bg-[#004B8C] ml-auto'}
          >
            {showAdd ? 'Batal' : <><Plus className="w-4 h-4 mr-2" /> Tambah Prodi / Fakultas Baru</>}
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <div className="p-4 bg-blue-50/50 dark:bg-[#005BAC]/5 border border-blue-100/30 dark:border-blue-950/20 rounded-2xl flex gap-3 items-start text-left">
        <Building2 className="w-5 h-5 text-[#005BAC] dark:text-[#8AB4F8] shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          <span className="font-bold block text-sm text-[#005BAC] dark:text-[#8AB4F8] mb-1">Pengaturan Database Dinamis</span>
          Seluruh program studi, fakultas, dan instruksi lokasi di sini akan disinkronisasikan ke dalam database cloud (Firestore). Perubahan atau penambahan di halaman ini akan langsung diterapkan secara real-time pada seluruh formulir pendaftaran mahasiswa, filter admin, serta petunjuk lokasi pengambilan KTM tanpa perlu memodifikasi coding.
        </div>
      </div>

      {/* Superadmin Excel Upload & Template Section */}
      {adminData?.role === 'super_admin' && (
        <Card className="border-[#005BAC]/20 dark:border-slate-800 rounded-2xl shadow-sm bg-[#005BAC]/5 dark:bg-[#1E1E1E] overflow-hidden text-left">
          <div className="px-6 py-4 border-b border-[#005BAC]/10 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#005BAC] dark:text-blue-400" />
                Impor Database via Excel (Khusus Superadmin)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Unggah template Excel yang telah diisi untuk menambahkan atau memperbarui data Program Studi & Fakultas secara massal.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleDownloadTemplate}
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-semibold h-9 bg-white dark:bg-zinc-800 border-[#005BAC]/20 hover:bg-[#005BAC]/5 text-[#005BAC] dark:text-blue-400 flex items-center gap-1.5 shrink-0"
            >
              <Download className="w-4 h-4" /> Unduh Template Excel
            </Button>
          </div>
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#005BAC]/20 hover:border-[#005BAC]/40 dark:border-zinc-700 dark:hover:border-zinc-500 rounded-2xl p-6 bg-white dark:bg-zinc-900/50 transition-colors text-center relative">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleUploadExcel}
                disabled={uploadingExcel}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                id="excel-upload-input"
              />
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-[#005BAC]/10 dark:bg-blue-950/30 flex items-center justify-center text-[#005BAC] dark:text-blue-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    {uploadingExcel ? "Sedang memproses file..." : "Pilih atau Seret file Excel Anda di sini"}
                  </span>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Mendukung file .xlsx dan .xls. Pastikan format kolom sesuai dengan template.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Form Card */}
      {showAdd && (
        <Card className="border-[#005BAC]/15 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-[#1E1E1E] overflow-hidden animate-in fade-in-50 slide-in-from-top-3 duration-200">
          <div className="bg-[#005BAC]/5 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#005BAC]" />
              {editingId ? 'Edit Program Studi & Fakultas' : 'Tambah Program Studi & Fakultas Baru'}
            </h3>
          </div>
          <CardContent className="p-6">
            <form onSubmit={handleAddOrEdit} className="space-y-4 text-left">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="select-prodi" className="text-xs font-bold text-gray-600 dark:text-gray-400">Salin dari Templat Standar UII (Opsional)</Label>
                  <select
                    id="select-prodi"
                    value={selectedStandardProdi}
                    onChange={(e) => handleStandardProdiChange(e.target.value)}
                    className="w-full rounded-xl h-10 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-[#005BAC]/30 focus:border-[#005BAC] px-3 bg-white dark:bg-zinc-800 text-xs text-gray-700 dark:text-gray-200 outline-none"
                  >
                    <option value="">-- Pilih Templat (Atau lewati untuk buat baru) --</option>
                    {Object.keys(PRODI_TO_FACULTY_MAP).sort().map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    <option value="custom">✍️ Tulis Kustom Baru...</option>
                  </select>
                  <p className="text-[10px] text-gray-400">Pilih dari templat Program Studi resmi UII untuk mengisi data secara otomatis, atau pilih "Tulis Kustom Baru..." untuk mengetik manual program studi baru Anda.</p>
                </div>

                {/* Show inputs if custom is selected or standard is selected */}
                {(selectedStandardProdi === 'custom' || selectedStandardProdi !== '') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                    <div className="space-y-1.5">
                      <Label htmlFor="prodi" className="text-xs font-bold text-gray-600 dark:text-gray-400">Nama Program Studi</Label>
                      <Input
                        id="prodi"
                        placeholder="Contoh: Informatika, Akuntansi, Teknik Sipil"
                        value={formData.prodi}
                        onChange={(e) => setFormData({ ...formData, prodi: e.target.value })}
                        disabled={selectedStandardProdi !== 'custom'}
                        className={`rounded-xl h-10 border-slate-200 focus:ring-[#005BAC] ${selectedStandardProdi !== 'custom' ? 'bg-slate-50 dark:bg-zinc-800/50 cursor-not-allowed text-gray-500' : ''}`}
                      />
                      <p className="text-[10px] text-gray-400">Harus sama persis dengan yang tertulis di prodi mahasiswa.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fakultas" className="text-xs font-bold text-gray-600 dark:text-gray-400">Nama Fakultas</Label>
                      <Input
                        id="fakultas"
                        placeholder="Contoh: Fakultas Teknologi Industri (FTI)"
                        value={formData.fakultas}
                        onChange={(e) => setFormData({ ...formData, fakultas: e.target.value })}
                        disabled={selectedStandardProdi !== 'custom'}
                        className={`rounded-xl h-10 border-slate-200 focus:ring-[#005BAC] ${selectedStandardProdi !== 'custom' ? 'bg-slate-50 dark:bg-zinc-800/50 cursor-not-allowed text-gray-500' : ''}`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lokasi" className="text-xs font-bold text-gray-600 dark:text-gray-400">Detail Alamat / Lokasi Pengambilan KTM</Label>
                <Input
                  id="lokasi"
                  placeholder="Contoh: Kantor Layanan Akademik FTI, Gedung KH. Mas Mansur, Kampus Terpadu UII"
                  value={formData.lokasi}
                  onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                  className="rounded-xl h-10 border-slate-200 focus:ring-[#005BAC]"
                />
                <p className="text-[10px] text-gray-400">Akan diinformasikan secara detail kepada mahasiswa pada halaman Pencarian KTM, Jadwal Sesi, dan tiket pengambilan.</p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <Button type="button" variant="ghost" onClick={resetForm} className="rounded-xl h-10 text-xs font-semibold px-4">
                  Batal
                </Button>
                <Button type="submit" className="bg-[#005BAC] hover:bg-[#004B8C] rounded-xl h-10 text-xs font-semibold px-5">
                  {editingId ? 'Simpan Perubahan' : 'Tambah Prodi & Fakultas'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Main Table / Empty State Card */}
      {loading ? (
        <div className="py-20 text-center text-gray-500">Memuat database program studi & fakultas...</div>
      ) : mappings.length === 0 ? (
        <Card className="border-dashed border-slate-300 dark:border-slate-800 py-16 text-center bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-slate-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Tidak Ada Data Program Studi</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-4">
                Anda belum menetapkan program studi dan fakultas khusus. Klik tombol di bawah ini untuk memuat seluruh 29 program studi standar UII secara otomatis ke dalam database Anda.
              </p>
            </div>
            <Button onClick={seedDefaultMappings} disabled={seeding} className="bg-[#005BAC] hover:bg-[#004B8C] rounded-xl text-xs font-semibold px-5 py-2">
              {seeding ? 'Memproses Impor...' : 'Impor 29 Program Studi Standar UII'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Selected Rows Action Bar */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 p-4 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400 font-semibold">
                <span>Terpilih <strong>{selectedIds.length}</strong> program studi</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setSelectedIds([])}
                  variant="ghost" 
                  size="sm"
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 text-xs font-semibold h-9 rounded-xl"
                >
                  Batal
                </Button>
                <Button 
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  variant="destructive" 
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold px-4 h-9 flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" /> Hapus Terpilih
                </Button>
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <Input
                placeholder="Cari prodi, fakultas, atau lokasi pengambilan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl border-slate-200/80 dark:border-slate-800 text-xs focus:ring-[#005BAC] w-full"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Menampilkan {totalFiltered === 0 ? 0 : startIndex + 1} - {endIndex} dari {totalFiltered} data</span>
              <select 
                value={itemsPerPage} 
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="bg-gray-50 dark:bg-zinc-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-gray-600 dark:text-gray-300 focus:outline-none"
              >
                <option value={5}>5 baris</option>
                <option value={10}>10 baris</option>
                <option value={25}>25 baris</option>
                <option value={50}>50 baris</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-4 w-12 text-center">
                      <input 
                        type="checkbox"
                        checked={paginatedMappings.length > 0 && paginatedMappings.every(m => selectedIds.includes(m.id || ''))}
                        onChange={() => {
                          const pageIds = paginatedMappings.map(m => m.id || '').filter(Boolean);
                          const isAllSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
                          if (isAllSelected) {
                            setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
                          } else {
                            setSelectedIds(prev => {
                              const union = [...prev];
                              pageIds.forEach(id => {
                                if (!union.includes(id)) union.push(id);
                              });
                              return union;
                            });
                          }
                        }}
                        className="rounded border-gray-300 dark:border-zinc-700 text-[#005BAC] focus:ring-[#005BAC] w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-4">Program Studi</th>
                    <th className="px-6 py-4">Fakultas</th>
                    <th className="px-6 py-4">Lokasi Pengambilan KTM</th>
                    <th className="px-6 py-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {paginatedMappings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                        Tidak ada pemetaan lokasi yang cocok dengan pencarian Anda.
                      </td>
                    </tr>
                  ) : (
                    paginatedMappings.map((m) => {
                      const isSelected = selectedIds.includes(m.id || '');
                      return (
                        <tr 
                          key={m.id} 
                          className={`hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors ${isSelected ? 'bg-[#005BAC]/5 dark:bg-[#005BAC]/5' : ''}`}
                        >
                          <td className="px-6 py-4 w-12 text-center">
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const id = m.id || '';
                                if (!id) return;
                                setSelectedIds(prev => 
                                  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                                );
                              }}
                              className="rounded border-gray-300 dark:border-zinc-700 text-[#005BAC] focus:ring-[#005BAC] w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                            {m.prodi}
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">
                            {m.fakultas}
                          </td>
                          <td className="px-6 py-4 max-w-sm text-gray-600 dark:text-gray-300 leading-normal font-semibold">
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[#005BAC] dark:text-[#8AB4F8] shrink-0 mt-0.5" />
                              <span>{m.lokasi}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleEditClick(m)}
                                className="w-8 h-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-[#005BAC] dark:text-blue-400 rounded-lg"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setDeletingId(m.id || null)}
                                className="w-8 h-8 p-0 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg"
                                title="Hapus"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-slate-50 dark:bg-zinc-900/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg h-8 px-3 border-slate-200 dark:border-slate-700 text-xs"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Sebelum
                </Button>
                
                <span className="text-xs text-gray-500 font-medium">
                  Halaman {currentPage} dari {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg h-8 px-3 border-slate-200 dark:border-slate-700 text-xs"
                >
                  Berikut <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation modal for delete */}
      <ConfirmationModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={executeDelete}
        title="Hapus Pemetaan Lokasi"
        description="Apakah Anda yakin ingin menghapus pemetaan lokasi untuk program studi ini? Hal ini dapat mengakibatkan mahasiswa program studi ini kembali mendapatkan informasi lokasi pengambilan default."
        confirmText="Ya, Hapus"
        cancelText="Batal"
      />

      {/* Confirmation modal for bulk delete */}
      <ConfirmationModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={executeBulkDelete}
        title="Hapus Massal Pemetaan Lokasi"
        description={`Apakah Anda yakin ingin menghapus ${selectedIds.length} pemetaan lokasi terpilih? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Hapus Semua"
        cancelText="Batal"
      />
    </div>
  );
}
