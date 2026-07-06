const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/Users.tsx', 'utf-8');

content = content.replace(
  "if (error.code === 'auth/email-already-in-use') {\n        toast.error('Email ini sudah terdaftar sebagai pengguna di sistem. Silakan gunakan email lain atau hubungi admin.');\n      } else {",
  "if (error.code === 'auth/email-already-in-use') {\n        try {\n          // User already exists in Auth, just give them admin access\n          await setDoc(doc(db, 'admins', email), {\n            email,\n            role: 'admin',\n            fakultas\n          });\n          toast.success('Email sudah terdaftar. Akses admin berhasil ditambahkan.');\n          setEmail('');\n          setPassword('');\n          setFakultas('');\n        } catch (dbError) {\n          toast.error('Gagal menambahkan ke database.');\n        }\n      } else {"
);

fs.writeFileSync('src/pages/admin/Users.tsx', content);
