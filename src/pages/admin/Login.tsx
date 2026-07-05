import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Lock, Mail, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Mohon isi email dan password');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin/dashboard');
    } catch (error: any) {
      toast.error('Email atau password salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex bg-gray-50 dark:bg-[#0A0A0A] transition-colors duration-300 font-['Roboto',_sans-serif]">
      {/* Left Panel - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[45%] relative bg-[#005BAC] dark:bg-blue-900 overflow-hidden items-center justify-center">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-600/20 mix-blend-multiply" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          {/* Abstract circles */}
          <div className="absolute top-1/4 -left-12 w-64 h-64 bg-blue-400/30 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-12 w-64 h-64 bg-purple-400/30 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 p-12 text-white max-w-xl">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/20 shadow-xl">
            <img 
              src="https://www.uii.ac.id/wp-content/uploads/2017/04/Logo-UII-Asli.png" 
              alt="Logo UII" 
              className="w-10 h-10 object-contain drop-shadow-md brightness-0 invert"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight mb-6 leading-[1.15]">
            Distribusi KTM<br/>
            <span className="text-blue-200">Lebih Cepat & Tertata.</span>
          </h1>
          <p className="text-blue-100/90 text-lg mb-8 leading-relaxed max-w-md font-medium">
            Sistem manajemen antrean dan distribusi Kartu Tanda Mahasiswa berbasis QR Code terintegrasi.
          </p>
          <div className="flex items-center gap-4 text-sm font-semibold text-blue-100 bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-xl border border-white/10 w-fit shadow-inner">
            <ShieldCheck className="w-5 h-5 text-blue-200" />
            <span>Secure Admin Portal Access</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-[55%] flex items-center justify-center p-6 sm:p-12 md:p-16 relative">
        <div className="w-full max-w-[420px] relative z-10">
          
          <div className="lg:hidden mb-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-5 shadow-sm border border-gray-200 dark:border-gray-800">
              <img 
                src="https://www.uii.ac.id/wp-content/uploads/2017/04/Logo-UII-Asli.png" 
                alt="Logo UII" 
                className="w-10 h-10 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Admin Portal</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5 font-medium">Manajemen Distribusi KTM UII</p>
          </div>

          <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl shadow-xl shadow-gray-200/40 dark:shadow-black/40 border border-gray-100 dark:border-gray-800/60 p-8 sm:p-10 relative overflow-hidden">
            
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            <div className="mb-8 relative">
              <h2 className="text-[22px] font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Selamat Datang</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Masuk untuk mengelola sistem distribusi.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 relative">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email Address</Label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-500 transition-colors" />
                  <Input 
                    type="email"
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    placeholder="admin@uii.ac.id" 
                    className="pl-11 h-12 bg-gray-50/50 dark:bg-zinc-900/50 border-gray-200 dark:border-gray-700/80 focus:bg-white dark:focus:bg-[#1A1A1A] transition-colors rounded-xl text-[15px] font-medium placeholder:text-gray-400"
                    required 
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-500 transition-colors" />
                  <Input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="pl-11 h-12 bg-gray-50/50 dark:bg-zinc-900/50 border-gray-200 dark:border-gray-700/80 focus:bg-white dark:focus:bg-[#1A1A1A] transition-colors rounded-xl text-[15px] font-medium placeholder:text-gray-400"
                    required 
                  />
                </div>
              </div>

              <div className="pt-3">
                <Button 
                  className="w-full h-12 text-[15px] font-bold bg-[#005BAC] hover:bg-[#004A8C] dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 group" 
                  type="submit" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <span>Masuk ke Dashboard</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
          
          <div className="mt-8 text-center text-[13px] text-gray-400 dark:text-gray-500 font-medium">
            &copy; {new Date().getFullYear()} Universitas Islam Indonesia.
          </div>
        </div>
      </div>
    </div>
  );
}

