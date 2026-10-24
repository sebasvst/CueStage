import type { DecodedAudioBuffer } from './AudioTypes';

/**
 * LRU cache of decoded PCM buffers.
 *
 * Decoding a file takes hundreds of milliseconds, so live playback must never
 * decode on demand. Buffers are kept in memory and evicted in least-recently
 * used order once the memory budget is exceeded, so a long session with many
 * assets does not grow without bound.
 */

interface CacheEntry {
  buffer: DecodedAudioBuffer;
  bytes: number;
  lastUsed: number;
}

/** Rough in-memory cost of a decoded buffer (Float32 samples). */
function estimateBufferBytes(buffer: DecodedAudioBuffer): number {
  return Math.ceil(buffer.duration * buffer.sampleRate * buffer.numberOfChannels * 4);
}

/**
 * Memory budget for the decoded audio.
 *
 * A long track needs a lot of it: 13 minutes of stereo audio is about 283 MB
 * once decoded to PCM. The budget is generous so the music and every effect
 * stay ready, and the least recently used one is discarded if it is exceeded.
 */
const DEFAULT_CACHE_BUDGET_BYTES = 512 * 1024 * 1024;

export class AudioBufferCache {
  private readonly entries = new Map<string, CacheEntry>();
  private totalBytes = 0;
  private clock = 0;

  constructor(private budgetBytes: number = DEFAULT_CACHE_BUDGET_BYTES) {}

  get size(): number {
    return this.entries.size;
  }

  get bytes(): number {
    return this.totalBytes;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  get(id: string): DecodedAudioBuffer | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    entry.lastUsed = ++this.clock;
    return entry.buffer;
  }

  set(id: string, buffer: DecodedAudioBuffer): void {
    const existing = this.entries.get(id);
    if (existing) {
      this.totalBytes -= existing.bytes;
      this.entries.delete(id);
    }
    const bytes = estimateBufferBytes(buffer);
    this.entries.set(id, { buffer, bytes, lastUsed: ++this.clock });
    this.totalBytes += bytes;
    this.evictIfNeeded(id);
  }

  delete(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.totalBytes -= entry.bytes;
    this.entries.delete(id);
  }

  clear(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }

  /** Ids currently held in memory, most recently used last. */
  ids(): string[] {
    return [...this.entries.keys()];
  }

  private evictIfNeeded(protectId: string): void {
    if (this.totalBytes <= this.budgetBytes) return;
    const ordered = [...this.entries.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [id, entry] of ordered) {
      if (this.totalBytes <= this.budgetBytes) break;
      if (id === protectId) continue;
      this.entries.delete(id);
      this.totalBytes -= entry.bytes;
    }
  }
}
