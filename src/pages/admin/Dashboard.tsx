import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, writeBatch, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { isBookingExpired } from '@/lib/utils';
import { useAdmin } from '@/contexts/AdminContext';
import { getFacultyInfo } from '@/utils/prodiMapping';

export default function Dashboard() {
  const { adminData } = useAdmin();
  const [mahasiswaList, setMahasiswaList] = useState<any[]>([]);
  const [bookingList, setBookingList] = useState<any[]>([]);
  
  const [stats, setStats] = useState({
    totalMahasiswa: 0,
    ktmTersedia: 0,
    sudahBooking: 0,
    sudahDiambil: 0,
    belumDiambil: 0,
    bookingHariIni: 0,
    ktmBelumTersedia: 0,
    ktmSudahAmbil: 0
  });
  
  const [activities, setActivities] = useState<any[]>([]);
  const [bookingByDay, setBookingByDay] = useState<{name: string, value: number}[]>([]);

  useEffect(() => {
    const unsubMhs = onSnapshot(collection(db, 'mahasiswa'), (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setMahasiswaList(list);
    });

    const unsubBooking = onSnapshot(collection(db, 'booking'), (snap) => {
      const list: any[] = [];
      const expiredToUpdate: { id: string }[] = [];
      
      snap.forEach(document => {
        const d = document.data();
        list.push({ id: document.id, ...d });
        if (d.status === 'Belum Diambil' && isBookingExpired(d.tanggal, d.jam)) {
          expiredToUpdate.push({ id: document.id });
        }
      });

      if (expiredToUpdate.length > 0) {
        const batch = writeBatch(db);
        expiredToUpdate.forEach(item => {
          batch.update(doc(db, 'booking', item.id), { status: 'Hangus' });
        });
        batch.commit().catch(err => console.error('Failed to auto-expire bookings from dashboard snapshot:', err));
      }

      setBookingList(list);
    });

    // Realtime activity log
    const actQ = query(collection(db, 'distribusi'), orderBy('waktu_pengambilan', 'desc'), limit(15));
    const unsubAct = onSnapshot(actQ, (snap) => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubMhs();
      unsubBooking();
      unsubAct();
    };
  }, []);

  useEffect(() => {
    // Create a lookup map for bookings by mahasiswa_id to handle any status mismatch dynamically
    const bookingMap: Record<string, string> = {};
    bookingList.forEach(b => {
      bookingMap[b.mahasiswa_id] = b.status;
    });

    // 1. Calculate Mahasiswa Stats
    let tersedia = 0;
    let belumTersedia = 0;
    let sudahAmbil = 0;

    let filteredMahasiswa = mahasiswaList;
    if (adminData?.role === 'admin' && adminData.fakultas) {
      const adminFac = adminData.fakultas.toLowerCase();
      const keywords = adminData.fakultas.split(',').map(k => k.trim().toLowerCase());
      
      filteredMahasiswa = mahasiswaList.filter(m => {
        const studentFacInfo = getFacultyInfo(m.prodi);
        const studentFac = (studentFacInfo?.fakultas || '').toLowerCase();
        const prodiClean = (m.prodi || '').toLowerCase();
        
        return studentFac === adminFac || 
               studentFac.includes(adminFac) || 
               adminFac.includes(studentFac) ||
               keywords.some(k => prodiClean.includes(k));
      });
    }

    filteredMahasiswa.forEach(m => {
      const status = m.status_ktm;
      const bStatus = bookingMap[m.id];
      
      // A student has physically taken their KTM if:
      // - Their status_ktm is 'Sudah diambil' OR
      // - Their booking is marked as 'Sudah Diambil'
      const isTaken = status === 'Sudah diambil' || bStatus === 'Sudah Diambil';

      if (isTaken) {
        sudahAmbil++;
      } else if (status === 'Belum tersedia') {
        belumTersedia++;
      } else {
        // Remaining in office/ready for pickup: status_ktm is 'Tersedia' (or fallback) and NOT yet taken
        tersedia++;
      }
    });

    // 2. Calculate Booking Stats
    let sudah = 0;
    let belum = 0;
    let hariIni = 0;
    const today = format(new Date(), 'yyyy-MM-dd');
    const dayCounts: Record<string, number> = {};

    bookingList.forEach(b => {
      if (b.status === 'Sudah Diambil') sudah++;
      if (b.status === 'Belum Diambil') belum++;
      if (b.tanggal === today) hariIni++;
      
      if (b.tanggal) {
        dayCounts[b.tanggal] = (dayCounts[b.tanggal] || 0) + 1;
      }
    });

    // 3. Update Chart data
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      chartData.push({
        name: format(d, 'dd MMM', { locale: localeID }),
        value: dayCounts[dateStr] || 0
      });
    }
    setBookingByDay(chartData);

    // 4. Update Stats State
    setStats({
      totalMahasiswa: filteredMahasiswa.length,
      ktmTersedia: tersedia,
      ktmBelumTersedia: belumTersedia,
      ktmSudahAmbil: sudahAmbil,
      sudahBooking: bookingList.length,
      sudahDiambil: sudah,
      belumDiambil: belum,
      bookingHariIni: hariIni
    });
  }, [mahasiswaList, bookingList]);

  const pieData = [
    { name: 'Sudah Diambil', value: stats.ktmSudahAmbil, color: '#10B981' }, // Green
    { name: 'Siap Diambil', value: stats.totalMahasiswa - stats.ktmBelumTersedia - stats.ktmSudahAmbil, color: '#3B82F6' }, // Blue
    { name: 'Belum Tersedia', value: stats.ktmBelumTersedia, color: '#F59E0B' }, // Amber
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard Statistik</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ringkasan data distribusi Kartu Tanda Mahasiswa (KTM)</p>
        </div>
      </div>
      
      {/* Primary Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full opacity-50"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Total Mahasiswa</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalMahasiswa}</h3>
            <span className="text-sm text-gray-400 dark:text-gray-500 mb-1">orang</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full opacity-50"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">KTM Sudah Diambil</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-green-500 dark:text-green-400">{stats.ktmSudahAmbil}</h3>
            <span className="text-sm text-gray-400 dark:text-gray-500 mb-1">selesai</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-50 dark:bg-purple-900/20 rounded-full opacity-50"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">KTM Siap Diambil (Sisa Fisik)</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.totalMahasiswa - stats.ktmBelumTersedia - stats.ktmSudahAmbil}</h3>
            <span className="text-sm text-gray-400 dark:text-gray-500 mb-1">KTM fisik</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full opacity-50"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Antrean Booking Aktif</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-amber-500 dark:text-amber-400">{stats.belumDiambil}</h3>
            <span className="text-sm text-gray-400 dark:text-gray-500 mb-1">tiket</span>
          </div>
        </div>
      </div>

      {/* Secondary Data & Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Charts */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white dark:bg-[#1E1E1E] border-gray-100 dark:border-gray-800 shadow-sm rounded-2xl">
            <CardHeader className="border-b border-gray-50 dark:border-gray-800/50 pb-4">
              <CardTitle className="text-lg">Progres Distribusi KTM</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-2">
              <div className="h-[250px] w-full flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value) => [`${value} KTM`, 'Jumlah']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-gray-500 dark:text-gray-400 gap-2 px-4 sm:px-8 mt-2">
                <span>Siap Diambil (di Laci): <strong className="text-gray-900 dark:text-gray-100">{stats.ktmTersedia}</strong></span>
                <span>Fisik Belum Tersedia: <strong className="text-gray-900 dark:text-gray-100">{stats.ktmBelumTersedia}</strong></span>
                <span>Total Mahasiswa: <strong className="text-gray-900 dark:text-gray-100">{stats.totalMahasiswa}</strong></span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-[#1E1E1E] border-gray-100 dark:border-gray-800 shadow-sm rounded-2xl">
            <CardHeader className="border-b border-gray-50 dark:border-gray-800/50 pb-4">
              <CardTitle className="text-lg">Tren Booking 7 Hari Terakhir</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[220px] w-full">
                {bookingByDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bookingByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <RechartsTooltip 
                        cursor={{ fill: '#f3f4f6', opacity: 0.4 }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="value" fill="#005BAC" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                    Belum ada data booking minggu ini
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Realtime Activity Stream */}
        <Card className="lg:col-span-1 bg-white dark:bg-[#1E1E1E] border-gray-100 dark:border-gray-800 shadow-sm rounded-2xl flex flex-col h-full max-h-[700px]">
          <CardHeader className="border-b border-gray-50 dark:border-gray-800/50 p-5 flex flex-row justify-between items-center space-y-0">
            <CardTitle className="text-lg">Log Distribusi</CardTitle>
            <span className="flex items-center text-[10px] px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full font-semibold uppercase tracking-widest border border-green-100 dark:border-green-800">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
              Live
            </span>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
             <div className="divide-y divide-gray-50 dark:divide-gray-800/50 h-full overflow-y-auto p-2">
               {activities.length === 0 ? (
                 <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada aktivitas.</div>
               ) : (
                 activities.map(act => (
                   <div key={act.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-xl flex items-start space-x-3 mb-1">
                     <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 font-bold mt-0.5">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate">
                         {act.nama || 'KTM diserahkan'}
                       </p>
                       <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">NIM: <span className="font-mono text-gray-750 dark:text-gray-350 font-medium">{act.nim}</span></p>
                       <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 flex flex-wrap items-center gap-1.5 font-medium">
                         <span>{act.waktu_pengambilan ? format(act.waktu_pengambilan.toDate(), 'HH:mm - dd MMM yyyy', { locale: localeID }) : ''}</span>
                         <span className="text-gray-300 dark:text-gray-700 font-normal">•</span>
                         <span className="bg-[#E8F0FE] dark:bg-[#1A2E4C] text-[#005BAC] dark:text-[#8AB4F8] font-bold px-1.5 py-0.5 rounded text-[8.5px]">
                           Verifikator: {act.admin_nama || 'Administrator'}
                         </span>
                       </p>
                     </div>
                   </div>
                 ))
               )}
             </div>
          </CardContent>
        </Card>

      </div>
      
    </div>
  );
}
