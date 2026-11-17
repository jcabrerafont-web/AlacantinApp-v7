// Servidor estático para las pruebas: sirve la app en "modo dispositivo".
// js/config.js lleva los datos reales de Supabase; aquí se sirven vacíos para que
// las pruebas no dependan del servidor (ni del CDN de supabase-js).
// Uso: node tests/servidor.mjs [puerto]   (por defecto 8820)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const puerto = Number(process.argv[2] || 8820);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.pdf': 'application/pdf'
};

export const configDispositivo = (texto) => texto
  .replace(/supabaseUrl:\s*'[^']*'/, "supabaseUrl: ''")
  .replace(/supabaseAnonKey:\s*'[^']*'/, "supabaseAnonKey: ''");

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  http.createServer((req, res) => {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta.endsWith('/')) ruta += 'index.html';
    const archivo = path.join(raiz, path.normalize(ruta));
    if (!archivo.startsWith(raiz)) { res.writeHead(403).end(); return; }
    fs.readFile(archivo, (err, datos) => {
      if (err) { res.writeHead(404).end('No encontrado'); return; }
      if (ruta === '/js/config.js') datos = Buffer.from(configDispositivo(datos.toString('utf8')));
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
      res.end(datos);
    });
  }).listen(puerto, () => console.log(`Pruebas: app en modo dispositivo en http://localhost:${puerto}`));
}
