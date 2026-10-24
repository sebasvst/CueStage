# Estado de implementación — CueStage

Resumen real del estado del proyecto en la fecha de la última verificación.
Lo que aparece como **Probado** se ha ejecutado de verdad; lo que aparece como
**No probado** necesita un equipo con altavoces y una persona delante.

---

## 0. Última revisión: setup, borrado rápido, campos de texto y botones

### El instalador, con su propia identidad

- **Barra lateral propia** en las páginas de bienvenida y de fin (164 × 314 px):
  fondo oscuro, símbolo de CueStage, nombre y lema.
- **Cabecera propia** en todas las páginas (150 × 57 px) con el símbolo y el
  nombre, también al desinstalar.
- **Icono propio** en el instalador y en el desinstalador.
- **Textos en español**, propios y no las traducciones automáticas, con un tono
  más claro («Ya está instalado», «Elige cómo instalar CueStage»…).
- **Página de bienvenida** que explica qué es CueStage, que funciona en local y
  cómo empezar.
- Se quitó el **selector de idioma**: estorbaba y bloqueaba la instalación
  silenciosa. Ahora se usa el idioma del sistema, con español e inglés
  disponibles.

Las imágenes se generan con `npm run installer:assets`, que las dibuja en un
navegador (para que el texto quede bien tipografiado) y las guarda como BMP en
`src-tauri/windows/`.

**Verificado de verdad**: el instalador se ejecutó en silencio con `/S` sobre una
carpeta de prueba, dejó `cuestage.exe` (3,4 MB) y `uninstall.exe` (84 kB), la
aplicación instalada arrancó con la ventana «CueStage» y el desinstalador
funciona.

> Una plantilla NSIS personalizada **no** recibe los caminos de las imágenes (el
> empaquetador no las inyecta), así que se usa la plantilla de Tauri con los
> recursos añadidos desde `tauri.conf.json`.

### El setup, actualizado

- **`npm run setup`**: un comprobador del entorno que revisa Node, npm, Rust, las
  Build Tools de Visual C++, el runtime de WebView2, las dependencias, la
  compilación y la carpeta de presentaciones. Cada línea dice qué falta y el
  comando exacto para arreglarlo, y termina con los comandos de trabajo.
- **Puesta en marcha guiada en la aplicación**: en «Proyectos», el botón
  **Empezar ahora** crea la presentación y abre la guía; la tarjeta de
  bienvenida explica los tres primeros minutos.
- El README empieza con una sección «Puesta en marcha» con esos tres minutos.

### Los botones de sonido se alternan (suenan o se paran)

- **Tocar un botón que ya está sonando lo para.** Antes al segundo toque
  volvía a dispararlo. Ahora el mismo botón hace de play y de pausa, sin buscar
  otro control.
- **Funciona igual con el teclado**: la tecla asignada al botón también
  alterna, así que no hace falta mover el ratón para pararlo. Con pruebas
  propias para el clic y para la tecla.
- Cuando el sonido está parado, el pie del botón pone **«Toca para parar»** para
  que se entienda sin instrucciones.
- El indicador se apaga **en el momento** en que se pausa, aunque el sonido se
  desvanezca durante 30 ms para que no chasquee.

### El audio se carga antes de tiempo

- Al abrir la presentación y **al entrar en «En vivo»** se preparo todos los
  archivos en segundo plano: primero la música, después los sonidos de los
  botones y por último el resto.
- Un aviso en «En vivo» indica **cuántos van y cuántos faltan** («Cargando los
  sonidos para que suenen a la primera: 3 de 7 listos») y, si algo falla, avisa
  de cuántos no se han podido cargar.
- Con la preparación hecha, el primer toque suena sin esperas.

### Los botones de sonido de «En vivo» se veían mal

**El botón de parar quedaba fuera del botón de sonido**, flotando en el hueco
de la derecha. La causa: un `<button>` con `display: flex` **no se estira** —
el ancho de un botón es «fit-content» aunque lo pongas en flex — así que el
botón de sonido medía 108 px dentro de una celda de 152 px, y el botón de
parar, anclado a la celda, caía en el hueco.

**Corrección:** el botón de sonido ocupa el 100 % del ancho. Comprobado midiendo
el DOM: ahora el botón mide 152 px y el de parar queda dentro.

### El botón de pausar

