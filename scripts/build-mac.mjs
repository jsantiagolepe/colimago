#!/usr/bin/env node
// Compila MyProject.app (y el .dmg) y, con --install, la instala en
// /Applications y la abre.
//
//   npm run app:build     → src-tauri/target/release/bundle/{macos,dmg}/
//   npm run app:install   → además la copia a /Applications y la abre
//
// Firma: usa tu certificado "Developer ID Application" o "Apple
// Development" vigente si existe (así macOS reconoce que cada versión es
// la misma app y el Llavero no vuelve a pedir permiso tras actualizarla);
// si no hay ninguno, firma ad hoc. Se puede forzar con
// MYPROJECT_SIGNING_IDENTITY=<hash o nombre> o MYPROJECT_SIGNING_IDENTITY=-

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const instalar = process.argv.includes('--install');
const NOMBRE_APP = 'MyProject.app';
const destino = join('/Applications', NOMBRE_APP);

function identidadDeFirma() {
  if (process.env.MYPROJECT_SIGNING_IDENTITY) return process.env.MYPROJECT_SIGNING_IDENTITY;
  try {
    const salida = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
    for (const tipo of ['Developer ID Application', 'Apple Development']) {
      const linea = salida.split('\n').find((l) => l.includes(`"${tipo}:`));
      const hash = linea?.match(/\b([0-9A-F]{40})\b/)?.[1];
      if (hash) return hash;
    }
  } catch {
    // sin herramienta `security`: ad hoc
  }
  return '-';
}

function correr(comando, args, opciones = {}) {
  const resultado = spawnSync(comando, args, { stdio: 'inherit', cwd: raiz, ...opciones });
  if (resultado.status !== 0) {
    console.error(`\n✗ Falló: ${comando} ${args.join(' ')}`);
    process.exit(resultado.status ?? 1);
  }
}

const identidad = identidadDeFirma();
console.log(`Firmando con: ${identidad === '-' ? 'firma ad hoc' : identidad}`);

correr('npx', ['tauri', 'build'], { env: { ...process.env, APPLE_SIGNING_IDENTITY: identidad } });

const app = join(raiz, 'src-tauri/target/release/bundle/macos', NOMBRE_APP);
if (!existsSync(app)) {
  console.error(`✗ No se encontró ${app}`);
  process.exit(1);
}
console.log(`\n✓ App: ${app}`);

if (instalar) {
  // Si está abierta, se cierra antes de reemplazarla.
  spawnSync(
    'osascript',
    ['-e', 'if application id "com.juliosantiago.myproject" is running then tell application id "com.juliosantiago.myproject" to quit'],
    { stdio: 'ignore' },
  );
  spawnSync('sleep', ['1']);
  if (existsSync(destino)) rmSync(destino, { recursive: true, force: true });
  correr('ditto', [app, destino]);
  console.log(`✓ Instalada en ${destino}`);
  correr('open', [destino]);
}
