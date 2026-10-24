/**
 * Comprobación del entorno de CueStage.
 *
 *   npm run setup
 *
 * Revisa que estén las herramientas necesarias para trabajar en la
 * aplicación y dice exactamente qué hacer si falta algo.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const results = [];

function check(name, status, detail, advice) {
  results.push({ name, status, detail, advice });
}

function run(command, args, useShell = process.platform === 'win32') {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 20000,
      // Los comandos con espacio en la ruta (vswhere) no pueden usar shell.
      shell: useShell,
    }).trim();
  } catch {
    return null;
  }
}

function versionOf(command, args = ['--version']) {
  const output = run(command, args);
  if (!output) return null;
  return output.split(/\r?\n/)[0].trim();
}

// ---------------------------------------------------------------- Node ----

const nodeVersion = process.versions.node;
const [nodeMajor] = nodeVersion.split('.').map(Number);
if (nodeMajor >= 20) {
  check('Node.js', 'ok', `v${nodeVersion}`);
} else {
  check(
    'Node.js',
    'fail',
    `v${nodeVersion}`,
    'Se necesita Node 20 o superior: https://nodejs.org',
  );
}

const npmVersion = versionOf(process.platform === 'win32' ? 'npm.cmd' : 'npm');
if (npmVersion) {
  check('npm', 'ok', npmVersion.replace(/^v/, ''));
} else {
  check('npm', 'fail', 'no encontrado', 'Reinstala Node.js con la instalación estándar.');
}

// ---------------------------------------------------------------- Rust ----

const cargoVersion = versionOf('cargo');
if (cargoVersion) {
  check('Rust (cargo)', 'ok', cargoVersion);
} else {
  check(
    'Rust (cargo)',
    'warn',
    'no encontrado',
    'Solo hace falta para compilar la aplicación de escritorio: https://rustup.rs',
  );
}

// ------------------------------------------------------ Visual Studio -----

const vsWhere = join(
  process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
  'Microsoft Visual Studio',
  'Installer',
  'vswhere.exe',
);
let hasMsvc = false;
if (existsSync(vsWhere)) {
  const output = run(
    vsWhere,
    [
      '-products',
      '*',
      '-requires',
      'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      '-property',
      'installationPath',
    ],
    false,
  );
  hasMsvc = Boolean(output);
} else {
  hasMsvc = existsSync(
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools',
  );
}

if (hasMsvc) {
  check('Visual Studio Build Tools', 'ok', 'C++ de Windows instalado');
} else {
  check(
    'Visual Studio Build Tools',
    'warn',
    'no encontrado',
    'Necesario para compilar el .exe: instalador con el workload «Desarrollo para el escritorio con C++».',
  );
}

// ------------------------------------------------------------- WebView2 ---

const webView2Paths = [
  'C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application',
  'C:\\Program Files\\Microsoft\\EdgeWebView\\Application',
];
const webView2 = webView2Paths.find((path) => existsSync(path));
if (webView2) {
  const versions = existsSync(webView2)
    ? readdirSync(webView2).filter((name) => /^\d+\./.test(name))
    : [];
  check(
    'WebView2 Runtime',
    'ok',
    versions.length ? `versión ${versions[versions.length - 1]}` : 'instalado',
  );
} else {
  check(
    'WebView2 Runtime',
    'warn',
    'no encontrado',
    'Windows 11 lo trae de serie. En Windows 10 instálalo desde developer.microsoft.com/microsoft-edge/webview2',
  );
}

// ------------------------------------------------------------- Proyecto ---

check(
  'Dependencias de npm',
  existsSync(join(root, 'node_modules')) ? 'ok' : 'fail',
  existsSync(join(root, 'node_modules')) ? 'instaladas' : 'faltan',
  'Ejecuta: npm install',
);

const distFolder = join(root, 'dist');
check(
  'Compilación del frontend',
  existsSync(join(distFolder, 'index.html')) ? 'ok' : 'warn',
  existsSync(join(distFolder, 'index.html')) ? 'en dist/' : 'sin compilar',
  'Ejecuta: npm run build:frontend',
);

const releaseExe = join(root, 'src-tauri', 'target', 'release', 'cuestage.exe');
check(
  'Ejecutable de escritorio',
  existsSync(releaseExe) ? 'ok' : 'warn',
  existsSync(releaseExe) ? releaseExe : 'sin compilar',
  'Ejecuta: npm run build',
);

// ------------------------------------------------------ Carpeta de datos ---

const appData = process.env['APPDATA'] ?? '';
if (appData) {
  const projects = join(appData, 'com.cuestage.desktop', 'projects');
  try {
    mkdirSync(projects, { recursive: true });
    const probe = join(projects, '.escritura-prueba');
    writeFileSync(probe, 'ok');
    rmSync(probe, { force: true });
    check('Carpeta de presentaciones', 'ok', projects);
  } catch (error) {
    check(
      'Carpeta de presentaciones',
      'fail',
      projects,
      `No se puede escribir: ${error instanceof Error ? error.message : 'error'}`,
    );
  }
}

// ------------------------------------------------------------- Informe -----

const marks = { ok: 'OK   ', warn: 'AVISO', fail: 'FALLO' };
const colors = { ok: '\u001b[32m', warn: '\u001b[33m', fail: '\u001b[31m' };
const reset = '\u001b[0m';

console.log('\n  CueStage · comprobación del entorno\n');
for (const item of results) {
  console.log(`  ${colors[item.status]}${marks[item.status]}${reset}  ${item.name.padEnd(26)} ${item.detail}`);
  if (item.status !== 'ok' && item.advice) {
    console.log(`        \u001b[2m→ ${item.advice}${reset}`);
  }
}

const failures = results.filter((item) => item.status === 'fail');
const warnings = results.filter((item) => item.status === 'warn');

console.log('');
if (failures.length === 0) {
  console.log('  \u001b[32mTodo listo para trabajar.\u001b[0m\n');
  console.log('    npm run dev:tauri   Abre la aplicación de escritorio');
  console.log('    npm test            Ejecuta las pruebas');
  console.log('    npm run build       Compila el instalador de Windows\n');
} else {
  console.log(
    `  \u001b[31mFaltan ${failures.length} requisito(s).${reset} Corrige lo de arriba y vuelve a ejecutar: npm run setup\n`,
  );
}
if (warnings.length > 0) {
  console.log(
    `  \u001b[2m${warnings.length} aviso(s): no hacen falta para usar la aplicación ya compilada.\u001b[0m\n`,
  );
}

// Con --warn el comprobador no detiene el proceso: sirve para revisar el
// entorno antes de empaquetar sin impedir la compilación.
const warnOnly = process.argv.includes('--warn');
process.exit(failures.length > 0 && !warnOnly ? 1 : 0);