- **Pulsarlo tres veces seguidas sonaba la música tres veces encimada.** Ahora
  hay un bloqueo mientras el archivo se prepara: solo suena una copia. Con
  prueba propia que lo comprueba contando las fuentes en marcha.
- **Mientras se prepara no se veía nada.** Ahora el botón muestra un indicador
  giratorio, el texto dice «Preparando la música…» y queda desactivado, para que
  se entienda que hay que esperar un momento.
- Al pausar y reanudar, la música continúa **exactamente** en el mismo punto.
  Con prueba propia.

### El bug de los campos de texto (importante)

**Al escribir en un diálogo se perdía el texto a partir del primer carácter.**

La causa: el `Modal` enfocaba el panel del diálogo dentro de un `useEffect` que
dependía de `onClose`. Como el padre crea `onClose` como función nueva en cada
render, el efecto se volvía a ejecutar **en cada tecla** y le quitaba el foco al
campo: el primer carácter entraba y el resto se perdía. Afectaba a los tres
diálogos (nueva presentación, abrir presentación y guardar como).

**Corrección:** el efecto depende solo de `open`; el callback se guarda en una
referencia. Además ahora el foco va al **primer campo editable** del diálogo,
así que se puede escribir nada más abrirlo. Con cinco pruebas propias
(`tests/components/modal.test.tsx`) que comprueban el foco, el texto completo,
la tecla Escape, el clic fuera y que el foco vuelva al elemento anterior.

**Otro bug de campos numéricos:** con un `<input type="number">` controlado no se
podía escribir «0,6»: al teclear el punto, el valor intermedio no es un número
válido, el estado pasaba a 0 y el punto desaparecía. Ahora hay un componente
`NumberField` que guarda el texto mientras se escribe y solo confirma el valor
cuando es válido, con cinco pruebas propias.

Comprobado además que el resto de campos (nombre del botón, nombre de la señal,
buscador, notas, volúmenes) escriben bien, conservan el foco y guardan el valor.

### Borrado rápido de presentaciones

- Botón de papelera en cada presentación de «Tus presentaciones» y en el
  diálogo «Abrir una presentación». Siempre visible (no solo al pasar el ratón)
  para que se encuentre sin instrucciones.
- Pide confirmación con el nombre de la presentación y avisa de que **los
  originales del usuario no se tocan** (solo se borran las copias de su
  carpeta).
- Si la presentación estaba abierta, se cierra antes de borrarla para que
  nada siga apuntando a ficheros inexistentes.
- Aviso de confirmación al terminar.

---

### Memoria y pistas largas

La aplicación abierta usa unos **24 MB**. El audio preparado ocupa además lo que
necesite: una pista de 13 minutos en estéreo son unos **283 MB** decodificados.
El presupuesto de la caché pasa de 384 MB a **512 MB** para que la música y
todos los efectos quepan sin que se descarte el que ya sonó. Está anotado en el
README con la recomendación de recortar la música a la duración de la función.

---

## 0 bis. Revisión anterior: bugs de código y visuales

Se ha hecho una revisión a fondo del código y de la maquetación. Los
problemas encontrados y corregidos:

### Bugs de código

