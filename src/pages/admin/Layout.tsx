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
    return <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#121212] flex items-center justify-center font-['Roboto',_sans-serif] text-[#3C4043] dark:text-[#E0E0E0] transition-colors duration-200">Memuat...</div>;
  }

  const menu = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Mahasiswa', path: '/admin/mahasiswa', icon: Users },
    { name: 'Jadwal', path: '/admin/jadwal', icon: CalendarDays },
    { name: 'Booking', path: '/admin/booking', icon: Ticket },
    { name: 'Scanner', path: '/admin/scanner', icon: ScanLine },
  ];

  return (
    <div className="h-screen md:h-screen w-full overflow-hidden bg-[#F8F9FA] dark:bg-[#121212] flex flex-col md:flex-row font-['Roboto',_sans-serif] text-[#3C4043] dark:text-[#E0E0E0] transition-colors duration-200">
      {/* Sidebar Workspace style - hidden on mobile, visible on desktop */}
      <aside className="w-[260px] bg-white dark:bg-[#1E1E1E] border-r border-[#E0E0E0] dark:border-gray-800 flex flex-col hidden md:flex h-screen sticky top-0 transition-colors duration-200">
        <div className="p-6 flex items-center space-x-3 border-b border-[#E0E0E0] dark:border-gray-800">
          <div className="w-10 h-10 bg-[#005BAC] dark:bg-[#1A73E8] rounded-xl flex items-center justify-center text-white font-bold text-xl">UII</div>
          <div>
            <h1 className="text-[14px] font-bold text-[#005BAC] dark:text-[#8AB4F8] leading-tight uppercase tracking-wider">KTM Booking</h1>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-medium">Management System</p>
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
                className={`flex items-center px-4 py-3 rounded-[20px] text-sm transition-colors ${
                  active ? 'bg-[#E8F0FE] dark:bg-[#1A2E4C] text-[#005BAC] dark:text-[#8AB4F8] font-bold' : 'text-[#5F6368] dark:text-[#AAAEB3] hover:bg-gray-100 dark:hover:bg-gray-800 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 mr-4 ${active ? 'text-[#005BAC] dark:text-[#8AB4F8]' : 'text-[#5F6368] dark:text-[#AAAEB3]'}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-[#E0E0E0] dark:border-gray-800">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 rounded-[20px] text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header - only visible on mobile */}
      <header className="h-[56px] flex-shrink-0 bg-white dark:bg-[#1E1E1E] border-b border-[#E0E0E0] dark:border-gray-800 px-4 flex md:hidden items-center justify-between z-20 transition-colors duration-200">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-[#005BAC] dark:bg-[#1A73E8] rounded-lg flex items-center justify-center text-white font-bold text-base">UII</div>
          <div>
            <h1 className="text-xs font-bold text-[#005BAC] dark:text-[#8AB4F8] uppercase tracking-wider">KTM Admin</h1>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            title={darkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
          >
            {darkMode ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-gray-600 dark:text-gray-300" />}
          </button>
          <button 
            onClick={handleLogout}
            className="p-1.5 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 bg-[#005BAC] rounded-full flex items-center justify-center text-white font-medium text-xs">AD</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">
        {/* Desktop Topbar - hidden on mobile */}
        <header className="h-[64px] bg-white dark:bg-[#1E1E1E] border-b border-[#E0E0E0] dark:border-gray-800 px-8 hidden md:flex items-center justify-between sticky top-0 z-10 transition-colors duration-200">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {menu.find(m => location.pathname.startsWith(m.path))?.name || 'Admin Panel'}
          </h2>
          <div className="flex items-center space-x-6">
             {/* Theme Toggle Button */}
             <button
               onClick={() => setDarkMode(!darkMode)}
               className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
               title={darkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
               id="theme-toggle"
             >
               {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
             </button>

             <div className="flex items-center space-x-3 border-l pl-6 border-[#E0E0E0] dark:border-gray-800">
               <div className="text-right hidden sm:block">
                 <p className="text-sm font-bold text-[#3C4043] dark:text-gray-200">Admin Akademik</p>
                 <p className="text-[11px] text-gray-500 dark:text-gray-400">Super Administrator</p>
               </div>
               <div className="w-9 h-9 bg-[#005BAC] rounded-full flex items-center justify-center text-white font-medium">AD</div>
             </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="p-4 md:p-8 flex-1 overflow-y-auto md:pb-8">
          <Outlet />
        </div>

        {/* Mobile Bottom Navigation - only visible on mobile/tablets */}
        <nav className="h-[66px] flex-shrink-0 bg-white dark:bg-[#1E1E1E] border-t border-[#E0E0E0] dark:border-gray-800 flex md:hidden items-center justify-around px-2 pb-safe z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] transition-colors duration-200">
          {menu.map(item => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-150 ${
                  active ? 'text-[#005BAC] dark:text-[#8AB4F8] font-bold' : 'text-[#5F6368] dark:text-[#AAAEB3]'
                }`}
              >
                <div className={`p-1.5 rounded-full mb-0.5 transition-colors ${
                  active ? 'bg-[#E8F0FE] dark:bg-[#1A2E4C]' : 'bg-transparent'
                }`}>
                  <Icon className="w-5 h-5" />
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
