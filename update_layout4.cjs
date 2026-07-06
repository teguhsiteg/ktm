const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Layout.tsx', 'utf-8');

content = content.replace(
  '<p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">Admin Akademik</p>',
  '<p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{adminData?.nama || "Admin Akademik"}</p>'
);

fs.writeFileSync('src/pages/admin/Layout.tsx', content);
