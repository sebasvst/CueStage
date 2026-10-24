# CueStage

**Control de música y efectos de sonido para presentaciones en vivo.**

CueStage reproduce una música principal mientras el operador dispara múltiples efectos de
sonido desde botones y atajos de teclado. Está pensado para presentaciones escolares,
actuaciones teatrales, eventos y espectáculos: se prepara con calma en **Preparar** y
se ejecuta con un solo clic desde **En vivo**.

Todo funciona en local: no hay cuentas, ni suscripciones, ni conexión a Internet.

---

## Puesta en marcha

### 1. Comprueba el entorno (un solo comando)

```powershell
npm run setup
```

Revisa Node, npm, Rust, las Build Tools de Visual C++, el runtime de WebView2, las
dependencias, la carpeta de presentaciones y si la aplicación está compilada. Cada
línea dice qué falta y el comando exacto para arreglarlo:

```
  OK    Node.js                    v24.20.0
  OK    npm                        11.19.0
  OK    Rust (cargo)               cargo 1.99.1
  OK    Visual Studio Build Tools  C++ de Windows instalado
  OK    WebView2 Runtime           versión 155.0.4283.62
  OK    Dependencias de npm        instaladas
  AVISO Compilación del frontend   sin compilar
        → Ejecuta: npm run build:frontend
  OK    Carpeta de presentaciones  C:\...\AppData\Roaming\com.cuestage.desktop\projects
```

### 2. Instala y arranca

```powershell
npm install
npm run dev:tauri
```

### 3. Los tres primeros minutos

La aplicación está pensada para que no haga falta ningún manual:

1. En **Proyectos**, pulsa **Empezar ahora**. Se crea la presentación y se abre la
   guía.
2. La guía te va diciendo el siguiente paso: **añade tus archivos**. Al elegir la
   música y los sonidos, cada uno recibe **un botón automáticamente** y el primero
   se convierte en la música de fondo.
3. Cuando esté todo, la guía muestra **«¡Todo listo!»** y te lleva a **En vivo**.

Ahí los botones son grandes, cada uno muestra su tecla y el botón rojo
**Detener todo** está siempre a mano.

---

## Índice

