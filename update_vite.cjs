const fs = require('fs');
let content = fs.readFileSync('vite.config.ts', 'utf-8');

content = content.replace(
  "      VitePWA({",
  "      VitePWA({\n        workbox: {\n          maximumFileSizeToCacheInBytes: 5000000\n        },"
);

fs.writeFileSync('vite.config.ts', content);