| Gravedad | Problema | Por qué pasaba | Corrección |
|---|---|---|---|
| 🔴 | **Un botón «Mantener» dejaba el sonido sonando para siempre** | `triggerPad` es asíncrono: si el operador soltaba el botón antes de que terminara de decodificar el archivo, la parada no encontraba ninguna instancia y el sonido empezaba después, sin forma de pararlo | Se anota cada disparo pendiente; si llega una parada antes de que empiece, el sonido ya no arranca. **Con prueba que lo detecta** |
| 🔴 | **«Guardar como» perdía los cambios pendientes** | Se copiaba el fichero que había en disco, no el estado en memoria; el autoguardado posterior acababa guardando la copia y el original se quedaba viejo | Se guarda primero el estado actual y luego se duplica. La copia es además una presentación **nueva**, con sus propios recursos y rutas reescritas |
| 🔴 | **Cambios marcados como guardados sin estarlo** | El autoguardado en curso marcaba `dirty: false` aunque el proyecto hubiera cambiado mientras escribía | Contador de revisiones: solo se marca como guardado si no ha cambiado nada |
| 🟠 | **Abrir o cerrar una presentación no paraba el audio** | La música de la presentación anterior seguía sonando con la nueva abierta | Al cambiar de presentación se detiene todo y se limpia la caché de preparación |
| 🟠 | **El fundido de salida pisaba el de entrada** | En pistas cortas el valor «1» se fijaba antes de tiempo y la música entraba a volumen completo (clic) | El fundido de salida nunca empieza antes de que termine el de entrada |
| 🟠 | **La parada de emergencia podía no silenciar** | `cancelScheduledValues` no detiene una rampa en curso: el volumen podía volver a subir justo después del silencio | Se usa `cancelAndHoldAtTime`, que conserva el valor y detiene la rampa |
| 🟠 | **Una fuente que no arrancaba dejaba el botón «activo» para siempre** | `source.start()` fallaba y la instancia se quedaba registrada | Se libera la instancia si el arranque falla |
| 🟠 | **Una importación fallida no avisaba de nada** | En modo navegador la sonda de duración no tenía `catch` y la promesa quedaba sin capturar | Se aísla el error y se avisa al usuario |
| 🟡 | **Dos guardados simultáneos podían corromper el proyecto** | El fichero temporal tenía siempre el mismo nombre | Nombre temporal único y escritura serializada con un cerrojo |
| 🟡 | **Un `project.json` manipulado podía leer ficheros de fuera** | La comparación de rutas no resolvía los `..` | Las rutas se canonicalizan antes de compararlas. **Con prueba** |
| 🟡 | **Leer una pista larga congelaba la interfaz** | El comando de lectura era síncrono | La lectura se hace fuera del hilo principal |
| 🟡 | **Un error de lectura se confundía con «no existe»** | El error se descartaba en silencio | Se distingue entre «no existe» y «no se pudo leer» |
| 🟡 | **Los avisos seguían vivos al descartarlos** | El temporizador de cada aviso no se cancelaba | Se guarda y se cancela al descartarlo |
| 🟡 | **Dos previsualizaciones a la vez sonaban la más antigua** | La que terminaba de decodificar después sustituía a la más reciente | La previsualización usa un testigo: siempre gana la última petición |

### Bugs visuales

| Problema | Por qué pasaba | Corrección |
|---|---|---|
| **Los botones de sonido desaparecían por debajo de 1100 px** | La fila de la rejilla podía encogerse a 0 y la rejilla de botones heredaba altura 0 | Por debajo de 1100 px la pantalla En vivo fluye en vertical y hace scroll ella misma |
| **Scroll horizontal por debajo de 700 px** | La barra lateral fija de 232 px y las rejillas con anchos mínimos | La barra se reduce a iconos por debajo de 980 px, los anchos mínimos se ajustan y el relleno de la página disminuye en pantallas pequeñas |
| **Los botones de la barra perdían su nombre** | Al ocultar el texto, el nombre accesible desaparecía con él | Se añade `title` a cada botón, que sí se usa como nombre accesible |
| **El botón de «Detener todo» con 3,78:1 de contraste** | En tema oscuro el rojo era demasiado claro para texto blanco | Se separa el color de fondo del color de texto: `--danger` para el botón y `--danger-text` para los textos. El botón principal pasa a 4,83:1 en ambos temas |
| **Faltaba el botón «Guardar como»** | Se perdió al rehacer la pantalla Preparar | Recuperado, con el comportamiento corregido y un diálogo propio |
| **El editor de botones se partía en dos columnas** | Se anidaba una rejilla dentro de otra | Ahora es una columna apilada dentro de la rejilla de Preparar |

---

## 0. Última revisión: tutorial contextual y botones automáticos

### El tutorial que acompaña mientras se añaden los audios

Una tarjeta fija en la parte alta de «Preparar» (**`src/features/tutorial/`**)
muestra siempre **el siguiente paso que falta** y avanza por sí sola en cuanto
se completa. No hay que marcar nada a mano.

| Paso | Se completa cuando | Acción del botón |
|---|---|---|
| 1 · Añade tu música y tus sonidos | Hay al menos un archivo | Abre el selector de archivos |
| 2 · Elige la música de fondo | Hay una pista asignada | Lleva al paso 1 |
| 3 · Prepara los botones de sonido | Hay al menos un botón | Lleva a la lista de botones |
| 4 · Escribe la lista de señales | Hay al menos una señal | Lleva a la lista de señales |
| — · ¡Todo listo! | Todo lo anterior | Salta a «En vivo» |

- Se puede ocultar con «Ocultar la guía» y volver a activarse en
  **Ajustes → Cómo se ve → Mostrar la guía al preparar**.
