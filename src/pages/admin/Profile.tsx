import { useState, FormEvent, useEffect } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { updatePassword } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  UserCircle, 
  Shield, 
  KeyRound, 
  Clock, 
  CheckCircle2, 
  User, 
  Building, 
  Mail, 
  Lock, 
  Check, 
  Eye, 
  EyeOff,
  Activity
} from 'lucide-react';

export default function ProfilePage() {
  const { adminData, currentUser, adminId } = useAdmin();
  const [nama, setNama] = useState('');
  const [fakultas, setFakultas] = useState('');
  const [loading, setLoading] = useState(false);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    if (adminData) {
      setNama(adminData.nama || '');
      setFakultas(adminData.fakultas || '');
    }
  }, [adminData]);

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!nama.trim()) {
      toast.error('Nama lengkap tidak boleh kosong');
      return;
    }
    
    const idToUpdate = adminId || currentUser.uid;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'admins', idToUpdate), {
        nama: nama.trim(),
        fakultas: fakultas.trim()
      });
      toast.success('Profil pribadi berhasil diperbarui');
    } catch (err: any) {
      toast.error('Gagal memperbarui profil: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    if (!newPassword) {
      toast.error('Kata sandi baru wajib diisi');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Kata sandi minimal harus terdiri dari 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi kata sandi tidak cocok');
      return;
    }

    setUpdatingPassword(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast.success('Kata sandi Anda berhasil diperbarui');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        toast.error('Demi keamanan, tindakan ini memerlukan login ulang. Silakan logout lalu login kembali.');
      } else {
        toast.error('Gagal memperbarui kata sandi: ' + err.message);
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (!adminData || !currentUser) {
    return (
      <div className="py-20 text-center text-xs text-gray-500 flex flex-col items-center justify-center gap-2">
        <div className="animate-spin h-5 w-5 border-2 border-[#005BAC] border-t-transparent rounded-full" />
        <span>Memuat data profil...</span>
      </div>
    );
  }

  // Generate initials for avatar
  const initials = nama
    ? nama.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'AD';

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-left">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Akun & Profil Pengguna</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">Atur informasi pribadi, kata sandi, dan lihat hak akses login administrator Anda.</p>
        </div>
      </div>

      {/* Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Avatar & Meta Card */}
        <div className="space-y-6 lg:col-span-1">
          {/* Avatar Details Card */}
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1E1E1E] overflow-hidden rounded-2xl">
            <div className="h-20 bg-gradient-to-r from-[#005BAC] to-blue-600 w-full" />
            <CardContent className="p-5 pt-0 relative flex flex-col items-center text-center">
              {/* Initials Avatar Badge */}
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-800 border-4 border-white dark:border-[#1E1E1E] shadow-md flex items-center justify-center text-lg font-black text-[#005BAC] dark:text-[#8AB4F8] -mt-8 mb-3 z-10 font-mono">
                {initials}
              </div>

              <h2 className="font-bold text-gray-900 dark:text-white text-base leading-tight">{nama || 'Admin Akademik'}</h2>
              <p className="text-[10px] bg-[#005BAC]/10 dark:bg-[#005BAC]/25 text-[#005BAC] dark:text-[#8AB4F8] font-bold px-2 py-0.5 rounded-full mt-1.5 uppercase tracking-wider">
                {adminData.role === 'super_admin' ? '🔥 Super Admin' : 'Admin Fakultas'}
              </p>

              <div className="w-full border-t border-slate-100 dark:border-slate-800/80 mt-5 pt-4 space-y-3.5 text-xs text-left">
                <div className="flex justify-between">
                  <span className="text-gray-400">ID Admin</span>
                  <span className="font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={adminId || currentUser.uid}>
                    {adminId || currentUser.uid}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Hak Akses</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {adminData.role === 'super_admin' ? 'Akses Global (Semua)' : 'Fakultas Terbatas'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fakultas Binaan</span>
                  <span className="font-bold text-gray-700 dark:text-gray-300 text-right">
                    {adminData.role === 'super_admin' ? 'Seluruh Universitas' : (fakultas || '-')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Metrics & Status */}
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1E1E1E] rounded-2xl">
            <div className="bg-[#005BAC]/5 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-xs flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#005BAC]" />
                Log Aktivitas Login
              </h3>
            </div>
            <CardContent className="p-4 space-y-3 text-xs leading-normal">
              <div className="space-y-0.5">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Terakhir Login Terdeteksi</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300 block">
                  {adminData.last_login ? new Date(adminData.last_login).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' WIB' : 'Baru saja'}
                </span>
              </div>
              <div className="space-y-0.5 border-t border-slate-100 dark:border-slate-800/60 pt-2.5">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Terakhir Logout Manual</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300 block">
                  {adminData.last_logout ? new Date(adminData.last_logout).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' WIB' : 'Belum pernah logout manual'}
                </span>
              </div>
              <div className="mt-2.5 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="text-[10px] font-bold">Sesi Terenkripsi SSL Aktif</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Columns: Edit Profile & Change Password Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Information Edit Form Card */}
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1E1E1E] rounded-2xl">
            <div className="bg-[#005BAC]/5 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-xs flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-[#005BAC]" />
                Sunting Informasi Akun Pribadi
              </h3>
            </div>
            <CardContent className="p-5">
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> Email Administrator
                    </Label>
                    <Input 
                      type="email" 
                      value={currentUser.email || ''} 
                      disabled 
                      className="bg-slate-50 dark:bg-zinc-800/40 border-slate-200/60 dark:border-slate-800 cursor-not-allowed text-gray-500 rounded-xl text-xs h-10" 
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" /> Peran / Otoritas Akun
                    </Label>
                    <Input 
                      type="text" 
                      value={adminData.role === 'super_admin' ? 'Super Administrator' : 'Admin Akademik Fakultas'} 
                      disabled 
                      className="bg-slate-50 dark:bg-zinc-800/40 border-slate-200/60 dark:border-slate-800 cursor-not-allowed text-gray-500 rounded-xl text-xs h-10" 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nama" className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> Nama Lengkap Sesuai SK / Penugasan
                  </Label>
                  <Input 
                    id="nama"
                    type="text" 
                    value={nama} 
                    onChange={e => setNama(e.target.value)} 
                    placeholder="Contoh: Budi Santoso, S.T., M.Kom." 
                    className="rounded-xl border-slate-200 focus:ring-[#005BAC] text-xs h-10"
                    required
                  />
                </div>
                
                {adminData.role !== 'super_admin' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fakultas" className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" /> Kode Fakultas Binaan Utama
                    </Label>
                    <Input 
                      id="fakultas"
                      type="text" 
                      value={fakultas} 
                      onChange={e => setFakultas(e.target.value)} 
                      placeholder="Contoh: FTI, FH, FEB" 
                      className="rounded-xl border-slate-200 focus:ring-[#005BAC] text-xs h-10"
                    />
                    <p className="text-[10px] text-gray-400 leading-normal">
                      Memungkinkan sistem menyaring otomatis mahasiswa yang terdaftar di bawah fakultas binaan Anda. Anda dapat memisahkan dengan koma jika mengampu multi-fakultas (Contoh: "FTI, FH").
                    </p>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={loading} className="bg-[#005BAC] hover:bg-[#004B8C] text-white font-semibold text-xs h-10 rounded-xl px-5">
                    {loading ? 'Menyimpan...' : 'Simpan Profil'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security Change Password Card */}
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1E1E1E] rounded-2xl">
            <div className="bg-[#005BAC]/5 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-xs flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#005BAC]" />
                Keamanan Akun & Perbarui Kata Sandi
              </h3>
            </div>
            <CardContent className="p-5">
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 relative">
                    <Label htmlFor="new-pw" className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-gray-400" /> Kata Sandi Baru
                    </Label>
                    <div className="relative">
                      <Input 
                        id="new-pw"
                        type={showPassword ? 'text' : 'password'} 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="rounded-xl border-slate-200 focus:ring-[#005BAC] text-xs h-10 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-pw" className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-gray-400" /> Konfirmasi Kata Sandi Baru
                    </Label>
                    <Input 
                      id="confirm-pw"
                      type={showPassword ? 'text' : 'password'} 
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi kata sandi baru"
                      className="rounded-xl border-slate-200 focus:ring-[#005BAC] text-xs h-10"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={updatingPassword} className="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs h-10 rounded-xl px-5 dark:bg-zinc-700 dark:hover:bg-zinc-600">
                    {updatingPassword ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
