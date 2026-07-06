import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { toast } from 'sonner';

interface AdminData {
  role: 'super_admin' | 'admin';
  fakultas?: string;
  email?: string;
  last_login?: string;
  last_logout?: string;
  nama?: string;
}

interface AdminContextType {
  adminData: AdminData | null;
  loadingAdmin: boolean;
  currentUser: User | null;
}

const AdminContext = createContext<AdminContextType>({ adminData: null, loadingAdmin: true, currentUser: null });

export const useAdmin = () => useContext(AdminContext);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto Logout setelah 15 menit tidak ada aktivitas
  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      if (auth.currentUser) {
        if (auth.currentUser) {
          await updateDoc(doc(db, 'admins', auth.currentUser.uid), {
            last_logout: new Date().toISOString()
          });
        }
        await signOut(auth);
        toast.info('Sesi Anda telah berakhir karena tidak ada aktivitas.');
      }
    }, 15 * 60 * 1000); // 15 menit
  };

  useEffect(() => {
    // Event listeners untuk aktivitas pengguna
    const events = ['mousemove', 'mousedown', 'keypress', 'touchmove', 'scroll'];
    const handleActivity = () => resetTimer();
    
    events.forEach(event => window.addEventListener(event, handleActivity));
    resetTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        resetTimer(); // Reset timer saat login
        
        const isSuperAdminEmail = user.email === '236102601@uii.ac.id';
        
        // Search by email first to support manually added admins who haven't logged in yet
        const adminsRef = collection(db, 'admins');
        const q = query(adminsRef, where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        
        let activeDocRef = null;

        if (!querySnapshot.empty) {
          // Admin found by email
          const docSnap = querySnapshot.docs[0];
          activeDocRef = docSnap.ref;
          const data = docSnap.data() as AdminData;
          
          await updateDoc(activeDocRef, {
            last_login: new Date().toISOString(),
            ...(isSuperAdminEmail && data.role !== 'super_admin' ? { role: 'super_admin' } : {})
          });
        } else {
          // Check by uid (fallback for existing admins)
          activeDocRef = doc(db, 'admins', user.uid);
          const docSnap = await getDoc(activeDocRef);
          
          if (!docSnap.exists()) {
            const newAdmin: AdminData = { 
              role: isSuperAdminEmail ? 'super_admin' : 'admin',
              email: user.email || '',
              last_login: new Date().toISOString()
            };
            await setDoc(activeDocRef, newAdmin);
          } else {
            const data = docSnap.data() as AdminData;
            await updateDoc(activeDocRef, {
              last_login: new Date().toISOString(),
              ...(isSuperAdminEmail && data.role !== 'super_admin' ? { role: 'super_admin' } : {})
            });
          }
        }

        // Listen for live updates using the resolved document reference
        unsubSnapshot = onSnapshot(activeDocRef, (snap) => {
          if (snap.exists()) {
            setAdminData(snap.data() as AdminData);
          } else {
            setAdminData(null);
          }
          setLoadingAdmin(false);
        });

      } else {
        setAdminData(null);
        setLoadingAdmin(false);
        if (unsubSnapshot) unsubSnapshot();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  return (
    <AdminContext.Provider value={{ adminData, loadingAdmin, currentUser }}>
      {children}
    </AdminContext.Provider>
  );
}
