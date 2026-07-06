const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Booking.tsx', 'utf-8');

// Insert useAdmin import
content = content.replace("import { isBookingExpired } from '@/lib/utils';", "import { isBookingExpired } from '@/lib/utils';\nimport { useAdmin } from '@/contexts/AdminContext';");

// Insert useAdmin hook
content = content.replace("export default function BookingPage() {\n  const [bookings, setBookings] = useState<(Booking & { mhs?: Mahasiswa })[]>([]);", "export default function BookingPage() {\n  const { adminData } = useAdmin();\n  const [bookings, setBookings] = useState<(Booking & { mhs?: Mahasiswa })[]>([]);");

// Update filtering logic inside processedData
content = content.replace(
  "  const processedData = useMemo(() => {\n    let filtered = bookings.map(b => ({\n      ...b,\n      mhs: mahasiswaMap[b.mahasiswa_id]\n    }));",
  "  const processedData = useMemo(() => {\n    let filtered = bookings.map(b => ({\n      ...b,\n      mhs: mahasiswaMap[b.mahasiswa_id]\n    }));\n\n    if (adminData?.role === 'admin' && adminData.fakultas) {\n      const keywords = adminData.fakultas.split(',').map(k => k.trim().toLowerCase());\n      filtered = filtered.filter(b => {\n        const prodi = (b.mhs?.prodi || '').toLowerCase();\n        return keywords.some(k => prodi.includes(k));\n      });\n    }"
);

fs.writeFileSync('src/pages/admin/Booking.tsx', content);