- Cuatro puntos muestran el progreso.
- En «Proyectos» aparece además una tarjeta de bienvenida con los tres pasos en
  palabras sencillas cuando todavía no hay ninguna presentación.
- En «En vivo» aparece un aviso si la presentación aún no está lista
  («vuelve a Preparar…»), con un botón que lleva allí.

### Los botones de sonido se crean solos

**Cada archivo importado recibe su propio botón** (`src/features/projects/autoButton.ts`):

- El nombre sale del archivo: `01 - Cancion de entrada.wav` → **Cancion de entrada**
  (se quita el número de pista inicial).
- Color e icono estables por archivo, así que los botones se distinguen de un
  vistazo y no cambian entre sesiones.
- Teclas `1`, `2`, `3`… asignadas por orden, para lanzarlos sin mirar.
- El **primer archivo** se convierte automáticamente en la música de fondo.
- Si el archivo ya tenía un botón, no se crea un segundo.

### Errores encontrados y corregidos con estas mejoras

| Error | Cómo se detectó | Corrección |
|---|---|---|
| Al importar en modo navegador no se añadía ningún archivo | Carga real de archivos en el navegador | El `FileList` se copiaba a un array **antes** de vaciar el input; al vacearlo, la lista se quedaba vacía y no se importaba nada |

---

## 0 bis. Revisión anterior: interfaz simplificada y aligerada

Se ha revisado la aplicación entera pensando en alguien que no sepa de sonido
y que no haya usado nunca un programa de este tipo.

### Qué ha cambiado en la interfaz

| Antes | Ahora | Por qué |
|---|---|---|
| Cuatro secciones con nombre técnico: Inicio, Estudio, En vivo, Configuración | Proyectos, Preparar, En vivo, Ajustes, cada una con una línea que explica qué hay dentro | Se entiende sin manual |
| «Estudio» con cuatro pestañas (Biblioteca, Pads, Guion, Ajustes) | «Preparar» con tres pasos numerados que se ven a la vez: 1 · La música de fondo, 2 · Los sonidos de la escena, 3 · La lista de señales | Las pestañas esconden contenido y hacen perder el hilo |
| Volúmenes y atajos mezclados con lo esencial | Plegados en «Más opciones (volúmenes y teclado)» | Lo principal no queda tapado |
| «Pads de sonido», «Guion de señales», «Mezclador» | «Los botones de sonido», «La lista de señales», «Los volúmenes» | Palabras corrientes |
| Biblioteca con solo una lista | «Tus archivos» con zona de arrastre explicada, búsqueda y estado vacío que dice qué hacer | Se ve qué falta y cómo añadirlo |
| Botón «Detener todo» del tamaño normal | Botón grande, rojo, con su atajo en el tooltip | Es la acción que más importa en escena |
| Pantalla En vivo sin títulos | Títulos «La música», «Los volúmenes», «Los sonidos» y «La lista de señales» | Se sabe qué se está tocando |
| Sin barra de acción al final de Preparar | Barra fija con el estado de la preparación, «Guardar» e «Ir a En vivo» | El siguiente paso está siempre a mano |

### Qué ha cambiado en el peso

| Medida | Antes | Ahora |
|---|---|---|
| Exportaciones sin uso en `src/` | 16 | 0 (solo quedan tipos que documentan la API pública) |
| Clases CSS sin usar | 12 | 0 |
| Interfaz comprimida | 107 kB | 113 kB (CSS nuevo de los pasos) · ejecutable 3,5 MB |
| Memoria en ejecución | 24 MB | 24 MB, estable |
| Ejecutable / instalador | 3,4 MB / 1,3 MB | 3,5 MB / 1,3 MB |

La curva perceptual del volumen (ganancia = valor²) ha pasado de estar
escrita y sin usarse a estar **activa en el mezclador**: la mitad inferior de
los mandos ahora es utilizable, que era el punto de la función.

---

## 1. Funciones terminadas

### Navegación y marco

- [x] Cuatro secciones: Inicio, Estudio, En vivo y Configuración.
- [x] Acceso prioritario a «En vivo» con un botón siempre visible en la barra lateral.
- [x] Modo presentación: oculta la navegación secundaria y pide pantalla completa.
- [x] Tema claro, oscuro y «según el sistema», guardado de forma local.
- [x] Tamaño de los controles (compacto / normal / grande).
- [x] Animaciones reducidas, incluyendo la preferencia del sistema.
- [x] Interfaz completamente en español.

