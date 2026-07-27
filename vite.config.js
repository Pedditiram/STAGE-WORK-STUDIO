import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

function localDiskVaultPlugin() {
  const baseDir = '/Users/pedditiram/Documents/PROMPT ENGINEERING';
  const projectsDir = path.join(baseDir, 'projects');
  const settingsDir = path.join(baseDir, 'settings');
  const storageDir = path.join(baseDir, 'storage');

  // Ensure directories exist on server start
  [projectsDir, settingsDir, storageDir].forEach(d => {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  });

  return {
    name: 'sps-local-disk-vault',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // 1. SAVE PROJECT TO PHYSICAL DISK: POST /api/save-project-disk
        if (req.url === '/api/save-project-disk' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const project = JSON.parse(body);
              const title = project.title || 'UNTITLED_PROJECT';
              const safeFilename = title.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
              const filePath = path.join(projectsDir, safeFilename);

              fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf8');

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, filePath, filename: safeFilename }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 2. SAVE SETTINGS TO PHYSICAL DISK: POST /api/save-settings-disk
        if (req.url === '/api/save-settings-disk' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const settingsPkg = JSON.parse(body);
              const filePath = path.join(settingsDir, 'master_app_settings.json');

              fs.writeFileSync(filePath, JSON.stringify(settingsPkg, null, 2), 'utf8');

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, filePath }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 3. SAVE IMAGE TO PHYSICAL DISK: POST /api/save-image-disk
        if (req.url === '/api/save-image-disk' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const { key, imageUrl } = JSON.parse(body);
              const safeKey = (key || 'render').replace(/[^a-zA-Z0-9_-]/g, '_');

              if (imageUrl && imageUrl.startsWith('data:image/')) {
                const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
                const filePath = path.join(storageDir, `${safeKey}.png`);
                fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, filePath }));
                return;
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, note: 'non-base64 url cached' }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 4. LIST ALL PROJECTS FROM PHYSICAL DISK: GET /api/list-projects-disk
        if (req.url === '/api/list-projects-disk' && req.method === 'GET') {
          try {
            const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.json'));
            const projects = [];
            for (const f of files) {
              try {
                const content = fs.readFileSync(path.join(projectsDir, f), 'utf8');
                const parsed = JSON.parse(content);
                projects.push(parsed);
              } catch (e) {}
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ projects }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localDiskVaultPlugin()
  ],
  server: {
    host: true, // Exposes app on local intranet (Wi-Fi / LAN)
    port: 5173
  }
})
