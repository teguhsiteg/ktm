import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, Ticket, ScanLine, LogOut, Download, Sun, Moon } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('admin_theme') === 'dark';
  });

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
    await signOut(auth);
    navigate('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center font-['Inter',_sans-serif] text-slate-800 dark:text-slate-200 transition-colors duration-300">
        <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6 shadow-lg shadow-brand/20 animate-pulse">
          UII
        </div>
        <p className="font-medium animate-pulse">Memuat...</p>
      </div>
    );
  }

  const menu = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Mahasiswa', path: '/admin/mahasiswa', icon: Users },
    { name: 'Jadwal', path: '/admin/jadwal', icon: CalendarDays },
    { name: 'Booking', path: '/admin/booking', icon: Ticket },
    { name: 'Scanner', path: '/admin/scanner', icon: ScanLine },
  ];

  return (
    <div className="h-screen md:h-screen w-full overflow-hidden bg-background flex flex-col md:flex-row font-['Inter',_sans-serif] text-slate-800 dark:text-slate-200 transition-colors duration-300">
      {/* Sidebar Workspace style - hidden on mobile, visible on desktop */}
      <aside className="w-[260px] bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 flex flex-col hidden md:flex h-screen sticky top-0 transition-colors duration-300">
        <div className="p-6 flex items-center space-x-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md shadow-brand/20">UII</div>
          <div>
            <h1 className="text-[14px] font-bold text-brand leading-tight uppercase tracking-wider">KTM Booking</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-medium">Management System</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {menu.map(item => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3 rounded-2xl text-sm transition-all duration-200 ${
                  active ? 'bg-brand/10 dark:bg-brand/20 text-brand font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 mr-4 ${active ? 'text-brand' : 'text-slate-500 dark:text-slate-400'}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 rounded-2xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header - only visible on mobile */}
      <header className="h-[60px] flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 flex md:hidden items-center justify-between z-20 transition-colors duration-300">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white font-bold text-base shadow-sm">UII</div>
          <div>
            <h1 className="text-xs font-bold text-brand uppercase tracking-wider">KTM Admin</h1>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            title={darkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <div className="ml-1 w-8 h-8 bg-brand rounded-full flex items-center justify-center text-white font-medium text-xs shadow-sm">AD</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">
        {/* Desktop Topbar - hidden on mobile */}
        <header className="h-[72px] bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-8 hidden md:flex items-center justify-between sticky top-0 z-10 transition-colors duration-300">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            {menu.find(m => location.pathname.startsWith(m.path))?.name || 'Admin Panel'}
          </h2>
          <div className="flex items-center space-x-6">
             {/* Theme Toggle Button */}
             <button
               onClick={() => setDarkMode(!darkMode)}
               className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-all duration-200"
               title={darkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
               id="theme-toggle"
             >
               {darkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-600 dark:text-slate-300" />}
             </button>

             <div className="flex items-center space-x-4 border-l pl-6 border-slate-200 dark:border-slate-800">
               <div className="text-right hidden sm:block">
                 <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Admin Akademik</p>
                 <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Super Administrator</p>
               </div>
               <div className="w-10 h-10 bg-brand rounded-full flex items-center justify-center text-white font-medium shadow-md shadow-brand/20">AD</div>
             </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="p-4 md:p-8 flex-1 overflow-y-auto md:pb-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-transparent">
          <Outlet />
        </div>

        {/* Mobile Bottom Navigation - only visible on mobile/tablets */}
        <nav className="h-[70px] flex-shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex md:hidden items-center justify-around px-2 pb-safe z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] transition-colors duration-300">
          {menu.map(item => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-2xl transition-all duration-200 ${
                  active ? 'text-brand font-bold' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <div className={`p-1.5 rounded-full mb-1 transition-all duration-200 ${
                  active ? 'bg-brand/10' : 'bg-transparent'
                }`}>
                  <Icon className={`w-5 h-5 ${active ? 'scale-110' : ''} transition-transform`} />
                </div>
                <span className="text-[10px] tracking-tight leading-none truncate max-w-full text-center">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