### Proyecto y almacenamiento

- [x] Crear, abrir, guardar, guardar como, cerrar y recuperar cambios.
- [x] Guardado automático con retardo (900 ms) y escritura atómica en disco.
- [x] Formato JSON versionado (`formatVersion`) validado con un esquema propio.
- [x] Migración y rechazo de archivos de una versión futura.
- [x] Comprobación de los archivos de audio al abrir un proyecto.
- [x] Aviso al intentar descartar cambios sin guardar.

### Biblioteca de audio

- [x] Importación con el selector de archivos de Windows (varios a la vez).
- [x] Importación de una carpeta completa.
- [x] Importación por arrastrar y soltar (evento nativo del sistema operativo).
- [x] Búsqueda por nombre y ordenación por nombre, fecha, duración y tamaño.
- [x] Previsualización de cada archivo.
- [x] Duración y tamaño detectadas automáticamente.
- [x] Asignación de la música principal con un clic.
- [x] Eliminación de la referencia sin borrar el archivo original.
- [x] Detección de archivos ausentes y aviso visible.
- [x] Aviso comprensible para los formatos no compatibles.

### Pads

- [x] Nombre, archivo, color, icono, volumen individual, atajo y modo.
- [x] Modos «una vez», «repetición» y «mantener pulsado».
- [x] Crear, editar, duplicar, eliminar y reordenar pads.
- [x] Colores configurables (12 tonos) e iconos de Lucide (16 iconos).
- [x] El volumen de un pad no afecta a los demás.
- [x] Eliminar un pad no borra su archivo.

### Motor de audio

- [x] Un único `AudioContext` por sesión, con inicialización explícita.
- [x] Grafo de mezcla de cuatro niveles (música, efectos, pad, salida).
- [x] Música principal: reproducir, pausar, reanudar, detener, buscar y barra de progreso.
- [x] La música no se detiene al disparar un efecto.
- [x] Efectos simultáneos, cada uno con su propia fuente y ganancia.
- [x] Re-disparo de un pad sin acumular fuentes.
- [x] Fundidos de entrada y de salida con automatización de ganancia.
- [x] Volúmenes con rampas (sin saltos) y limitador suave en la salida.
- [x] Precarga con caché LRU y presupuesto de memoria (384 MB).
- [x] Estado real del motor (listo / suspendido / error) visible en la interfaz.
- [x] «Detener todo»: silencia la salida, detiene las fuentes y cancela los temporizadores.

### Guion de señales

- [x] Señales con identificador estable, nombre, tipo, destino, notas y posición.
- [x] Recorrido manual con las flechas del teclado o pulsando la señal.
- [x] Avance automático opcional y **desactivado por defecto**.
- [x] Protección contra dobles clics accidentales.
- [x] «Detener todo» cancela la secuencia automática pendiente.

### Atajos

- [x] Reasignables desde el Estudio y desde Configuración.
- [x] Detección de conflictos con otros pads y con las acciones globales.
- [x] Se ignoran dentro de los campos de texto.
- [x] La repetición automática del teclado no vuelve a disparar.
- [x] El modo «mantener pulsado» se detiene al soltar, al salir del pad y al perder el foco.
- [x] Botón «Detener todo» siempre visible, independiente de los atajos.

### Configuración

- [x] Apariencia, audio, atajos y datos.
- [x] Apertura de la carpeta de proyectos y de la carpeta de recursos.
- [x] Versión, plataforma e información de diagnóstico local.
- [x] Ningún ajuste decorativo: todo lo que se muestra funciona.

---

## 2. Comprobaciones ejecutadas y resultados

### Pruebas de la instalación real

| Comprobación | Resultado |
|---|---|
| Instalación silenciosa (`/S`) en una carpeta de prueba | **Correcto** — instala `cuestage.exe` y `uninstall.exe` |
| La aplicación instalada arranca | **Correcto** — ventana «CueStage», 24 MB de memoria |
| Desinstalador presente | **Correcto** — 84 kB |
| Las imágenes y los textos propios están en la plantilla que se compila | **Correcto** — rutas de `header.bmp`, `sidebar.bmp` e `icon.ico`, y el `.nsh` en español |

### Errores encontrados y corregidos durante la verificación

