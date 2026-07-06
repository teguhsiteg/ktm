import { useState, useEffect, FormEvent } from 'react';
import { db, app } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Trash2, UserPlus, Shield, UserCog } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

const secondaryApp = initializeApp(app.options, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

interface AdminUser {
  id: string;
  email: string;
  role: string;
  fakultas?: string;
  last_login?: string;
  last_logout?: string;
}

export default function UsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fakultas, setFakultas] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'admins'), (snapshot) => {
      const data: AdminUser[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as AdminUser);
      });
      setAdmins(data);
    });
    return () => unsub();
  }, []);

  const handleCreateAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fakultas) {
      toast.error('Mohon isi email, password, dan fakultas');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = userCredential.user.uid;
      
      await setDoc(doc(db, 'admins', uid), {
        email,
        role: 'admin',
        fakultas
      });

      await signOut(secondaryAuth);
      
      toast.success('Admin Fakultas berhasil ditambahkan');
      setEmail('');
      setPassword('');
      setFakultas('');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        try {
          // User already exists in Auth, just give them admin access
          await setDoc(doc(db, 'admins', email), {
            email,
            role: 'admin',
            fakultas
          });
          toast.success('Email sudah terdaftar. Akses admin berhasil ditambahkan.');
          setEmail('');
          setPassword('');
          setFakultas('');
        } catch (dbError) {
          toast.error('Gagal menambahkan ke database.');
        }
      } else {
        toast.error(`Gagal: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, adminRole: string) => {
    if (adminRole === 'super_admin') {
      toast.error('Super Admin tidak bisa dihapus dari sini');
      return;
    }
    if (confirm('Yakin ingin menghapus akses admin ini? (Data auth tidak terhapus, hanya akses db)')) {
      try {
        await deleteDoc(doc(db, 'admins', id));
        toast.success('Akses admin dicabut');
      } catch (e) {
        toast.error('Gagal mencabut akses');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Manajemen Admin</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Kelola akses admin per Fakultas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#005BAC] dark:text-[#8AB4F8]" />
              Tambah Admin Fakultas
            </CardTitle>
            <p className="text-sm text-gray-500">Buat akun khusus untuk admin fakultas</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin.fti@uii.ac.id" required />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label>Keyword Akses Prodi (Koma jika lebih dari satu)</Label>
                <Input value={fakultas} onChange={e => setFakultas(e.target.value)} placeholder="Misal: FTI, Informatika, Hukum" required />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-[#005BAC] hover:bg-[#004A8C] text-white">
                {loading ? 'Memproses...' : 'Buat Akun'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCog className="w-5 h-5 text-gray-500" />
              Daftar Admin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 bg-gray-50 dark:bg-zinc-800/50 dark:text-gray-400 uppercase">
                  <tr>
                    <th className="px-4 py-3 font-semibold rounded-tl-lg">Email</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Fakultas</th>
                    <th className="px-4 py-3 font-semibold">Aktivitas Terakhir</th>
                    <th className="px-4 py-3 font-semibold text-right rounded-tr-lg">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {admins.map(admin => (
                    <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{admin.email}</td>
                      <td className="px-4 py-3">
                        {admin.role === 'super_admin' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded text-xs font-semibold">
                            <Shield className="w-3 h-3" /> Super Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded text-xs font-semibold">
                            Admin Fakultas
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {admin.fakultas || '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <div className="flex flex-col gap-1">
                          <span className="text-green-600 dark:text-green-400">Login: {admin.last_login ? format(new Date(admin.last_login), "dd MMM yyyy HH:mm", { locale: localeID }) : '-'}</span>
                          <span className="text-gray-500 dark:text-gray-400">Logout: {admin.last_logout ? format(new Date(admin.last_logout), "dd MMM yyyy HH:mm", { locale: localeID }) : '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {admin.role !== 'super_admin' && (
                          <button 
                            onClick={() => handleDelete(admin.id, admin.role)}
                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Hapus Akses"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {admins.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Belum ada data admin.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
