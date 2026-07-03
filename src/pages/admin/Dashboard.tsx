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
    bookingHariIni: 0
  });
  
  const [activities, setActivities] = useState<any[]>([]);
  const [bookingByDay, setBookingByDay] = useState<{name: string, value: number}[]>([]);

  useEffect(() => {
    const unsubMhs = onSnapshot(collection(db, 'mahasiswa'), (snap) => {
      let tersedia = 0;
      snap.forEach(doc => {
        if (doc.data().status_ktm === 'Tersedia') tersedia++;
      });
      setStats(prev => ({ ...prev, totalMahasiswa: snap.size, ktmTersedia: tersedia }));
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
      
      const chartData = Object.entries(dayCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-7) // Last 7 days
        .map(([date, count]) => ({
          name: format(new Date(date), 'dd MMM', { locale: localeID }),
          value: count
        }));
        
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

  const sisaBelumDiambil = stats.ktmTersedia - stats.sudahDiambil;
  
  const pieData = [
    { name: 'Sudah Diambil', value: stats.sudahDiambil, color: '#10B981' }, // Green
    { name: 'Sisa Belum Diambil', value: sisaBelumDiambil > 0 ? sisaBelumDiambil : 0, color: '#F59E0B' }, // Amber
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
        <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 relative overflow-hidden transition-all hover:shadow-md group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 dark:bg-blue-500/5 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1 relative z-10">Sudah Booking</p>
          <div className="flex items-end gap-3 relative z-10">
            <h3 className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.sudahBooking}</h3>
            <span className="text-sm text-slate-400 dark:text-slate-500 mb-1 font-medium">mhs</span>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 relative overflow-hidden transition-all hover:shadow-md group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 dark:bg-amber-500/5 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1 relative z-10">Belum Ambil</p>
          <div className="flex items-end gap-3 relative z-10">
            <h3 className="text-3xl font-bold text-amber-500 dark:text-amber-400">{stats.belumDiambil}</h3>
            <span className="text-sm text-slate-400 dark:text-slate-500 mb-1 font-medium">tiket</span>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 relative overflow-hidden transition-all hover:shadow-md group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1 relative z-10">Sudah Ambil</p>
          <div className="flex items-end gap-3 relative z-10">
            <h3 className="text-3xl font-bold text-emerald-500 dark:text-emerald-400">{stats.sudahDiambil}</h3>
            <span className="text-sm text-slate-400 dark:text-slate-500 mb-1 font-medium">selesai</span>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 relative overflow-hidden transition-all hover:shadow-md group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand/10 dark:bg-brand/10 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1 relative z-10">Sisa KTM</p>
          <div className="flex items-end gap-3 relative z-10">
            <h3 className="text-3xl font-bold text-brand dark:text-white">{sisaBelumDiambil}</h3>
            <span className="text-sm text-slate-400 dark:text-slate-500 mb-1 font-medium">fisik</span>
          </div>
        </div>
      </div>

      {/* Secondary Data & Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Charts */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="glass-card shadow-sm rounded-[24px] border border-slate-200/50 dark:border-slate-800/50">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/50 pb-4">
              <CardTitle className="text-lg text-slate-800 dark:text-slate-100">Progres Distribusi KTM</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-4">
              <div className="h-[250px] w-full flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value) => [`${value} KTM`, 'Jumlah']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid rgba(226, 232, 240, 0.5)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400 px-8 mt-2 bg-slate-50 dark:bg-slate-800/50 py-3 rounded-2xl">
                <span>Total Tersedia: <strong className="text-slate-900 dark:text-slate-100 text-base">{stats.ktmTersedia}</strong></span>
                <span>Total Mahasiswa: <strong className="text-slate-900 dark:text-slate-100 text-base">{stats.totalMahasiswa}</strong></span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card shadow-sm rounded-[24px] border border-slate-200/50 dark:border-slate-800/50">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/50 pb-4">
              <CardTitle className="text-lg text-slate-800 dark:text-slate-100">Tren Booking 7 Hari Terakhir</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-2">
              <div className="h-[220px] w-full">
                {bookingByDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bookingByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.3} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <RechartsTooltip 
                        cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid rgba(226, 232, 240, 0.5)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                      />
                      <Bar dataKey="value" fill="#0f172a" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                    Belum ada data booking minggu ini
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Realtime Activity Stream */}
        <Card className="lg:col-span-1 glass-card shadow-sm rounded-[24px] border border-slate-200/50 dark:border-slate-800/50 flex flex-col h-full max-h-[700px]">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800/50 p-6 flex flex-row justify-between items-center space-y-0">
            <CardTitle className="text-lg text-slate-800 dark:text-slate-100">Log Distribusi</CardTitle>
            <span className="flex items-center text-[10px] px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full font-bold uppercase tracking-widest border border-emerald-200/50 dark:border-emerald-800/50">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
              Live
            </span>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
             <div className="divide-y divide-slate-100 dark:divide-slate-800/50 h-full overflow-y-auto p-3 custom-scrollbar">
               {activities.length === 0 ? (
                 <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400 font-medium">Belum ada aktivitas.</div>
               ) : (
                 activities.map(act => (
                   <div key={act.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-2xl flex items-start space-x-3 mb-1 group cursor-default">
                     <div className="w-9 h-9 rounded-full bg-brand/10 dark:bg-brand/20 text-brand flex items-center justify-center flex-shrink-0 font-bold mt-0.5 group-hover:bg-brand group-hover:text-white transition-colors">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                     </div>
                     <div>
                       <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                         KTM diserahkan
                       </p>
                       <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">NIM: <span className="font-bold text-slate-700 dark:text-slate-300">{act.nim}</span></p>
                       <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1.5 uppercase tracking-wider">
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
