const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Dashboard.tsx', 'utf-8');

// Insert useAdmin hook if not present (it is present now)
// We just need to modify the useEffect where stats are calculated.

content = content.replace(
  "    mahasiswaList.forEach(m => {",
  "    let filteredMahasiswa = mahasiswaList;\n    if (adminData?.role === 'admin' && adminData.fakultas) {\n      const keywords = adminData.fakultas.split(',').map(k => k.trim().toLowerCase());\n      filteredMahasiswa = mahasiswaList.filter(m => keywords.some(k => (m.prodi || '').toLowerCase().includes(k)));\n    }\n\n    filteredMahasiswa.forEach(m => {"
);

content = content.replace(
  "      totalMahasiswa: mahasiswaList.length,",
  "      totalMahasiswa: filteredMahasiswa.length,"
);

// We need to also filter bookingList for the booking stats, relying on filteredMahasiswa.
content = content.replace(
  "    const activeBookings = bookingList.filter(b => b.status === 'Belum Diambil');",
  "    const allowedMhsIds = new Set(filteredMahasiswa.map(m => m.id));\n    let filteredBookings = bookingList;\n    if (adminData?.role === 'admin') {\n      filteredBookings = bookingList.filter(b => allowedMhsIds.has(b.mahasiswa_id));\n    }\n    const activeBookings = filteredBookings.filter(b => b.status === 'Belum Diambil');"
);

content = content.replace(
  "    const takenBookings = bookingList.filter(b => b.status === 'Sudah Diambil');",
  "    const takenBookings = filteredBookings.filter(b => b.status === 'Sudah Diambil');"
);

content = content.replace(
  "    const missedBookings = bookingList.filter(b => b.status === 'Hangus');",
  "    const missedBookings = filteredBookings.filter(b => b.status === 'Hangus');"
);

fs.writeFileSync('src/pages/admin/Dashboard.tsx', content);
