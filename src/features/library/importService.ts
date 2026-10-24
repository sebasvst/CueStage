import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { createUuid } from '../../utils/id';
import {
  detectFormat,
  probeDurationFromBytes,
  readAudioBytes,
  registerInMemoryFile,
  SUPPORTED_EXTENSIONS,
  SUPPORTED_EXTENSIONS_LABEL,
} from '../../services/assetService';
import { isTauri } from '../../services/bridge';
import { projectService } from '../../services/projectService';
import type { AudioAsset } from '../../types';

export interface ImportOutcome {
  assets: AudioAsset[];
  skipped: { name: string; reason: string }[];
}

const AUDIO_FILTERS = [
  {
    name: 'Archivos de audio',
    extensions: [...SUPPORTED_EXTENSIONS],
  },
];

/** Opens the native file picker and imports the selected files. */
export async function importWithFilePicker(
  projectId: string,
): Promise<ImportOutcome | null> {
  if (!isTauri()) return null;

  const selection = await open({
    multiple: true,
    directory: false,
    filters: AUDIO_FILTERS,
    title: 'Selecciona los archivos de audio',
  });
  if (!selection) return null;

  const paths = Array.isArray(selection) ? selection : [selection];
  return importPaths(projectId, paths);
}

/** Opens the native folder picker and imports every audio file inside. */
export async function importWithFolderPicker(
  projectId: string,
): Promise<ImportOutcome | null> {
  if (!isTauri()) return null;

  const selection = await open({
    multiple: false,
    directory: true,
    title: 'Selecciona una carpeta con audio',
  });
  if (!selection || Array.isArray(selection)) return null;

  const paths = await invoke<string[]>('list_audio_files', { directory: selection });
  if (paths.length === 0) {
    return { assets: [], skipped: [] };
  }
  return importPaths(projectId, paths);
}

/**
 * Imports files by absolute path.
 *
 * The files are copied into the project resources folder; the originals are
 * never modified nor deleted.
 */
export async function importPaths(
  projectId: string,
  paths: string[],
): Promise<ImportOutcome> {
  const supported: string[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const path of paths) {
    const name = path.split(/[\\/]/).pop() ?? path;
    if (detectFormat(name) === 'unknown') {
      skipped.push({
        name,
        reason: `Formato no compatible (solo ${SUPPORTED_EXTENSIONS_LABEL}).`,
      });
      continue;
    }
    supported.push(path);
  }

  if (supported.length === 0) {
    return { assets: [], skipped };
  }

  const items = supported.map((path) => ({ id: createUuid(), sourcePath: path }));
  const imported = await projectService.importFiles(projectId, items);

  const assets: AudioAsset[] = [];
  for (const file of imported) {
    const format = detectFormat(file.fileName);
    const duration = await (async () => {
      try {
        const bytes = await readAudioBytes(file.absolutePath);
        return await probeDurationFromBytes(bytes.slice(0), format);
      } catch {
        return null;
      }
    })();
    assets.push({
      id: file.id,
      name: file.fileName,
      fileName: file.fileName,
      storage: 'embedded',
      relativePath: file.relativePath,
      absolutePath: file.absolutePath,
      format,
      durationSec: duration,
      sizeBytes: file.sizeBytes,
      addedAt: new Date().toISOString(),
    });
  }

  return { assets, skipped };
}

/** Imports files selected with a plain file input (browser development mode). */
export async function importFileHandles(files: File[]): Promise<ImportOutcome> {
  const assets: AudioAsset[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const file of files) {
    if (detectFormat(file.name) === 'unknown') {
      skipped.push({
        name: file.name,
        reason: `Formato no compatible (solo ${SUPPORTED_EXTENSIONS_LABEL}).`,
      });
      continue;
    }
    const id = createUuid();
    registerInMemoryFile(id, file);
    const format = detectFormat(file.name);

    // Un archivo que no se puede leer no debe abortar toda la importación.
    const duration = await (async () => {
      try {
        return await probeDurationFromBytes(await file.arrayBuffer(), format);
      } catch {
        return null;
      }
    })();

    assets.push({
      id,
      name: file.name,
      fileName: file.name,
      storage: 'external',
      relativePath: null,
      absolutePath: file.name,
      format,
      durationSec: duration,
      sizeBytes: file.size,
      addedAt: new Date().toISOString(),
    });
  }

  return { assets, skipped };
}

/**
 * Registers a listener for the operating system drag and drop.
 *
 * Returns the function that removes the listener.
 */
export function onFileDrop(
  onDrop: (paths: string[]) => void,
  onHoverChange: (active: boolean) => void,
): () => void {
  if (!isTauri()) return () => undefined;

  let unlisten: (() => void) | null = null;
  let cancelled = false;

  void getCurrentWebview()
    .onDragDropEvent((event) => {
      if (event.payload.type === 'over') {
        onHoverChange(true);
      } else if (event.payload.type === 'leave') {
        onHoverChange(false);
      } else if (event.payload.type === 'drop') {
        onHoverChange(false);
        const paths = event.payload.paths.filter(
          (path) => detectFormat(path) !== 'unknown',
        );
        if (paths.length > 0) onDrop(paths);
      }
    })
    .then((stop) => {
      if (cancelled) {
        stop();
        return;
      }
      unlisten = stop;
    })
    .catch(() => {
      /* Drag and drop is optional; the file picker remains available. */
    });

  return () => {
    cancelled = true;
    unlisten?.();
    unlisten = null;
  };
}
