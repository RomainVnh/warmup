import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// La règle de sécurité du contenu n'est ajoutée qu'à la version finale.
// Seule adresse extérieure autorisée : les visuels officiels de Steam, pour les jeux que le catalogue ne connaît pas.
// Précision :
// en développement, le rechargement à chaud de React a besoin de scripts en ligne.
const csp = (): Plugin => ({
  name: 'warmup-csp',
  apply: 'build',
  transformIndexHtml(html) {
    const rule = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://shared.akamai.steamstatic.com https://shared.fastly.steamstatic.com; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'";
    return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${rule}">`);
  }
});

// Copie de public/ vers dist/, sans les doublons « nom 2.jpg » qu'iCloud crée dans le dossier Documents.
// Ces doublons restent dans iCloud : les lire un par un bloquait la construction pendant de longues minutes.
const copyPublic = (): Plugin => ({
  name: 'warmup-copie-public',
  apply: 'build',
  closeBundle() {
    const skip = (name: string) => name === '.DS_Store' || / \d+(\.[a-z0-9]+)?$/i.test(name);
    const copy = (from: string, to: string) => {
      fs.mkdirSync(to, { recursive: true });
      for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        if (skip(entry.name)) continue;
        const source = path.join(from, entry.name);
        const target = path.join(to, entry.name);
        if (entry.isDirectory()) copy(source, target);
        else if (entry.isFile()) fs.copyFileSync(source, target);
      }
    };
    copy(path.resolve(__dirname, 'public'), path.resolve(__dirname, 'dist'));
  }
});

export default defineConfig({
  base: './',
  plugins: [react(), csp(), copyPublic()],
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, copyPublicDir: false }
});
