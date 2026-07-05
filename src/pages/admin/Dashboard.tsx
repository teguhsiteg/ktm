import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, writeBatch, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { isBookingExpired } from '@/lib/utils';

export default function Dashboard() {
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
      let tersedia = 0;
      let belumTersedia = 0;
      let sudahAmbil = 0;
      snap.forEach(doc => {
        const status = doc.data().status_ktm;
        if (status === 'Tersedia') tersedia++;
        else if (status === 'Belum tersedia') belumTersedia++;
        else if (status === 'Sudah diambil') sudahAmbil++;
      });
      setStats(prev => ({ 
        ...prev, 
        totalMahasiswa: snap.size, 
        ktmTersedia: tersedia,
        ktmBelumTersedia: belumTersedia,
        ktmSudahAmbil: sudahAmbil
      }));
    });

    const unsubBooking = onSnapshot(collection(db, 'booking'), (snap) => {
      let sudah = 0;
      let belum = 0;
      let hariIni = 0;
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const dayCounts: Record<string, number> = {};
      const expiredToUpdate: { id: string }[] = [];
      
      snap.forEach(document => {
        const d = document.data();
        if (d.status === 'Belum Diambil' && isBookingExpired(d.tanggal, d.jam)) {
          expiredToUpdate.push({ id: document.id });
        }
        
        if (d.status === 'Sudah Diambil') sudah++;
        if (d.status === 'Belum Diambil') belum++;
        if (d.tanggal === today) hariIni++;
        
        if (d.tanggal) {
          dayCounts[d.tanggal] = (dayCounts[d.tanggal] || 0) + 1;
        }
      });

      if (expiredToUpdate.length > 0) {
        const batch = writeBatch(db);
        expiredToUpdate.forEach(item => {
          batch.update(doc(db, 'booking', item.id), { status: 'Hangus' });
        });
        batch.commit().catch(err => console.error('Failed to auto-expire bookings from dashboard snapshot:', err));
      }
      
      // Generate the last 7 calendar days chronologically ending on today, filling in 0 for empty dates
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
      
      setStats(prev => ({ 
        ...prev, 
        sudahBooking: snap.size, 
        sudahDiambil: sudah, 
        belumDiambil: belum,
        bookingHariIni: hariIni
      }));
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

  const pieData = [
    { name: 'Sudah Diambil', value: stats.sudahDiambil, color: '#10B981' }, // Green
    { name: 'Siap Diambil', value: stats.ktmTersedia, color: '#3B82F6' }, // Blue
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
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Sudah Booking</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.sudahBooking}</h3>
            <span className="text-sm text-gray-400 dark:text-gray-500 mb-1">mahasiswa</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full opacity-50"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Belum Ambil (Antrean)</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-amber-500 dark:text-amber-400">{stats.belumDiambil}</h3>
            <span className="text-sm text-gray-400 dark:text-gray-500 mb-1">tiket</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full opacity-50"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Sudah Ambil</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-green-500 dark:text-green-400">{stats.sudahDiambil}</h3>
            <span className="text-sm text-gray-400 dark:text-gray-500 mb-1">selesai</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-50 dark:bg-purple-900/20 rounded-full opacity-50"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">Sisa Belum Diambil</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.ktmTersedia}</h3>
            <span className="text-sm text-gray-400 dark:text-gray-500 mb-1">KTM fisik</span>
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
                     <div>
                       <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                         {act.nama || 'KTM diserahkan'}
                       </p>
                       <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">NIM: <span className="font-mono text-gray-750 dark:text-gray-350 font-medium">{act.nim}</span></p>
                       <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                         {act.waktu_pengambilan ? format(act.waktu_pengambilan.toDate(), 'HH:mm - dd MMM yyyy', { locale: localeID }) : ''}
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
