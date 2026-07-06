import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/mahasiswa/LandingPage';
import SchedulePage from './pages/mahasiswa/SchedulePage';
import TicketPage from './pages/mahasiswa/TicketPage';
import AdminLayout from './pages/admin/Layout';
import Dashboard from './pages/admin/Dashboard';
import MahasiswaPage from './pages/admin/Mahasiswa';
import JadwalPage from './pages/admin/Jadwal';
import BookingPage from './pages/admin/Booking';
import ScannerPage from './pages/admin/Scanner';
import LoginPage from './pages/admin/Login';
import UsersPage from './pages/admin/Users';
import ProfilePage from './pages/admin/Profile';
import { Toaster } from 'sonner';
import PublicScannerPage from './pages/PublicScanner';
import { AdminProvider } from './contexts/AdminContext';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        {/* Mahasiswa Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/schedule/:id" element={<SchedulePage />} />
        <Route path="/ticket/:bookingId" element={<TicketPage />} />
        <Route path="/scanner" element={<PublicScannerPage />} />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={
          <AdminProvider>
            <AdminLayout />
          </AdminProvider>
        }>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="mahasiswa" element={<MahasiswaPage />} />
          <Route path="jadwal" element={<JadwalPage />} />
          <Route path="booking" element={<BookingPage />} />
          <Route path="scanner" element={<ScannerPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="profil" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
