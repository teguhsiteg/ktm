const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Layout.tsx', 'utf-8');

// Insert useAdmin import
content = content.replace("import { onAuthStateChanged, signOut } from 'firebase/auth';", "import { onAuthStateChanged, signOut } from 'firebase/auth';\nimport { useAdmin } from '@/contexts/AdminContext';");

// Use useAdmin hook
content = content.replace("  const [currentTime, setCurrentTime] = useState(new Date());", "  const [currentTime, setCurrentTime] = useState(new Date());\n  const { adminData, loadingAdmin } = useAdmin();");

// Add Admin Management menu conditionally
content = content.replace("    { name: 'Scanner', path: '/admin/scanner', icon: ScanLine },\n  ];", "    { name: 'Scanner', path: '/admin/scanner', icon: ScanLine },\n  ];\n\n  if (adminData?.role === 'super_admin') {\n    menu.push({ name: 'Admins', path: '/admin/users', icon: Users });\n  }");

// Update Admin info display
content = content.replace(
  '<p className="text-[10px] text-gray-500 truncate">Super Administrator</p>',
  '<p className="text-[10px] text-gray-500 truncate">{adminData?.role === "super_admin" ? "Super Administrator" : `Admin ${adminData?.fakultas || ""}`}</p>'
);

fs.writeFileSync('src/pages/admin/Layout.tsx', content);
