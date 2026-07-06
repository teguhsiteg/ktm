const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Layout.tsx', 'utf-8');

// Add Profile route in menu
content = content.replace(
  "import { LayoutDashboard, Users, CalendarDays, Ticket, ScanLine, LogOut, Sun, Moon } from 'lucide-react';",
  "import { LayoutDashboard, Users, CalendarDays, Ticket, ScanLine, LogOut, Sun, Moon, UserCircle } from 'lucide-react';"
);
content = content.replace(
  "    { name: 'Scanner', path: '/admin/scanner', icon: ScanLine },\n  ];\n\n  if (adminData?.role === 'super_admin') {\n    menu.push({ name: 'Admins', path: '/admin/users', icon: Users });\n  }",
  "    { name: 'Scanner', path: '/admin/scanner', icon: ScanLine },\n  ];\n\n  if (adminData?.role === 'super_admin') {\n    menu.push({ name: 'Admins', path: '/admin/users', icon: Users });\n  }\n  menu.push({ name: 'Profil', path: '/admin/profil', icon: UserCircle });"
);

// We need to make sure UserCircle is imported, it might not be.
// Let's replace the whole import to be safe.
content = content.replace(
  "import { LayoutDashboard, Users, CalendarDays, Ticket, ScanLine, LogOut, Download, Sun, Moon } from 'lucide-react';",
  "import { LayoutDashboard, Users, CalendarDays, Ticket, ScanLine, LogOut, Download, Sun, Moon, UserCircle } from 'lucide-react';"
);

fs.writeFileSync('src/pages/admin/Layout.tsx', content);
