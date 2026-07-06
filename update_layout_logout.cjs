const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Layout.tsx', 'utf-8');

content = content.replace(
  "import { onAuthStateChanged, signOut } from 'firebase/auth';",
  "import { onAuthStateChanged, signOut } from 'firebase/auth';\nimport { doc, updateDoc } from 'firebase/firestore';\nimport { db } from '@/lib/firebase';"
);

content = content.replace(
  "const handleLogout = async () => {\n    await signOut(auth);",
  "const handleLogout = async () => {\n    if (auth.currentUser) {\n      try {\n        await updateDoc(doc(db, 'admins', auth.currentUser.uid), {\n          last_logout: new Date().toISOString()\n        });\n      } catch (e) { console.error(e); }\n    }\n    await signOut(auth);"
);

fs.writeFileSync('src/pages/admin/Layout.tsx', content);
