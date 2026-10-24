# 🚀 DESPLIEGUE A GITHUB - CUESTAGE

## Paso 1: Crear el repositorio en GitHub

1. Ve a [github.com/new](https://github.com/new)
2. Nombre del repositorio: **cuestage**
   - ⚠️ Debe llamarse exactamente **cuestage** para que GitHub Pages funcione correctamente
3. Descripción: `Control de música y efectos de sonido para presentaciones en vivo`
4. **NO** marques "Add a README file" (ya tenemos uno)
5. **NO** marques "Add .gitignore" (ya tenemos uno)
5. Haz clic en **Create repository**

## Paso 2: Subir el código a GitHub

Ejecuta este comando en la carpeta de CueStage:

```powershell
# Agregar el repositorio remoto (reemplaza TU-USUARIO con tu nombre de usuario de GitHub)
git remote add origin https://github.com/TU-USUARIO/cuestage.git

# Subir los cambios
git push -u origin main
```

## Paso 3: Activar GitHub Pages

1. Ve a tu repositorio en GitHub
2. Haz clic en **Settings** (configuración)
3. En el menú izquierdo, haz clic en **Pages**
4. En "Build and deployment":
   - **Build from**: Deploy from a branch
   - **Branch**: `main` / **(root)**
   - Haz clic en **Save**
5. Espera 1-2 minutos y tu sitio estará en:
   **https://TU-USUARIO.github.io/cuestage/**

---

## 📦 Estructura del repositorio

```
CueStage/
├── src/                          # Código fuente de la aplicación
│   ├── components/               # Componentes de React
│   ├── features/                 # Lógica por funcionalidad
│   ├── stores/                   # Estado de la aplicación (Zustand)
│   ├── styles/                   # CSS y estilos
│   ├── types/                    # Tipos de TypeScript
│   └── utils/                    # Utilidades
├── src-tauri/                    # Backend Tauri (Rust)
│   ├── src/                      # Código Rust
│   ├── icons/                    # Iconos de la aplicación
│   └── tauri.conf.json           # Configuración de Tauri
├── tests/                        # Pruebas unitarias
├── scripts/                      # Scripts de utilidad
├── website/                      # 🌐 Sitio web de descarga
│   └── index.html
├── README.md                     # Documentación completa
├── IMPLEMENTATION_STATUS.md      # Estado de implementación
└── package.json                  # Dependencias del proyecto
```

---

## 🚀 Comandos útiles

```powershell
# Verificar estado del repositorio
git status

# Verificar cambios pendientes
git status

# Ver historial de commits
git log --oneline -5

# Subir cambios futuros
git add -A
git commit -m "Descripción de cambios"
git push

# Ejecutar en modo desarrollo
npm run dev:tauri

# Compilar instalador de Windows
npm run build

# Ejecutar pruebas
npm test
```

---

## 🌐 Sitio web de descarga

El sitio web está en `src/features/home/HomeSection.tsx` y `website/index.html`. 

Para editarlo, modifica los archivos correspondientes y haz commit:
```powershell
git add .
git commit -m "Actualizar sitio web"
git push
```

---

## 📞 Soporte

Si tienes problemas con el despliegue, revisa:
1. Que el repositorio se llame exactamente `cuestage`
2. Que hayas activado GitHub Pages en Settings > Pages
3. Que hayas hecho push a la rama `main`

---
*CueStage - Control de música y efectos de sonido para presentaciones en vivo*