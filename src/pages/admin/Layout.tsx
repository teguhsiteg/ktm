import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, Ticket, ScanLine, LogOut, Download, Sun, Moon, UserCircle, MapPin, Settings, Building2 } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdmin } from '@/contexts/AdminContext';
import { auth } from '@/lib/firebase';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('admin_theme') === 'dark';
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const { adminData, loadingAdmin, adminId } = useAdmin();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/admin/login');
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('admin_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('admin_theme', 'light');
    }
  }, [darkMode]);

  const handleLogout = async () => {
    if (auth.currentUser) {
      try {
        const idToUpdate = adminId || auth.currentUser.uid;
        await updateDoc(doc(db, 'admins', idToUpdate), {
          last_logout: new Date().toISOString()
        });
      } catch (e) { console.error(e); }
    }
    await signOut(auth);
    navigate('/admin/login');
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#121212] flex items-center justify-center  text-[#3C4043] dark:text-[#E0E0E0] transition-colors duration-200">Memuat...</div>;
  }

  const menu = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Mahasiswa', path: '/admin/mahasiswa', icon: Users },
    { name: 'Jadwal', path: '/admin/jadwal', icon: CalendarDays },
    { name: 'Fakultas & Prodi', path: '/admin/lokasi', icon: Building2 },
    { name: 'Booking', path: '/admin/booking', icon: Ticket },
    { name: 'Scanner', path: '/admin/scanner', icon: ScanLine },
  ];

  if (adminData?.role === 'super_admin') {
    menu.push({ name: 'Admins', path: '/admin/users', icon: Users });
    menu.push({ name: 'Pengaturan', path: '/admin/pengaturan', icon: Settings });
  }
  menu.push({ name: 'Profil', path: '/admin/profil', icon: UserCircle });

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#F8F9FA] dark:bg-[#121212] flex flex-col md:flex-row  text-[#3C4043] dark:text-[#E0E0E0] transition-colors duration-200">
      {/* Sidebar Modern SaaS style - hidden on mobile, visible on desktop */}
      <aside className="w-[260px] bg-white dark:bg-[#1A1A1A] border-r border-gray-200 dark:border-gray-800/60 flex flex-col hidden md:flex h-full sticky top-0 transition-colors duration-200">
        <div className="p-6 flex items-center space-x-3 border-b border-gray-200 dark:border-gray-800/60">
          <div className="w-10 h-10 rounded-xl bg-[#E8F0FE] dark:bg-[#005BAC]/15 flex items-center justify-center shrink-0">
            <img 
              src="/logo-uii.png" 
              alt="Logo UII" 
              className="w-7 h-7 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-[14px] font-extrabold text-gray-900 dark:text-gray-100 leading-tight tracking-tight">KTM Booking</h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Admin Portal</p>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
          {menu.map(item => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group flex items-center px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  active 
                    ? 'bg-[#005BAC] text-white shadow-md shadow-[#005BAC]/20' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 transition-transform duration-200 ${
                  active ? 'text-white' : 'text-gray-400 dark:text-gray-500 group-hover:scale-110'
                }`} />
                {item.name}
              </Link>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-800/60">
          <div className="flex items-center gap-3 px-3 py-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl mb-2">
            <div className="w-9 h-9 bg-[#E8F0FE] dark:bg-[#005BAC]/15 rounded-lg flex items-center justify-center text-[#005BAC] dark:text-[#8AB4F8] font-bold text-sm shrink-0">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{adminData?.nama || "Admin Akademik"}</p>
              <p className="text-[10px] text-gray-500 truncate">{adminData?.role === "super_admin" ? "Super Administrator" : `Admin ${adminData?.fakultas || ""}`}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header - only visible on mobile */}
      <header className="h-[60px] flex-shrink-0 bg-white dark:bg-[#1A1A1A] border-b border-gray-200 dark:border-gray-800/60 px-4 flex md:hidden items-center justify-between z-20 transition-colors duration-200">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E8F0FE] dark:bg-[#005BAC]/15 flex items-center justify-center shrink-0">
            <img 
              src="/logo-uii.png" 
              alt="Logo UII" 
              className="w-5 h-5 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-sm font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">KTM Admin</h1>
        </div>
        <div className="flex items-center space-x-1.5">
          {/* Real-time Clock for Mobile Header */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-zinc-800 rounded-lg text-[10px] font-bold text-gray-700 dark:text-gray-300 font-mono">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>{format(currentTime, 'HH:mm:ss')}</span>
          </div>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400 transition-colors"
            title={darkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Desktop Topbar - hidden on mobile */}
        <header className="h-[72px] bg-white/50 dark:bg-[#121212]/50 backdrop-blur-md border-b border-gray-200 dark:border-gray-800/60 px-8 hidden md:flex items-center justify-between sticky top-0 z-10 transition-colors duration-200">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
              {menu.find(m => location.pathname.startsWith(m.path))?.name || 'Admin Panel'}
            </h2>
          </div>
          <div className="flex items-center space-x-3">
             {/* Real-time Clock for Desktop Topbar */}
             <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 transition-all shadow-sm">
               <span className="relative flex h-2 w-2 shrink-0">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
               </span>
               <span className="text-xs font-bold font-mono">
                 {format(currentTime, 'EEEE, d MMMM yyyy - HH:mm:ss', { locale: localeID })}
               </span>
             </div>

             <button
               onClick={() => setDarkMode(!darkMode)}
               className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-300 transition-all shadow-sm"
               title={darkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
               id="theme-toggle"
             >
               {darkMode ? (
                 <>
                   <Sun className="w-4 h-4 text-amber-500" />
                   <span className="text-xs font-semibold">Light</span>
                 </>
               ) : (
                 <>
                   <Moon className="w-4 h-4" />
                   <span className="text-xs font-semibold">Dark</span>
                 </>
               )}
             </button>
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="p-4 md:p-8 flex-1 overflow-y-auto md:pb-8">
          <Outlet />
        </div>

        {/* Mobile Bottom Navigation - only visible on mobile/tablets */}
        <nav className="h-[calc(70px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] flex-shrink-0 bg-white/90 dark:bg-[#1A1A1A]/90 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800/60 flex md:hidden items-center justify-around px-2 z-20 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.2)] transition-colors duration-200">
          {menu.map(item => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group relative flex flex-col items-center justify-center flex-1 h-full pt-1 transition-all duration-200 ${
                  active ? 'text-[#005BAC] dark:text-[#8AB4F8]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {active && (
                  <div className="absolute top-0 w-8 h-1 bg-[#005BAC] dark:bg-[#8AB4F8] rounded-b-full"></div>
                )}
                <div className={`p-1.5 rounded-xl mb-0.5 transition-all duration-200 ${
                  active ? 'bg-[#E8F0FE] dark:bg-[#005BAC]/15 scale-110' : 'bg-transparent group-hover:bg-gray-50 dark:group-hover:bg-zinc-800/50'
                }`}>
                  <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                </div>
                <span className={`text-[10px] tracking-tight leading-none truncate max-w-full text-center transition-all ${
                  active ? 'font-bold' : 'font-medium'
                }`}>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
