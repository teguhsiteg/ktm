const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Mahasiswa.tsx', 'utf-8');

content = content.replace(
  "        if (adminData?.role === 'admin' && adminData.fakultas) {\n          if (m.prodi && m.prodi.toLowerCase().includes(adminData.fakultas.toLowerCase())) {\n            data.push(m);\n          }\n        } else {\n          data.push(m);\n        }",
  "        if (adminData?.role === 'admin' && adminData.fakultas) {\n          const keywords = adminData.fakultas.split(',').map(k => k.trim().toLowerCase());\n          const prodi = (m.prodi || '').toLowerCase();\n          if (keywords.some(k => prodi.includes(k))) {\n            data.push(m);\n          }\n        } else {\n          data.push(m);\n        }"
);

fs.writeFileSync('src/pages/admin/Mahasiswa.tsx', content);
