import { useState, useEffect, FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Jadwal } from '@/types';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, CalendarDays, Clock, Users } from 'lucide-react';
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Manajemen Jadwal</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Kelola sesi, waktu, dan kuota antrean KTM</p>
        </div>
        <Button size="sm" onClick={() => {
          if (showAdd) {
            resetForm();
          } else {
            setShowAdd(true);
          }
        }} className="rounded-xl shadow-sm bg-brand hover:bg-brand-dark text-white h-9 px-4">
          {showAdd ? 'Batal' : <><Plus className="w-4 h-4 mr-2" /> Buat Jadwal</>}
        </Button>
      </div>

      {showAdd && (
        <Card className="glass-card shadow-sm rounded-[24px] border border-slate-200/50 dark:border-slate-800/50 animate-in slide-in-from-top-4 duration-300">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-brand" />
              {editingId ? 'Edit Jadwal' : 'Buat Jadwal Baru'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddOrEdit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block font-medium">Tanggal</label>
                <Input type="date" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} required className="bg-white/50 dark:bg-[#2A2A2A] border-slate-200 dark:border-gray-800 rounded-xl h-10" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block font-medium">Jam Mulai</label>
                <Input type="time" value={formData.jam_mulai} onChange={e => setFormData({...formData, jam_mulai: e.target.value})} required className="bg-white/50 dark:bg-[#2A2A2A] border-slate-200 dark:border-gray-800 rounded-xl h-10" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block font-medium">Jam Selesai</label>
                <Input type="time" value={formData.jam_selesai} onChange={e => setFormData({...formData, jam_selesai: e.target.value})} required className="bg-white/50 dark:bg-[#2A2A2A] border-slate-200 dark:border-gray-800 rounded-xl h-10" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block font-medium">Kuota</label>
                <Input type="number" min="1" value={formData.kuota} onChange={e => setFormData({...formData, kuota: Number(e.target.value)})} required className="bg-white/50 dark:bg-[#2A2A2A] border-slate-200 dark:border-gray-800 rounded-xl h-10" />
              </div>
              <div>
                <Button type="submit" className="w-full h-10 rounded-xl">{editingId ? 'Update Jadwal' : 'Simpan Jadwal'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card shadow-sm rounded-[24px] border border-slate-200/50 dark:border-slate-800/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 uppercase border-b border-slate-200/50 dark:border-slate-800/50">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">No</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Tanggal</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Waktu Sesi</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center w-48">Kapasitas</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400 animate-pulse">Memuat data jadwal...</td></tr>
              ) : jadwal.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <CalendarDays className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
                      <p className="text-base font-medium">Belum ada jadwal</p>
                      <p className="text-xs mt-1">Buat jadwal baru untuk mulai membuka antrean</p>
                    </div>
                  </td>
                </tr>
              ) : (
                jadwal.map((j, idx) => {
                  const percentage = Math.min(100, ((j.booked_count || 0) / j.kuota) * 100);
                  const isFull = (j.booked_count || 0) >= j.kuota;
                  
                  return (
                  <tr key={j.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors duration-150">
                    <td className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-brand/70" />
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{j.tanggal}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 dark:text-slate-200">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{j.jam_mulai} - {j.jam_selesai}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs">
                          <span className={isFull ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-600 dark:text-slate-300 font-medium'}>
                            {j.booked_count || 0} Terisi
                          </span>
                          <span className="text-slate-400">{j.kuota} Total</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : 'bg-brand'}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                        j.status === 'Aktif' 
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {j.status === 'Aktif' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
                        {j.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant={j.status === 'Aktif' ? 'outline' : 'secondary'} size="sm" onClick={() => toggleStatus(j)} className="rounded-lg text-xs h-8">
                          {j.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => handleEditClick(j)} className="rounded-lg h-8 w-8 hover:text-brand hover:border-brand/50">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setDeletingId(j.id)} className="rounded-lg h-8 w-8 hover:text-red-600 hover:border-red-600/50 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )})
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
        description="Apakah Anda yakin ingin menghapus jadwal ini? Pastikan tidak ada mahasiswa yang sudah memilih jadwal ini. Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
}
