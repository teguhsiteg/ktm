import { useState, useEffect, FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Jadwal } from '@/types';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

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
    try {
      if (editingId) {
        await updateDoc(doc(db, 'jadwal', editingId), {
          ...formData,
          kuota: Number(formData.kuota)
        });
        toast.success('Jadwal berhasil diperbarui');
      } else {
        await addDoc(collection(db, 'jadwal'), {
          ...formData,
          kuota: Number(formData.kuota),
          booked_count: 0
        });
        toast.success('Jadwal berhasil ditambahkan');
      }
      resetForm();
    } catch (e) {
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
  };

  const executeDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteDoc(doc(db, 'jadwal', deletingId));
      toast.success('Jadwal berhasil dihapus');
    } catch (e) {
      toast.error('Gagal menghapus jadwal');
    }
  };

  const toggleStatus = async (j: Jadwal) => {
    try {
      await updateDoc(doc(db, 'jadwal', j.id), {
        status: j.status === 'Aktif' ? 'Tidak aktif' : 'Aktif'
      });
      toast.success('Status berhasil diubah');
    } catch (e) {
      toast.error('Gagal mengubah status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Manajemen Jadwal</h2>
        <Button size="sm" onClick={() => {
          if (showAdd) {
            resetForm();
          } else {
            setShowAdd(true);
          }
        }}>
          {showAdd ? 'Batal' : <><Plus className="w-4 h-4 mr-2" /> Buat Jadwal</>}
        </Button>
      </div>

      {showAdd && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg">{editingId ? 'Edit Jadwal' : 'Buat Jadwal Baru'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddOrEdit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Tanggal</label>
                <Input type="date" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} required />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Jam Mulai</label>
                <Input type="time" value={formData.jam_mulai} onChange={e => setFormData({...formData, jam_mulai: e.target.value})} required />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Jam Selesai</label>
                <Input type="time" value={formData.jam_selesai} onChange={e => setFormData({...formData, jam_selesai: e.target.value})} required />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Kuota</label>
                <Input type="number" min="1" value={formData.kuota} onChange={e => setFormData({...formData, kuota: Number(e.target.value)})} required />
              </div>
              <div>
                <Button type="submit" className="w-full">{editingId ? 'Update' : 'Simpan'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">No</th>
                <th className="px-6 py-3 font-medium">Tanggal</th>
                <th className="px-6 py-3 font-medium">Jam</th>
                <th className="px-6 py-3 font-medium text-center">Terisi / Kuota</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-4 text-center dark:text-gray-400">Memuat data...</td></tr>
              ) : jadwal.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-4 text-center dark:text-gray-400">Data kosong</td></tr>
              ) : (
                jadwal.map((j, idx) => (
                  <tr key={j.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors duration-150">
                    <td className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">{idx + 1}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{j.tanggal}</td>
                    <td className="px-6 py-4 dark:text-gray-200">{j.jam_mulai} - {j.jam_selesai}</td>
                    <td className="px-6 py-4 text-center font-medium dark:text-gray-300">
                      <span className={j.booked_count && j.booked_count >= j.kuota ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}>
                        {j.booked_count || 0}
                      </span> / {j.kuota}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${j.status === 'Aktif' ? 'bg-blue-100 dark:bg-blue-950/40 text-[#005BAC] dark:text-[#8AB4F8]' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(j)}>
                        {j.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleEditClick(j)}>
                        <Edit2 className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setDeletingId(j.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmationModal
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={executeDelete}
        title="Hapus Jadwal"
        description="Apakah Anda yakin ingin menghapus jadwal ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
}
