const fs = require('fs');
let content = fs.readFileSync('src/contexts/AdminContext.tsx', 'utf-8');

content = content.replace(
  "import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';",
  "import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';"
);

const newAuthLogic = `
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
        });`;

content = content.replace(
  /const docRef = doc\(db, 'admins', user\.uid\);[\s\S]*?setLoadingAdmin\(false\);\n        }\);/g,
  newAuthLogic.trim()
);

fs.writeFileSync('src/contexts/AdminContext.tsx', content);