| Error | Cómo se detectó | Corrección |
|---|---|---|
| Los pads solo respondían al puntero, no al teclado | Prueba de componente | Se añadió `onClick`; los pads se activan con Enter y Espacio. |
| El transporte no mostraba la música asignada hasta que sonaba | Inspección de la interfaz | Ahora muestra la pista asignada y su estado. |
| El resumen de proyecto nunca indicaba música principal | Prueba unitaria de Rust | El backend leía `music.assetId`; el formato usa `musicAssetId`. |
| Las instancias que se desvanecían se contaban como activas | Prueba unitaria | El recuento solo incluye las voces en curso. |
| Los archivos WAV de prueba se generaban sin entrelazar los canales | Laboratorio de audio | Se corrigió el generador: los canales se entrelazan correctamente. |
| Al importar en modo navegador no se añadía ningún archivo | Carga real de archivos | El `FileList` se copiaba a un array antes de vaciar el input. |

### Automáticas (todas ejecutadas en esta máquina)

| Comprobación | Comando | Resultado |
|---|---|---|
| Tipos | `npm run typecheck` | **Correcto** — sin errores |
| Linter | `npm run lint` | **Correcto** — sin errores ni avisos |
| Pruebas (TypeScript) | `npm test` | **Correcto** — 108 pruebas, 0 fallos |
| Pruebas (Rust) | `cargo test --lib` | **Correcto** — 12 pruebas, 0 fallos |
| Comprobación del entorno | `npm run setup` | **Correcto** — 9 comprobaciones, 0 fallos |
| Compilación del frontend | `npm run build:frontend` | **Correcto** — `dist/` generado (362 kB, 107 kB comprimido) |
| Compilación de Tauri | `npm run build` | **Correcto** — `cuestage.exe` + instalador NSIS |
| Comprobación de Rust | `cargo check` | **Correcto** — sin avisos |
| Arranque del ejecutable | `portable\CueStage\CueStage.exe` | **Correcto** — ventana «CueStage», 24 MB de memoria estables |

### Pruebas de audio real (Web Audio real en Chromium)

Ejecutadas con `tests/audio-lab.html` sobre archivos reales
(`tests/media/tono-440.wav`, `tono-440.mp3`, `tono-220.ogg`, `clic.wav`).
**14 de 14 comprobaciones correctas.**

| Comprobación | Resultado medido |
|---|---|
| Decodificación de un WAV real | 3,000 s · 48 000 Hz · 2 canales |
| Decodificación de un MP3 real | 3,000 s · 48 000 Hz |
| Decodificación de un OGG real | 2,000 s · 48 000 Hz |
| Decodificación de un efecto muy corto | 0,120 s · 1 canal |
| La música sigue sonando con un efecto encima | 440 Hz: 63,05 → 45,09 · 220 Hz: 0,00 → 45,09 |
| Dos fuentes simultáneas se mezclan | 440 Hz = 45,09 · 220 Hz = 45,09 |
| El volumen de los efectos es independiente | efecto ×0,25 exacto · música sin cambios |
| El fundido de entrada es progresivo | RMS inicial 0,10271 → final 0,50753 |
| La mezcla no satura | pico 0,9202 (límite 1,0) |
| Un efecto muy corto se reproduce íntegro | RMS 0,05113 |
| **El motor real produce audio en el dispositivo** | **RMS medido en la salida real: 0,50975** |
| Un efecto suena encima de la música real | RMS 0,50218 · estado «playing» |
| El volumen de la música es independiente | RMS 0,00000 a volumen 0 · 0,46740 restaurado |
| **«Detener todo» silencia la salida real** | **RMS 0,00000 tras detener** |

### Pruebas de la aplicación real (interfaz en el navegador)

Ejecutadas sobre la aplicación compilada por Vite, con interacción real:

- [x] Crear una presentación («Prueba de interfaz») y guardarla.
- [x] Navegación con los cuatro nombres nuevos: Proyectos, Preparar, En vivo, Ajustes.
- [x] Las dos tarjetas grandes de «Proyectos» (crear / abrir).
- [x] Los tres pasos numerados de «Preparar» con su explicación.
- [x] El apartado plegable «Más opciones» abre con «Volúmenes» y «Atajos de la aplicación».
- [x] Barra de acción final con el estado de la preparación.
- [x] «En vivo» muestra los títulos «La música», «Los volúmenes», «Los sonidos» y «La lista de señales».
- [x] La guía aparece en «Preparar» con «Paso 1 de 4» y el texto de primer paso.
- [x] Al añadir dos archivos se crean **dos botones automáticos** («Cancion de
  entrada» y «Pasos») con las teclas `1` y `2`.
