import { useState, useEffect, FormEvent } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAdmin } from '@/contexts/AdminContext';
import { Navigate } from 'react-router-dom';
import { 
  Settings, 
  Save, 
  HelpCircle, 
  Sliders, 
  ShieldAlert, 
  Clock, 
  Phone, 
  Mail, 
  GraduationCap, 
  Power, 
  Database, 
  Trash2, 
  RefreshCw,
  Info
} from 'lucide-react';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { GlobalSettings, defaultSettings } from '@/types';


export default function PengaturanPage() {
  const { adminData, loadingAdmin } = useAdmin();
  const [settings, setSettings] = useState<GlobalSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load global settings
  useEffect(() => {
    if (loadingAdmin) return;

    async function loadSettings() {
      try {
        const docRef = doc(db, 'settings', 'global');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setSettings({ ...defaultSettings, ...snap.data() });
        } else {
          // Initialize defaults in firestore if authenticated
          if (adminData) {
            try {
              await setDoc(docRef, defaultSettings);
            } catch (writeError) {
              console.warn('Failed to auto-initialize settings in Firestore (using defaults locally):', writeError);
            }
          }
          setSettings(defaultSettings);
        }
      } catch (e) {
        console.error('Error loading settings:', e);
        toast.error('Gagal memuat pengaturan sistem global');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [loadingAdmin, adminData]);

  // Guard access
  if (loadingAdmin) {
    return <div className="p-8 text-center text-xs text-gray-500">Memverifikasi otorisasi admin...</div>;
  }

  if (adminData?.role !== 'super_admin') {
    toast.error('Akses ditolak: Hanya Super Admin yang diizinkan membuka menu ini.');
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
      toast.success('Pengaturan sistem berhasil diperbarui secara global');
    } catch (e) {
      console.error(e);
      toast.error('Gagal menyimpan konfigurasi sistem');
    } finally {
      setSaving(false);
    }
  };

  const handleClearBookings = async () => {
    setClearing(true);
    try {
      // Clear bookings collection
      const snap = await getDocs(collection(db, 'booking'));
      if (snap.empty) {
        toast.info('Tidak ada data booking mahasiswa yang perlu dibersihkan');
        setClearing(false);
        setShowClearConfirm(false);
        return;
      }

      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
      toast.success(`Berhasil membersihkan ${snap.size} data booking transaksi.`);
      setShowClearConfirm(false);
    } catch (e) {
      console.error(e);
      toast.error('Gagal membersihkan data booking');
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
        <RefreshCw className="w-6 h-6 animate-spin text-[#005BAC]" />
        <span className="text-xs">Memuat setelan sistem...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5 text-left">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#005BAC]" />
            Pengaturan Khusus Super Admin
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Konfigurasi parameter global aplikasi, kontrol gerbang registrasi booking KTM, term akademik, dan manajemen data.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Row 1: Active Booking & Academic Year */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-[#005BAC]/15 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-[#1E1E1E]">
            <div className="bg-[#005BAC]/5 px-5 py-4 border-b border-slate-100 dark:border-slate-800 text-left">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-xs flex items-center gap-2">
                <Power className="w-4 h-4 text-[#005BAC]" />
                Status Gerbang Booking KTM
              </h3>
            </div>
            <CardContent className="p-5 space-y-4 text-left">
              <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-zinc-800/30 rounded-xl border border-gray-100 dark:border-zinc-800">
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100">Portal Booking KTM</p>
                  <p className="text-[10px] text-gray-500">Aktifkan untuk mengizinkan mahasiswa melakukan booking jadwal pengambilan.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings(prev => ({ ...prev, booking_active: !prev.booking_active }))}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                    settings.booking_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-700'
                  }`}
                  id="toggle-booking"
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      settings.booking_active ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl flex gap-2 items-start">
                <Info className="w-4 h-4 text-[#005BAC] shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-normal">
                  Jika dinonaktifkan, mahasiswa yang mengakses halaman pencarian KTM akan melihat pengumuman bahwa gerbang pendaftaran/booking ditutup sementara.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#005BAC]/15 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-[#1E1E1E]">
            <div className="bg-[#005BAC]/5 px-5 py-4 border-b border-slate-100 dark:border-slate-800 text-left">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-xs flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#005BAC]" />
                Term & Tahun Akademik Aktif
              </h3>
            </div>
            <CardContent className="p-5 space-y-4 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tahun_akademik" className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Tahun Akademik</Label>
                  <Input
                    id="tahun_akademik"
                    value={settings.tahun_akademik}
                    onChange={(e) => setSettings(prev => ({ ...prev, tahun_akademik: e.target.value }))}
                    placeholder="Contoh: 2026/2027"
                    className="rounded-xl h-10 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="semester" className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Semester</Label>
                  <select
                    id="semester"
                    value={settings.semester}
                    onChange={(e) => setSettings(prev => ({ ...prev, semester: e.target.value }))}
                    className="w-full rounded-xl h-10 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-[#005BAC]/30 focus:border-[#005BAC] px-3 bg-white dark:bg-zinc-800 text-xs"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                    <option value="Antara">Antara</option>
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-gray-400">Konfigurasi ini digunakan sebagai label validitas utama pada kop surat dan halaman tiket pengambilan KTM.</p>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Operational Hours & Contact Help */}
        <Card className="border-[#005BAC]/15 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-[#1E1E1E]">
          <div className="bg-[#005BAC]/5 px-5 py-4 border-b border-slate-100 dark:border-slate-800 text-left">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-xs flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#005BAC]" />
              Detail Informasi Operasional & Kontak Bantuan (Helpline)
            </h3>
          </div>
          <CardContent className="p-5 space-y-4 text-left">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="operasional_jam" className="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  Jam Operasional Default
                </Label>
                <Input
                  id="operasional_jam"
                  value={settings.operasional_jam}
                  onChange={(e) => setSettings(prev => ({ ...prev, operasional_jam: e.target.value }))}
                  placeholder="Contoh: 08:00 - 15:00 WIB"
                  className="rounded-xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="whatsapp_help" className="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                  No. WhatsApp (Format Negara)
                </Label>
                <Input
                  id="whatsapp_help"
                  value={settings.whatsapp_help}
                  onChange={(e) => setSettings(prev => ({ ...prev, whatsapp_help: e.target.value }))}
                  placeholder="Contoh: 628123456789"
                  className="rounded-xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email_help" className="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-blue-500" />
                  Email Support Akademik
                </Label>
                <Input
                  id="email_help"
                  type="email"
                  value={settings.email_help}
                  onChange={(e) => setSettings(prev => ({ ...prev, email_help: e.target.value }))}
                  placeholder="Contoh: akademik@uii.ac.id"
                  className="rounded-xl h-10 text-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="instruksi_tambahan" className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Instruksi Tambahan (Ditampilkan pada Halaman Tiket Pengambilan)</Label>
              <textarea
                id="instruksi_tambahan"
                rows={3}
                value={settings.instruksi_tambahan}
                onChange={(e) => setSettings(prev => ({ ...prev, instruksi_tambahan: e.target.value }))}
                placeholder="Tuliskan instruksi tambahan untuk mahasiswa saat pengambilan KTM..."
                className="w-full text-xs p-3 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-[#005BAC] focus:border-[#005BAC] bg-transparent outline-none"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#005BAC] hover:bg-[#004B8C] text-white rounded-xl h-10 px-6 font-semibold text-xs flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Simpan Konfigurasi Sistem
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Dangerous/Utility Settings */}
      <Card className="border-red-200 dark:border-red-950 rounded-2xl shadow-sm bg-red-50/10 dark:bg-red-950/5">
        <div className="bg-red-500/5 px-5 py-4 border-b border-red-200/50 dark:border-red-900/30 text-left flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <h3 className="font-bold text-red-700 dark:text-red-400 text-xs">
            Zona Bahaya & Pemeliharaan Sistem (Maintenance Area)
          </h3>
        </div>
        <CardContent className="p-5 text-left space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white dark:bg-[#1E1E1E] border border-red-100 dark:border-red-900/20 rounded-xl">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-gray-400" />
                Reset Data Registrasi Booking KTM
              </h4>
              <p className="text-[10px] text-gray-500">Menghapus semua data registrasi booking dari mahasiswa yang sudah masuk dalam sistem untuk periode ini.</p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shrink-0"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Bersihkan Semua Booking
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation modal for database clearing */}
      <ConfirmationModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearBookings}
        title="Konfirmasi Reset Data Booking KTM"
        description="Apakah Anda benar-benar yakin ingin membersihkan seluruh data reservasi/booking pengambilan KTM mahasiswa dari sistem? Tindakan ini bersifat permanen dan tidak dapat dibatalkan!"
        confirmText="Ya, Reset Semua"
        cancelText="Batal"
      />
    </div>
  );
}
