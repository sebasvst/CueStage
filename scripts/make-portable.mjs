/**
 * Generates a portable Windows build.
 *
 * Copies the release executable into `portable/CueStage/` together with a short
 * readme. The WebView2 runtime is not bundled (it ships with Windows 11 and can be
 * installed separately on Windows 10).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const executable = join(root, 'src-tauri', 'target', 'release', 'cuestage.exe');
const nsisDir = join(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis');

const outputDir = join(root, 'portable', 'CueStage');

if (!existsSync(executable)) {
  console.error(
    'No se encontró el ejecutable compilado.\n' +
      'Ejecuta primero:  npm run build',
  );
  process.exit(1);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

copyFileSync(executable, join(outputDir, 'CueStage.exe'));
console.log('  CueStage.exe');

// The installer is copied as well, when it has been generated.
if (existsSync(nsisDir)) {
  const installers = readdirSync(nsisDir).filter((name) => name.endsWith('.exe'));
  const first = installers[0];
  if (first) {
    mkdirSync(join(outputDir, 'installer'), { recursive: true });
    copyFileSync(join(nsisDir, first), join(outputDir, 'installer', first));
    console.log(`  installer/${first}`);
  }
}

writeFileSync(
  join(outputDir, 'LEEME.txt'),
  [
    'CueStage — versión portable',
    '',
    'Ejecuta CueStage.exe.',
    '',
    'Requisitos:',
    '  · Windows 10 1809 o superior / Windows 11 (64 bits)',
    '  · Microsoft Edge WebView2 Runtime',
    '    (incluido en Windows 11; en Windows 10 se instala desde',
    '     https://developer.microsoft.com/microsoft-edge/webview2/)',
    '',
    'Los proyectos y el audio se guardan en:',
    '  %APPDATA%\\com.cuestage.desktop\\projects',
    '',
  ].join('\n'),
  'utf8',
);

console.log(`\nVersión portable creada en: ${outputDir}`);
