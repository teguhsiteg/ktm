const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Users.tsx', 'utf-8');

content = content.replace(
  /<select[\s\S]*?<\/select>/m,
  '<Input value={fakultas} onChange={e => setFakultas(e.target.value)} placeholder="Misal: FTI, Informatika, Hukum" required />'
);

content = content.replace(
  '<Label>Fakultas</Label>',
  '<Label>Keyword Akses Prodi (Koma jika lebih dari satu)</Label>'
);

fs.writeFileSync('src/pages/admin/Users.tsx', content);
