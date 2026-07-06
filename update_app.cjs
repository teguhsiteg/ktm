const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Insert UsersPage import
content = content.replace(
  "import LoginPage from './pages/admin/Login';",
  "import LoginPage from './pages/admin/Login';\nimport UsersPage from './pages/admin/Users';"
);

// Add Route
content = content.replace(
  '<Route path="scanner" element={<ScannerPage />} />',
  '<Route path="scanner" element={<ScannerPage />} />\n          <Route path="users" element={<UsersPage />} />'
);

fs.writeFileSync('src/App.tsx', content);
