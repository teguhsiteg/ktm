const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Mahasiswa.tsx', 'utf-8');

// Insert useAdmin import
content = content.replace("import { isBookingExpired } from '@/lib/utils';", "import { isBookingExpired } from '@/lib/utils';\nimport { useAdmin } from '@/contexts/AdminContext';");

// Insert useAdmin hook
content = content.replace("export default function MahasiswaPage() {\n  const [data, setData] = useState<Mahasiswa[]>([]);", "export default function MahasiswaPage() {\n  const { adminData } = useAdmin();\n  const [data, setData] = useState<Mahasiswa[]>([]);");

// Update filtering logic inside onSnapshot
content = content.replace(
  "        data.push({ id: doc.id, ...doc.data() } as Mahasiswa);\n      });\n      setData(data);\n    });",
  "        const m = { id: doc.id, ...doc.data() } as Mahasiswa;\n        if (adminData?.role === 'admin' && adminData.fakultas) {\n          if (m.prodi && m.prodi.toLowerCase().includes(adminData.fakultas.toLowerCase())) {\n            data.push(m);\n          }\n        } else {\n          data.push(m);\n        }\n      });\n      setData(data);\n    });"
);

fs.writeFileSync('src/pages/admin/Mahasiswa.tsx', content);
