import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './bridge';
import type { AudioFormat } from '../types';

/** Formats the Web Audio engine of the host can decode. */
export const SUPPORTED_EXTENSIONS: readonly string[] = ['wav', 'mp3', 'ogg'];

export const SUPPORTED_EXTENSIONS_LABEL = 'MP3, WAV y OGG';

const MIME_TYPES: Record<AudioFormat, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  unknown: 'application/octet-stream',
};

export function detectFormat(fileName: string): AudioFormat {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'wav' || extension === 'mp3' || extension === 'ogg') {
    return extension;
  }
  return 'unknown';
}

/**
 * Reads the bytes of an audio file.
 *
 * The backend only returns files that the user has authorised: the ones
 * chosen in the file picker and the ones that belong to a project that has
 * been opened.
 */
export async function readAudioBytes(path: string): Promise<ArrayBuffer> {
  if (!isTauri()) {
    throw new Error('La lectura de archivos requiere la aplicación de escritorio.');
  }
  const bytes = await invoke<ArrayBuffer>('read_audio_file', { path });
  if (!bytes || bytes.byteLength === 0) {
    throw new Error('El archivo está vacío o no se puede leer.');
  }
  return bytes;
}

/** Files imported while running in a plain browser. */
const memoryFiles = new Map<string, File>();

export function registerInMemoryFile(id: string, file: File): void {
  memoryFiles.set(id, file);
}

export function getInMemoryFile(id: string): File | undefined {
  return memoryFiles.get(id);
}

/**
 * Reads the duration of a file without decoding the whole PCM data.
 *
 * Uses the metadata of an `Audio` element fed with a temporary object URL,
 * which is fast even for long tracks. Returns `null` when the browser cannot
 * read the metadata.
 */
function probeDuration(url: string, timeoutMs = 8000): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.removeAttribute('src');
      audio.load();
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration;
      finish(Number.isFinite(duration) && duration > 0 ? duration : null);
    });
    audio.addEventListener('error', () => finish(null));
    audio.src = url;
  });
}

/** Reads the duration of a file from its bytes. */
export async function probeDurationFromBytes(
  bytes: ArrayBuffer,
  format: AudioFormat,
): Promise<number | null> {
  const blob = new Blob([bytes], { type: MIME_TYPES[format] });
  const url = URL.createObjectURL(blob);
  try {
    return await probeDuration(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