- [x] El primer archivo se convierte **automáticamente** en la música de fondo.
- [x] La guía **avanza sola**: con archivos y música pasa a «Paso 4 de 4 · Escribe
  la lista de señales», y al terminar muestra «¡Todo listo!» con el botón
  «Ir a En vivo» y los cuatro puntos completados.
- [x] La tarjeta de bienvenida de «Proyectos» aparece cuando no hay ninguna
  presentación.
- [x] Importar dos archivos reales por el selector de archivos.
- [x] Detectar la duración (3,0 s y 0,1 s) y el tamaño de cada archivo.
- [x] Asignar la música principal.
- [x] Crear un botón de sonido, renombrarlo, asignarle el icono y el archivo.
- [x] Abrir de nuevo el proyecto guardado y recuperar la configuración.
- [x] Disparar un botón: el indicador se activa y se libera al terminar.
- [x] Reproducir la música: la posición avanza y el estado pasa a «Reproduciendo».
- [x] La música termina sola y vuelve al estado «detenida».
- [x] `Esc` detiene la música mediante el atajo real de la aplicación.
- [x] El botón «Detener todo» detiene la reproducción.
- [x] El motor aparece como «Audio listo» en la pantalla En vivo.
- [x] Sin desbordamiento horizontal a 800 × 574 px.

---

## 3. Pendiente o no implementado

| Elemento | Estado | Motivo |
|---|---|---|
| Atajos globales de Windows | **No implementado** | Requieren un gancho de teclado de bajo nivel; se documenta el límite en el README. |
| Elección del dispositivo de salida | **Condicional** | Solo aparece si el WebView2 expone `AudioContext.setSinkId`; si no, se usa el dispositivo predeterminado y se explica en Configuración. |
| Formatos de audio adicionales (FLAC, AAC, WMA) | **No implementado** | El motor de Web Audio no los decodifica de forma fiable; se avisa al importar. |
| Reproducción automática completa del guion al cargar un proyecto | **No implementado** | Prohibido por diseño: el guion se recorre manualmente. El avance automático tras ejecutar una señal sí existe y está desactivado por defecto. |
| Sincronización entre equipos | **No implementado** | Fuera de alcance: la aplicación es local y no usa la nube. |
| Medidor de picos / VU en pantalla | **No implementado** | Requiere análisis continuo de la forma de onda; se priorizó la ligereza. |

---

## 4. Pruebas que requieren persona y altavoces

Estas comprobaciones **no** se han ejecutado automáticamente porque dependen de
la percepción humana y del dispositivo de salida concreto:

- [ ] Suena por los altavoces del equipo y por auriculares.
- [ ] Latencia percibida entre la pulsación del pad y el sonido.
- [ ] Comportamiento al desconectar el dispositivo de audio durante la actuación.
- [ ] Comportamiento al cambiar de dispositivo de salida con la música sonando.
- [ ] Volumen final GODZILLA con la mezcla completa en un espacio grande.
- [ ] Comportamiento en sesiones largas de más de dos horas (uso de memoria).
- [ ] Legibilidad de la pantalla En vivo a 1920×1080 y a 1366×768.

La sesión de arriba (14 de 14 comprobaciones con audio real) midió la señal en
la salida real del navegador, lo que confirma la ruta de audio del motor, pero
**no sustituye a la escucha con altavoces**.

---

## 5. Distribución

| Artefacto | Ruta |
|---|---|
| Ejecutable de la aplicación | `src-tauri/target/release/cuestage.exe` (3,4 MB) |
| Instalador NSIS | `src-tauri/target/release/bundle/nsis/CueStage_0.1.0_x64-setup.exe` (1,3 MB) |
| Versión portable | `portable/CueStage/CueStage.exe` (3,4 MB) + `portable/CueStage/installer/` |

- Identificador de la aplicación: `com.cuestage.desktop`.
- Versión: `0.1.0`.
- Icono: original, generado por `scripts/generate-icon.mjs` a partir de formas
  vectoriales propias y convertido por `tauri icon`.
- El instalador se genera en modo «usuario actual» (no requiere permisos de
  administrador).
- Arranque verificado: ventana «CueStage» y 24 MB de memoria resident, estables
  durante la ejecución.
