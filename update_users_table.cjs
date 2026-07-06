const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Users.tsx', 'utf-8');

content = content.replace(
  "import { Trash2, UserPlus, Shield, UserCog } from 'lucide-react';",
  "import { Trash2, UserPlus, Shield, UserCog } from 'lucide-react';\nimport { format } from 'date-fns';\nimport { id as localeID } from 'date-fns/locale';"
);

content = content.replace(
  "fakultas?: string;\n}",
  "fakultas?: string;\n  last_login?: string;\n  last_logout?: string;\n}"
);

content = content.replace(
  "} catch (error: any) {\n      console.error(error);\n      toast.error(`Gagal: ${error.message}`);\n    }",
  "} catch (error: any) {\n      console.error(error);\n      if (error.code === 'auth/email-already-in-use') {\n        toast.error('Email ini sudah terdaftar sebagai pengguna di sistem. Silakan gunakan email lain atau hubungi admin.');\n      } else {\n        toast.error(`Gagal: ${error.message}`);\n      }\n    }"
);

content = content.replace(
  '<th className="px-4 py-3 font-semibold">Fakultas</th>\n                    <th className="px-4 py-3 font-semibold text-right rounded-tr-lg">Aksi</th>',
  '<th className="px-4 py-3 font-semibold">Fakultas</th>\n                    <th className="px-4 py-3 font-semibold">Aktivitas Terakhir</th>\n                    <th className="px-4 py-3 font-semibold text-right rounded-tr-lg">Aksi</th>'
);

content = content.replace(
  '<td className="px-4 py-3 text-gray-600 dark:text-gray-400">\n                        {admin.fakultas || \'-\'}\n                      </td>\n                      <td className="px-4 py-3 text-right">',
  `<td className="px-4 py-3 text-gray-600 dark:text-gray-400">\n                        {admin.fakultas || '-'}\n                      </td>\n                      <td className="px-4 py-3 text-xs text-gray-500">\n                        <div className="flex flex-col gap-1">\n                          <span className="text-green-600 dark:text-green-400">Login: {admin.last_login ? format(new Date(admin.last_login), "dd MMM yyyy HH:mm", { locale: localeID }) : '-'}</span>\n                          <span className="text-gray-500 dark:text-gray-400">Logout: {admin.last_logout ? format(new Date(admin.last_logout), "dd MMM yyyy HH:mm", { locale: localeID }) : '-'}</span>\n                        </div>\n                      </td>\n                      <td className="px-4 py-3 text-right">`
);

fs.writeFileSync('src/pages/admin/Users.tsx', content);
