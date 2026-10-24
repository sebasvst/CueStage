/**
 * Genera la plantilla del instalador NSIS.
 *
 *   node scripts/make-installer-template.mjs
 *
 * Lee el archivo base (generado por Tauri), reemplaza marcadores con valores
 * del proyecto y escribe el resultado como UTF-8 válido.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const tauriDir = join(root, 'src-tauri');

const basePath = join(tauriDir, 'windows', 'installer-base.nsi');
const targetPath = join(tauriDir, 'windows', 'installer.nsi');
const config = JSON.parse(readFileSync(join(tauriDir, 'tauri.conf.json'), 'utf8'));
const licencePath = join(tauriDir, 'windows', 'LICENCIA.txt');
const licence = readFileSync(licencePath, 'utf8');

const productName = config.productName ?? 'CueStage';
const version = config.version ?? '0.1.0';
const publisher = config.publisher ?? productName;
const description = config.bundle?.shortDescription ?? '';
const iconPath = join(tauriDir, 'icons', 'icon.ico');
const headerPath = join(tauriDir, 'windows', 'header.bmp');
const sidebarPath = join(tauriDir, 'windows', 'sidebar.bmp');

let template = readFileSync(basePath, 'utf8');
// Strip UTF-8 BOM if present (NSIS doesn't like it)
if (template.charCodeAt(0) === 0xFEFF) {
  template = template.slice(1);
}

/** Reemplaza un marcador !define NOMBRE "valor". */
function define(name, value) {
  const pattern = new RegExp(`!define ${name} ".*"`);
  if (!pattern.test(template)) {
    console.warn(`  aviso: no se encontró el marcador ${name}`);
    return;
  }
  template = template.replace(pattern, `!define ${name} "${value}"`);
}

define('INSTALLERICON', iconPath);
define('UNINSTALLERICON', iconPath);
define('SIDEBARIMAGE', sidebarPath);
define('HEADERIMAGE', headerPath);
define('UNINSTALLERHEADERIMAGE', headerPath);
define('PRODUCTNAME', productName);
define('VERSION', version);
define('MANUFACTURER', publisher);
define('COPYRIGHT', config.bundle?.copyright ?? productName);
define('DESCRIPTION', description);
define('MANUFACTURERWEB', '');
define('INFOURL', '');

const texts = `
; --------------------------------------------------------------- Textos --
!define MUI_WELCOMEPAGE_TITLE "CueStage se instala en este equipo"
!define MUI_WELCOMEPAGE_TEXT "CueStage reproduce la música de fondo y te dispara los sonidos en el momento en que hacen falta.$\\r\\n$\\r\\nTodo ocurre en este equipo: no hay cuentas, ni conexión a internet, ni información que salga de este equipo.$\\r\\n$\\r\\nPulsa «Instalar» para continuar."
!define MUI_LICENSEPAGE_TEXT "Lee lo que sigue antes de instalar.$\\r\\n$\\r\\nCueStage se distribuye bajo la licencia MIT y funciona completamente en este equipo."
!define MUI_FINISHPAGE_TITLE "CueStage ya está instalado"
!define MUI_FINISHPAGE_TEXT "Ya puedes preparar tu primera presentación: añade la música y los sonidos, y entra en «En vivo» para actuar.$\\r\\n$\\r\\nPulsa «Ejecutar CueStage» para abrirla ahora."
!define MUI_UNCONFIRMPAGE_TEXT "Se va a desinstalar CueStage de este equipo.$\\r\\n$\\r\\nTus presentaciones y tus archivos de audio se quedan guardados, salvo que marques la casilla de abajo."
!define MUI_UNINSTALLEDIR_TEXT "Elige la carpeta de la que se va a quitar CueStage.$\\r\\n$\\r\\nTus presentaciones y archivos de audio se conservan."
!define MUI_UNCONFIRMCHECKBOX "Eliminar también los datos de la aplicación (presentaciones y archivos)"
!define MUI_MAKEWEBPAGE_TITLE "CueStage"
!define MUI_MAKEWEBPAGE_DESCRIPTION "Música y sonidos para actuar en vivo."
`;

const window = `
; --------------------------------------------------------------- Aspecto --
!define MUI_WINDOW 700
`;

const anchor = '; Installer pages, must be ordered as they appear';
if (!template.includes(anchor)) {
  console.error('  No se encontró el punto de inserción en la plantilla.');
  process.exit(1);
}
template = template.replace(anchor, `${texts}\n${window}\n${anchor}`);

// Escribir como UTF-8: todos los caracteres U+0080-U+00FF se convierten en
// secuencias UTF-8 de 2 bytes, así que el resultado es siempre UTF-8 válido.
writeFileSync(targetPath, Buffer.from(template, 'utf8'));

console.log('  Plantilla del instalador generada');
console.log(`    producto : ${productName} ${version}`);
console.log(`    cabecera : ${headerPath}`);
console.log(`    lateral  : ${sidebarPath}`);
console.log(`    licencia : ${licence.length} caracteres`);
console.log(`    destino  : ${targetPath}`);