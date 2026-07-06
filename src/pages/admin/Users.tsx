import { useState, useEffect, FormEvent } from 'react';
import { db, app } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Trash2, Pencil, UserPlus, Shield, UserCog, X } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

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

const LIST_FAKULTAS = [
  'Fakultas Teknologi Industri (FTI)',
  'Fakultas Teknik Sipil dan Perencanaan (FTSP)',
  'Fakultas Matematika dan Ilmu Pengetahuan Alam (FMIPA)',
  'Fakultas Kedokteran (FK)',
  'Fakultas Hukum (FH)',
  'Fakultas Bisnis dan Ekonomika (FBE)',
  'Fakultas Psikologi',
  'Fakultas Ilmu Agama Islam (FIAI)',
  'Fakultas Ilmu Sosial Budaya',
  'Universitas Islam Indonesia'
];

export default function UsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [fakultas, setFakultas] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [dbFaculties, setDbFaculties] = useState<string[]>([]);

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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'prodi_mapping'), (snapshot) => {
      const facs = new Set<string>();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.fakultas) {
          facs.add(data.fakultas.trim());
        }
      });
      setDbFaculties(Array.from(facs).sort());
    });
    return () => unsub();
  }, []);

  const selectOptions = dbFaculties.length > 0 ? dbFaculties : LIST_FAKULTAS;

  const handleSaveAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !role) {
      toast.error('Mohon isi email dan role');
      return;
    }
    if (role === 'admin' && !fakultas) {
      toast.error('Mohon pilih fakultas untuk Admin Fakultas');
      return;
    }

    setLoading(true);
    try {
      if (editingAdmin) {
        // UPDATE (Edit Mode)
        await setDoc(doc(db, 'admins', editingAdmin.id), {
          email,
          role,
          fakultas: role === 'super_admin' ? 'Semua' : fakultas
        }, { merge: true });

        toast.success('Akses admin berhasil diperbarui');
        resetForm();
      } else {
        // CREATE (Tambah Mode)
        if (!password) {
          toast.error('Mohon isi password');
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const uid = userCredential.user.uid;
        
        await setDoc(doc(db, 'admins', uid), {
          email,
          role,
          fakultas: role === 'super_admin' ? 'Semua' : fakultas
        });

        await signOut(secondaryAuth);
        
        toast.success('Admin Fakultas berhasil ditambahkan');
        resetForm();
      }
    } catch (error: any) {
      console.error(error);
      if (!editingAdmin && error.code === 'auth/email-already-in-use') {
        try {
          // User already exists in Auth, just give them admin access
          await setDoc(doc(db, 'admins', email), {
            email,
            role,
            fakultas: role === 'super_admin' ? 'Semua' : fakultas
          });
          toast.success('Email sudah terdaftar. Akses admin berhasil ditambahkan.');
          resetForm();
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

  const handleEdit = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setEmail(admin.email);
    setRole(admin.role || 'admin');
    setFakultas(admin.fakultas === 'Semua' ? '' : admin.fakultas || '');
    setPassword('');
  };

  const resetForm = () => {
    setEditingAdmin(null);
    setEmail('');
    setPassword('');
    setRole('admin');
    setFakultas('');
  };

  const handleDelete = (id: string, adminRole: string) => {
    if (adminRole === 'super_admin') {
      toast.error('Super Admin tidak bisa dihapus dari sini');
      return;
    }
    setDeletingId(id);
  };

  const executeDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteDoc(doc(db, 'admins', deletingId));
      toast.success('Akses admin dicabut');
    } catch (e) {
      toast.error('Gagal mencabut akses');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Manajemen Admin</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium font-sans">Kelola dan atur hak akses administrator sistem</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1A1A1A]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 font-sans font-bold">
                {editingAdmin ? (
                  <>
                    <Pencil className="w-5 h-5 text-[#005BAC] dark:text-[#8AB4F8]" />
                    Edit Admin
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 text-[#005BAC] dark:text-[#8AB4F8]" />
                    Tambah Admin
                  </>
                )}
              </CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {editingAdmin ? 'Perbarui informasi dan hak akses admin' : 'Buat akun khusus untuk admin baru'}
              </p>
            </div>
            {editingAdmin && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 rounded-full" 
                onClick={resetForm}
                title="Batal Edit"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveAdmin} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="admin.fti@uii.ac.id" 
                  required 
                  className="rounded-xl"
                />
              </div>

              {!editingAdmin && (
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="••••••••" 
                    required 
                    minLength={6} 
                    className="rounded-xl"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Role Akses</Label>
                <select
                  value={role}
                  onChange={e => {
                    const selectedRole = e.target.value;
                    setRole(selectedRole);
                    if (selectedRole === 'super_admin') {
                      setFakultas('Semua');
                    } else {
                      setFakultas('');
                    }
                  }}
                  className="flex h-10 w-full rounded-xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-[#2A2A2A] px-4 py-2 text-sm text-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="admin">Admin Fakultas</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {role === 'admin' && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <Label>Fakultas / Unit Kerja</Label>
                  <select
                    value={fakultas}
                    onChange={e => setFakultas(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-gray-300 dark:border-gray-800 bg-white dark:bg-[#2A2A2A] px-4 py-2 text-sm text-gray-900 dark:text-gray-100"
                    required
                  >
                    <option value="" disabled>-- Pilih Fakultas --</option>
                    {selectOptions.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {editingAdmin && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={resetForm}
                    className="flex-1 rounded-xl"
                  >
                    Batal
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className={`rounded-xl text-white ${editingAdmin ? 'flex-1 bg-amber-600 hover:bg-amber-700' : 'w-full bg-[#005BAC] hover:bg-[#004A8C]'}`}
                >
                  {loading ? 'Memproses...' : editingAdmin ? 'Simpan Perubahan' : 'Buat Akun'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-[#1A1A1A]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 font-sans font-bold">
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
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-medium">
                        {admin.fakultas || '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <div className="flex flex-col gap-1">
                          <span className="text-green-600 dark:text-green-400">Login: {admin.last_login ? format(new Date(admin.last_login), "dd MMM yyyy HH:mm", { locale: localeID }) : '-'}</span>
                          <span className="text-gray-500 dark:text-gray-400">Logout: {admin.last_logout ? format(new Date(admin.last_logout), "dd MMM yyyy HH:mm", { locale: localeID }) : '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleEdit(admin)}
                            className="text-amber-600 hover:text-amber-700 p-1.5 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            title="Edit Admin"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {admin.role !== 'super_admin' && (
                            <button 
                              onClick={() => handleDelete(admin.id, admin.role)}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Hapus Akses"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {admins.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Belum ada data admin.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmationModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={executeDelete}
        title="Cabut Akses Admin"
        description="Apakah Anda yakin ingin mencabut hak akses administrator untuk akun ini? Akun tersebut tidak akan lagi memiliki wewenang untuk masuk ke panel admin."
        confirmText="Ya, Cabut"
        cancelText="Batal"
      />
    </div>
  );
}