1. [Funciones implementadas](#funciones-implementadas)
2. [Requisitos del sistema](#requisitos-del-sistema)
3. [Instalación de dependencias](#instalación-de-dependencias)
4. [Ejecutar en modo desarrollo](#ejecutar-en-modo-desarrollo)
5. [Comandos de pruebas y comprobaciones](#comandos-de-pruebas-y-comprobaciones)
6. [Compilación para Windows](#compilación-para-windows)
7. [Versión portable](#versión-portable)
8. [Estructura del proyecto](#estructura-del-proyecto)
9. [Formato de los proyectos](#formato-de-los-proyectos)
10. [Gestión de los archivos de audio](#gestión-de-los-archivos-de-audio)
11. [Motor de audio](#motor-de-audio)
12. [Atajos de teclado](#atajos-de-teclado)
13. [Limitaciones conocidas](#limitaciones-conocidas)
14. [Cómo informar de un error](#cómo-informar-de-un-error)

---

## Funciones implementadas

La interfaz está pensada para alguien que no haya usado nunca un programa de
sonido. Hay cuatro secciones con nombre colloquial y una explicación corta
debajo de cada una:

| Sección | Qué hay dentro |
|---|---|
| **Proyectos** | Crear y abrir presentaciones |
| **Preparar** | La música, los sonidos y la lista de señales |
| **En vivo** | Los botones, los volúmenes y el botón de parar |
| **Ajustes** | Colores, sonido, teclado y archivos |

### Proyectos

- Dos tarjetas grandes: **Crear una presentación** y **Abrir una presentación**.
- Listado «Tus presentaciones» con la fecha y cuántos sonidos tiene cada una.
- **Papelera en cada presentación** para borrarla en dos clics, con confirmación.
- Estado del sonido siempre visible, con un aviso claro si el motor está en pausa.
- Interfaz vacía útil cuando todavía no hay presentaciones.
- En la primera visita, una tarjeta de bienvenida con los tres pasos en palabras
  sencillas.

### Preparar (tres pasos, en orden)

Al entrar en **Preparar** aparece una **guía corta** que siempre te dice el siguiente
paso y avanza sola en cuanto lo completas. Se puede ocultar en cualquier momento
(Ajustes → Cómo se ve → *Mostrar la guía al preparar*).

1. **La música de fondo** — elige la pista, cuánto entra y termina despacio y si se
   repite.
2. **Los sonidos de la escena** — a la izquierda «Tus archivos» (importar por
   selector, por carpeta o arrastrando) y a la derecha «Los botones de sonido».
3. **La lista de señales** — lo que va pasando en escena, en orden.

Debajo, un apartado plegable **«Más opciones»** con los volúmenes generales y la
configuración del teclado, para no estorbar a quien solo quiere preparar la
función.

Una barra fija abajo del todo indica cuántos archivos están listos y siempre
ofrece **Guardar** e **Ir a En vivo**.

### Botones de sonido automáticos

**Cada archivo que importas recibe su propio botón, sin que tengas que crear
nada a mano:**

- El nombre sale del archivo: `01 - Cancion de entrada.wav` → **Cancion de
  entrada**.
- Se asignan un color y un icono que dependen del archivo, así que los botones
  se distinguen de un vistazo y siempre igual entre sesiones.
- Se asignan las teclas `1`, `2`, `3`… por orden, para poder lanzarlos sin
  mirar el teclado.
- El **primer archivo** de la presentación se convierte automáticamente en la
  música de fondo.

Lo único que queda por hacer es ponerles un nombre que signifique algo en
escena (*Caminata*, *Risa*, *Aplausos*).

Antes de actuar, cada botón tiene un botón de **escuchar** para comprobar el
sonido, y la música de fondo se puede escuchar desde el propio paso 1.

### En vivo

- La pantalla más simple y con los controles más grandes.
- Títulos claros: **La música**, **Los volúmenes**, **Los sonidos** y
  **La lista de señales**.
- Transporte con reproducir, pausar, reanudar, detener, barra de progreso,
  búsqueda por posición y tiempo actual / duración total.
- Volúmenes independientes de música, efectos y salida.
- Botones de sonido grandes con su tecla escrita encima e indicador de
  reproducción.
- **Un botón suena o se para, con un solo toque**: si el sonido ya está
  sonando, tocarlo otra vez lo para. Funciona igual con el ratón y con el
  teclado, así que no hace falta mirar ni mover el ratón para pararlo.
- **El audio se carga antes de tiempo**: al abrir la presentación y al entrar en
  «En vivo» se preparan todos los archivos en segundo plano. Mientras se carga,
  un aviso indica cuántos van y cuántos faltan, para que el primer toque suene
  fluido.
- Lista de señales recorrible manualmente.
- **Detener todo**, grande, en rojo y siempre visible (también con la tecla `Esc`).
- Modo presentación: maximiza la ventana y oculta la navegación secundaria.

### Ajustes

- **Cómo se ve**: tema claro, oscuro o según el sistema; tamaño de los botones;
  menos movimiento.
- **El sonido**: estado del motor, dónde se oye, fundidos, preparación de los
  sonidos y avance automático de la lista.
- **El teclado**: atajos de la aplicación y restauración de valores.
- **Archivos y datos**: abrir la carpeta de proyectos, la de recursos, versión e
  información de diagnóstico local.

---

## Requisitos del sistema

| | |
|---|---|
| Sistema operativo | Windows 10 (1809 o superior) o Windows 11, 64 bits |
| Runtime | Microsoft Edge WebView2 (ya incluido en Windows 11; en Windows 10 se instala automáticamente) |
| RAM | 2 GB libres recomendados |
| Disco | ~150 MB para la aplicación + los proyectos |
| Red | No se necesita conexión a Internet en ningún momento |

Para **compilar** la aplicación:

| | |
|---|---|
| Node.js | 20 LTS o superior (probado con 24.20.0) |
| Rust | 1.77 o superior, toolchain `stable` (probado con 1.99.1) |
| Visual Studio Build Tools 2022 | workload `Microsoft.VisualStudio.Workload.VCTools` |
| WebView2 SDK | incluido en los Build Tools |

---

## Instalación de dependencias

```powershell
npm run setup      # comprueba primero que todo está en su sitio
npm install
```

En Rust:

```powershell
cd src-tauri
cargo fetch
```

> En PowerShell, `npm` puede estar bloqueado por la política de ejecución. Usa
> `npm.cmd` en ese caso: `npm.cmd install`.

---

## Ejecutar en modo desarrollo

La aplicación completa (ventana de escritorio nativa):

```powershell
npm run dev:tauri
```

Este comando levanta el servidor de Vite en `http://localhost:1420` y abre la ventana de
CueStage.

Solo la interfaz en el navegador (útil para trabajar en la capa visual):

```powershell
npm run dev
```

> En el navegador la aplicación funciona en modo reducido: los proyectos se guardan en
> `localStorage` y los archivos de audio se cargan en memoria durante la sesión. Las
> funciones que dependen del sistema de archivos (carpetas, arrastrar y soltar del
> sistema operativo, elección del dispositivo de salida) solo existen en la aplicación de
> escritorio.

---

## Comandos de pruebas y comprobaciones

| Comando | Qué hace |
|---|---|
| `npm run setup` | Comprueba que el entorno está listo y dice qué falta |
| `npm run dev:tauri` | Abre la aplicación de escritorio |
| `npm run dev` | Solo la interfaz en el navegador (modo reducido) |
| `npm run typecheck` | Comprobación de tipos con TypeScript en modo estricto |
| `npm run lint` | ESLint (incluye las reglas de React Hooks) |
| `npm test` | Suite de pruebas unitarias y de componentes (Vitest) |
| `npm run test:watch` | Las mismas pruebas en modo continuo |
| `npm run test:coverage` | Pruebas con informe de cobertura |
| `npm run test:fixtures` | Genera los archivos de audio reales de prueba (`tests/media/`) |
| `cargo test --lib` (en `src-tauri`) | Pruebas del backend: almacenamiento, importación y registro de rutas |
| `npm run build:frontend` | Compila el frontend a `dist/` |
| `npm run verify` | Ejecuta typecheck + lint + test + build del frontend |
| `npm run build` | Compila la aplicación de escritorio y el instalador |
| `npm run portable` | Crea la carpeta portable en `portable/CueStage/` |
| `npm run icon` | Regenera el icono de la aplicación a partir del SVG original |

### Laboratorio de audio real

Las pruebas unitarias usan un contexto de audio simulado, así que **no**
demuestran que suene audio de verdad. Para comprobarlo con el motor Web Audio
real del navegador:

```powershell
npm run test:fixtures
npm run dev
```

Abre `http://localhost:1420/tests/audio-lab.html`. La página decodifica MP3, WAV
y OGG reales, renderiza la mezcla en un `OfflineAudioContext`, mide la energía
en cada frecuencia y **mide la salida real del motor de CueStage** con un
`AnalyserNode`. Cada comprobación muestra `PASA` o `FALLA` con los valores
medidos.

> `npm run test:fixtures` genera los WAV sin ninguna dependencia externa. Los
> fixtures de MP3 y OGG se han incluido ya en el repositorio; para regenerarlos
> hace falta `ffmpeg` en el `PATH`.

Los resultados de la última ejecución están en `IMPLEMENTATION_STATUS.md`.

---

## Compilación para Windows

```powershell
npm run build
```

Equivale a `npx tauri build` y produce:

- El ejecutable en `src-tauri/target/release/cuestage.exe`.
- El instalador NSIS en `src-tauri/target/release/bundle/nsis/`.

### El instalador

- **Con la marca de CueStage**: una barra lateral con el logotipo y el lema, la
  cabecera de cada página con el símbolo y el nombre, y el icono propio en el
  instalador y en el desinstalador.
- **En español**, con textos propios (no las traducciones automáticas).
- Con una **página de bienvenida** que explica qué es CueStage, que funciona en
  local y cómo empezar.
- Se instala **para el usuario actual**, sin pedir permisos de administrador, y
  crea un acceso directo en el escritorio.

Los recursos del instalador se generan con:

```powershell
npm run installer:assets
```

Abre `http://localhost:5178/` en un navegador y dibuja las imágenes; se guardan
como BMP en `src-tauri/windows/`. Para cambiar el aspecto, edita el dibujo del
script y vuelve a ejecutarlo.

> Nota: una plantilla NSIS personalizada **no** recibe los caminhos de las
> imágenes, así que el instalador usa la de Tauri con los recursos añadidos
> desde `tauri.conf.json`.

Para generar también el paquete MSI, añade `msi` a la lista `targets` de
`src-tauri/tauri.conf.json` (requiere que Tauri descargue el conjunto de herramientas
WiX).

---

## Versión portable

Además del instalador, el repositorio incluye un script que genera una carpeta
portable con el ejecutable y los archivos necesarios:

```powershell
npm run portable
```

El comando **comprueba primero el entorno** (`npm run setup`) y luego copia el
ejecutable. El resultado queda en `portable/CueStage/CueStage.exe` y puede copiarse a
otro equipo con WebView2 instalado (Windows 11 lo trae de serie).

> La carpeta portable **no** incluye el runtime de WebView2. En Windows 10 sin WebView2
> instalado, hay que instalar el *Evergreen Runtime* de Microsoft.

---

## Peso de la aplicación

CueStage está pensada para ser ligera: se usa en equipos modestos y tiene que
arrancar rápido antes de una función.

| Medida | Valor |
|---|---|
| Ejecutable | 3,5 MB |
| Instalador NSIS | 1,3 MB |
| Interfaz (JavaScript) | 371 kB · **109 kB comprimidos** |
| Hoja de estilos | 37 kB · 7 kB comprimidos |
| Iconos de Lucide incluidos | 16 (el resto se elimina al compilar) |
| Memoria en uso con la aplicación abierta | 24 MB, estable |
| Búferes de audio en memoria | 384 MB como máximo; se descartan los más antiguos |
| Dependencias de terceros | React, Zustand, Lucide y el plugin de diálogos |

No hay librerías de gráficos, de animación ni de diseño: los estilos son CSS
propio con variables, y las animaciones duran 120–200 ms. Todo el código que no
se usa se ha eliminado (0 exportaciones muertas y 0 clases CSS huérfanas).

### Memoria y pistas largas

La aplicación abierta usa unos **24 MB**. Al encima, el audio ya preparado ocupa
memoria: una pista de 13 minutos en estéreo ocupa unos **283 MB** al
decodificarse. El presupuesto de audio es de 512 MB y, si se supera, se descarta
el archivo menos usado hace falta.

Si la música es muy larga y el equipo va justo, dos opciones:

- **Recortar la música** a la duración de la función: la presentación cargará
  antes y usará menos memoria.
- Usar una pista más corta o en mono.

---

## Estructura del proyecto

```
CueStage/
├── src/
│   ├── app/                 # Shell de la aplicación y efectos del marco
│   ├── audio/               # Motor de audio (sin dependencias de la interfaz)
│   │   ├── AudioEngine.ts       # Contexto, grafo de mezcla, caché de búferes
│   │   ├── AudioTypes.ts        # Interfaces del subconjunto de Web Audio usado
│   │   ├── PlaybackManager.ts   # Música principal y efectos simultáneos
│   │   ├── MixerController.ts   # Buses de música, efectos y salida
│   │   ├── FadeController.ts    # Automatización de ganancia (fundidos)
│   │   └── AudioBufferCache.ts  # Caché LRU con presupuesto de memoria
│   ├── components/          # Componentes de interfaz
│   │   ├── AudioPlayer/         # Transporte de la música
│   │   ├── SoundPads/           # Rejilla de pads en vivo
│   │   ├── CueList/             # Guion de señales
│   │   ├── Mixer/               # Mezclador
│   │   ├── ProjectDialog/       # Diálogos de proyecto
│   │   └── common/              # Iconos, modal, avisos, controles
│   ├── features/            # Lógica por funcionalidad
│   │   ├── library/             # Biblioteca e importación
│   │   ├── live-mode/           # Controlador de audio y pantalla En vivo
│   │   ├── projects/            # Esquema, migración y fábricas
│   │   ├── shortcuts/           # Registro de atajos
│   │   └── settings/            # Pantalla de configuración
│   ├── hooks/               # Hooks reutilizables
│   ├── services/            # Persistencia, esquema, ajustes, acceso a archivos
│   ├── stores/              # Estado de interfaz, proyecto, audio y ajustes
│   ├── styles/              # Tokens, base, componentes, pantallas y flujos
│   ├── types/               # Modelo de dominio
│   └── utils/               # Formato de texto e identificadores
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs           # Comandos nativos y configuración de la app
│   │   └── storage.rs       # Almacenamiento local de proyectos (escritura atómica)
│   ├── capabilities/        # Permisos mínimos de Tauri
│   ├── icons/               # Iconos de la aplicación
│   └── tauri.conf.json
├── scripts/                 # Generación del icono y del paquete portable
├── tests/                   # Pruebas unitarias, de componentes y audio
├── README.md
└── IMPLEMENTATION_STATUS.md
```

Separación de responsabilidades:

- **Motor de audio** (`src/audio`): no conoce React ni los proyectos. Solo recibe
  búferes decodificados y comandos.
- **Estado** (`src/stores`): Zustand. Cada store tiene una responsabilidad clara
  (proyecto, audio, ajustes, interfaz).
- **Persistencia** (`src/services` + `src-tauri/src/storage.rs`): serialización,
  validación por esquema y escritura atómica en disco.
- **Atajos** (`src/features/shortcuts`): registro, normalización y captura de teclas.
- **Señales** (`src/features/projects` + `src/features/live-mode`): modelo y ejecución.

---

## Formato de los proyectos

Cada proyecto vive en su propia carpeta dentro de los datos de la aplicación:

```
%APPDATA%\com.cuestage.desktop\projects\<id>\
├── project.json          # documento JSON versionado
└── assets\               # copias de los archivos de audio
    ├── <id>.mp3
    └── <id>.wav
```

`project.json` tiene un campo `formatVersion` (actualmente `1`). Al abrir un proyecto,
el contenido se valida con un esquema antes de tocar el estado de la aplicación; un
archivo corrupto o de una versión futura no puede romper la aplicación y muestra un
mensaje comprensible.

Estructura (extracto):

```jsonc
{
  "formatVersion": 1,
  "id": "8f1c…",
  "name": "Mimos de Francia",
  "createdAt": "2026-01-01T10:00:00.000Z",
  "updatedAt": "2026-01-01T10:15:00.000Z",
  "musicAssetId": "a1b2…",
  "assets": [
    {
      "id": "a1b2…",
      "name": "musica.mp3",
      "fileName": "musica.mp3",
      "storage": "embedded",          // "embedded" | "external"
      "relativePath": "assets/a1b2….mp3",
      "absolutePath": "C:\\…\\assets\\a1b2….mp3",
      "format": "mp3",                 // "wav" | "mp3" | "ogg" | "unknown"
      "durationSec": 154.2,
      "sizeBytes": 3120448,
      "addedAt": "2026-01-01T10:05:00.000Z"
    }
  ],
  "pads": [
    {
      "id": "p1",
      "name": "Caminata",
      "assetId": "a1b2…",
      "color": "#E0562D",
      "icon": "footprints",
      "volume": 1,
      "shortcut": "Digit1",
      "mode": "once",                  // "once" | "loop" | "hold"
      "enabled": true
    }
  ],
  "cues": [
    {
      "id": "c1",
      "name": "Entrada",
      "type": "play-music",            // play-music | pause-music | resume-music |
                                       // stop-music | play-pad | stop-pad |
                                       // stop-all | wait
      "assetId": null,
      "padId": null,
      "notes": "",
      "waitSec": 2,
      "executed": false
    }
  ],
  "mixer": { "musicVolume": 0.9, "sfxVolume": 1, "masterVolume": 1 },
  "playback": {
    "loopMusic": false,
    "musicFadeInSec": 0.6,
    "musicFadeOutSec": 1.2,
    "stopMusicAtEnd": false,
    "autoAdvance": false
  },
  "theme": "system"
}
```

El guardado es **atómico**: se escribe un archivo temporal y se renombra al terminar, de
modo que una interrupción nunca deja un proyecto a medias.

---

## Gestión de los archivos de audio

- **Importación**: selector de archivos de Windows (varios a la vez), importación de una
  carpeta completa y arrastrar y soltar desde el explorador de archivos.
- **Copia al proyecto**: al importar, el archivo se **copia** a la carpeta `assets` del
  proyecto. El original del usuario **nunca** se modifica ni se borra.
- **Formato**: MP3, WAV y OGG. Cualquier otro archivo se omite con un aviso que explica
  el motivo.
- **Rutas**: el proyecto guarda la ruta relativa (`assets/…`) y la ruta absoluta. Si la
  carpeta del proyecto se mueve, la ruta relativa sigue siendo válida.
- **Archivos ausentes**: al abrir un proyecto se comprueba cada archivo; los que faltan
  se marcan con la etiqueta «Archivo ausente» y el resto de la configuración se conserva
  para poder repararlos.
- **Eliminar una presentación**: la papelera de la lista de «Proyectos» la borra en dos
  clics, con confirmación. Se borra la carpeta del proyecto con sus copias de audio; los
  originales del usuario no se tocan nunca.
- **Referencias externas**: el modelo admite `storage: "external"` para archivos que
  viven fuera del proyecto. En ese caso el archivo se autoriza de forma explícita y se
  lee a través del protocolo de recursos de Tauri.
- **Eliminación**: quitar un archivo o un pad de la biblioteca solo afecta al proyecto.
  El archivo de audio del disco no se toca.
- **Autorización de lectura**: el backend solo devuelve los archivos que el usuario ha
  autorizado de forma explícita: los que ha elegido en el selector de archivos (al
  importarlos se copian al proyecto) y los que pertenecen a un proyecto abierto. El
  registro de rutas vive en Rust (`PathRegistry`), no en la interfaz, y rechaza
  cualquier ruta relativa o ajena a lo autorizado.

---

## Motor de audio

El motor usa la **Web Audio API** dentro del WebView2, con un único `AudioContext` por
sesión de aplicación.

```
música   → fuente → ganancia de instancia → bus de música  ┐
efectos  → fuente → ganancia de instancia → bus de efectos ┴→ ganancia general
                                                                  → limitador suave → salida
```

- Cuatro niveles independientes: música, efectos, volumen individual de cada pad y
  salida general.
- Cada reproducción crea su propia `AudioBufferSourceNode` y su propia ganancia; nunca
  se reutiliza una fuente que ya terminó.
- Los fundidos se programan con automatización de ganancia sobre el reloj de audio, así
  que no dependen de los fotogramas de animación ni de la carga de la interfaz.
- Un limitador suave (`DynamicsCompressor`, umbral −6 dB) reduce el riesgo de saturación
  digital. **No es una garantía de seguridad acústica**: el volumen del sistema y de los
  altavoces sigue siendo responsabilidad del operador.
- **Precarga**: los archivos se decodifican en segundo plano al abrir el proyecto o al
  pulsar «Preparar actuación». Un pad sin preparar avisa antes de reproducir.
- **Memoria**: la caché de búferes tiene un presupuesto (384 MB por defecto) y va
  expulsando el búfer menos usado recently cuando se supera.
- **Contexto suspendido**: los navegadores mantienen el `AudioContext` suspendido hasta
  la primera interacción. CueStage lo reactiva automáticamente y muestra el estado en la
  barra lateral y en la pantalla En vivo.

---

## Atajos de teclado

Asignaciones por defecto:

| Atajo | Acción |
|---|---|
| `Espacio` | Reproducir / pausar la música principal |
| `Esc` | Detener todo (música y efectos de CueStage) |
| `←` / `→` | Señal anterior / siguiente del guion |
| `F11` | Alternar el modo presentación |
| `1` … `9`, `0` | Pads del 1 al 10 (configurables) |

Reglas:

- Los atajos se ignoran mientras el operador escribe en un campo de texto.
- La repetición automática del teclado no vuelve a disparar un efecto.
- Los conflictos se detectan al asignar una tecla y se muestran al lado del pad.
- El modo «mantener pulsado» se detiene al soltar la tecla, al salir el puntero del pad,
  al perder el foco de la ventana y al salir del modo En vivo.
- El botón visible «Detener todo» está siempre disponible aunque los atajos se
  reasignen.

**Límite conocido**: los atajos funcionan dentro de la ventana de CueStage. Los atajos
globales de Windows (fuera de la aplicación) no están implementados.

---

## Decisiones de diseño de la interfaz

- **Palabras corrientes.** Nada de «pads», «guion» ni «mezclador» en pantalla:
  se dice «botones de sonido», «lista de señales» y «volúmenes».
- **Un tutorial que no hay que leer.** Una tarjeta en «Preparar» indica siempre el
  siguiente paso, avanza sola con el trabajo y se puede ocultar.
- **Menos pantallas.** «Preparar» no usa pestañas: son tres pasos numerados que se
  ven a la vez, así que nadie se pierde.
- **Se prueba antes de actuar.** Cada sonido y la música se pueden escuchar desde
  la propia pantalla de preparación.
- **Todo explicado.** Cada sección dice en una línea qué se puede hacer en ella.
- **Un solo camino obvious.** «Preparar el sonido» prepara los archivos; «Ir a
  En vivo» lleva al escenario; «Detener todo» para todo.
- **Botones grandes y con contraste.** El botón de emergencia es el más grande de
  la pantalla En vivo, en rojo, y nunca desaparece.
- **Nada de adornos.** Sin degradados llamativos, sin sombras fuertes y sin
  animaciones decorativas. Las transiciones duran 120–200 ms y se pueden desactivar.

---

## Limitaciones conocidas

- **Atajos globales de Windows**: no implementados. Requieren un plugin nativo o un
  gancho de teclado de bajo nivel.
- **Latencia**: el motor no promete latencia cero. El tiempo entre la pulsación y el
  sonido depende del dispositivo de salida y del sistema, aunque la ruta de audio es
  interna (sin pasar por el disco).
- **Dispositivo de salida**: depende de la versión de WebView2. Si el motor expone
  `AudioContext.setSinkId`, CueStage muestra un selector de dispositivo; si no, usa el
  dispositivo predeterminado de Windows y lo indica en Ajustes.
- **Formatos**: solo MP3, WAV y OGG. El soporte de OGG depende de los códecs que
  incluya el WebView2 del sistema.
- **Limitador**: es una medida de seguridad digital, no acústica.
- **«Detener todo»** solo detiene lo que CueStage está reproduciendo. No silencia otras
  aplicaciones de Windows.
- **Modo navegador**: al ejecutar solo con `npm run dev` no hay acceso al sistema de
  archivos; los proyectos se guardan en `localStorage` y el audio se carga en memoria
  durante la sesión.
- **Formatos de proyecto**: la versión 1 es la primera del formato; las migraciones
  futuras se añadirán en `src/features/projects/projectSchema.ts`.

---

## Cómo informar de un error

1. Abre **Ajustes → Archivos y datos** y anota la versión, la plataforma y el
   estado del motor.
2. Describe qué estabas haciendo, qué esperabas y qué ocurrió.
3. Si el fallo afecta a un proyecto, indica el nombre del proyecto y el tipo de archivo
   implicado.
4. No hace falta enviar archivos de audio: la reproducción de un archivo concreto se
   puede reproducir con un proyecto nuevo que contenga solo ese archivo.

Las incidencias se pueden registrar en el repositorio del proyecto describiendo los
pasos para reproducir el fallo.

---

## Licencia

MIT.
