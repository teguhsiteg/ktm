import { useState, FormEvent, useEffect } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UserCircle } from 'lucide-react';

export default function ProfilePage() {
  const { adminData, currentUser } = useAdmin();
  const [nama, setNama] = useState('');
  const [fakultas, setFakultas] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (adminData) {
      setNama(adminData.nama || '');
      setFakultas(adminData.fakultas || '');
    }
  }, [adminData]);

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, 'admins', currentUser.uid), {
        nama,
        fakultas
      });
      toast.success('Profil berhasil diperbarui');
    } catch (err: any) {
      toast.error('Gagal memperbarui profil: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!adminData || !currentUser) {
    return <div>Memuat...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Profil Pengguna</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Ubah informasi akun Anda</p>
        </div>
      </div>

      <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-[#005BAC] dark:text-[#8AB4F8]" />
            Informasi Pribadi
          </CardTitle>
          <p className="text-sm text-gray-500">
            Email tidak dapat diubah
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={currentUser.email || ''} disabled className="bg-gray-100 dark:bg-zinc-800" />
            </div>
            
            <div className="space-y-2">
              <Label>Role</Label>
              <Input type="text" value={adminData.role === 'super_admin' ? 'Super Administrator' : 'Admin Fakultas'} disabled className="bg-gray-100 dark:bg-zinc-800" />
            </div>

            <div className="space-y-2">
              <Label>Nama</Label>
              <Input type="text" value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama lengkap Anda" />
            </div>
            
            {adminData.role !== 'super_admin' && (
              <div className="space-y-2">
                <Label>Kata Kunci Akses Fakultas/Prodi</Label>
                <Input type="text" value={fakultas} onChange={e => setFakultas(e.target.value)} placeholder="Misal: FTI, Informatika" />
                <p className="text-xs text-gray-500">Anda dapat memisahkan dengan koma jika lebih dari satu (misal: "Hukum, FH")</p>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-[#005BAC] hover:bg-[#004A8C] text-white">
              {loading ? 'Menyimpan...' : 'Simpan Profil'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
