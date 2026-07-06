const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Insert ProfilePage import
content = content.replace(
  "import UsersPage from './pages/admin/Users';",
  "import UsersPage from './pages/admin/Users';\nimport ProfilePage from './pages/admin/Profile';"
);

// Add Route
content = content.replace(
  '<Route path="users" element={<UsersPage />} />',
  '<Route path="users" element={<UsersPage />} />\n          <Route path="profil" element={<ProfilePage />} />'
);

fs.writeFileSync('src/App.tsx', content);
