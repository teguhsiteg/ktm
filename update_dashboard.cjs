const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Dashboard.tsx', 'utf-8');

// Insert useAdmin import
content = content.replace("import { isBookingExpired } from '@/lib/utils';", "import { isBookingExpired } from '@/lib/utils';\nimport { useAdmin } from '@/contexts/AdminContext';");

// Insert useAdmin hook
content = content.replace("export default function Dashboard() {\n  const [mahasiswaList, setMahasiswaList] = useState<any[]>([]);", "export default function Dashboard() {\n  const { adminData } = useAdmin();\n  const [mahasiswaList, setMahasiswaList] = useState<any[]>([]);");

// Filter snapshot mapping for mahasiswa
content = content.replace(
  "        data.push({ id: doc.id, ...doc.data() });\n      });\n      setMahasiswaList(data);",
  "        const m = { id: doc.id, ...doc.data() };\n        if (adminData?.role === 'admin' && adminData.fakultas) {\n          const keywords = adminData.fakultas.split(',').map(k => k.trim().toLowerCase());\n          const prodi = (m.prodi || '').toLowerCase();\n          if (keywords.some(k => prodi.includes(k))) data.push(m);\n        } else {\n          data.push(m);\n        }\n      });\n      setMahasiswaList(data);"
);

// We need to also filter bookingList, but booking doesn't contain 'prodi'.
// However, since we now filtered mahasiswaList, we can filter bookings that belong to these mahasiswa.
content = content.replace(
  "        data.push({ id: doc.id, ...doc.data() });\n      });\n      setBookingList(data);",
  "        data.push({ id: doc.id, ...doc.data() });\n      });\n      \n      if (adminData?.role === 'admin') {\n        // Filter bookings by allowed mahasiswa_id\n        const allowedMhsIds = new Set(mahasiswaList.map(m => m.id));\n        // Wait, mahasiswaList might not be updated inside this callback if they run in parallel.\n        // Better to filter it in useEffect when both are available.\n      }\n      setBookingList(data);"
);

fs.writeFileSync('src/pages/admin/Dashboard.tsx', content);
