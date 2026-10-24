/**
 * Generates the audio fixtures used by the real-audio verification lab.
 *
 * The files are plain 16-bit PCM WAV, written without any external library so
 * the fixtures can always be regenerated.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(here, '..', 'tests', 'media');
mkdirSync(outputDir, { recursive: true });

const SAMPLE_RATE = 44100;

function writeWav(fileName, samples, channels = 2, sampleRate = SAMPLE_RATE) {
  const bytesPerSample = 2;
  const dataSize = samples.length * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // PCM header size
  buffer.writeUInt16LE(1, 20); // format: PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(channels * bytesPerSample, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  // The samples are interleaved: L, R, L, R…
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const value = Math.round(clamped * 32767);
    for (let channel = 0; channel < channels; channel += 1) {
      buffer.writeInt16LE(value, offset);
      offset += 2;
    }
  }

  const target = join(outputDir, fileName);
  writeFileSync(target, buffer);
  console.log(
    `  ${fileName}  ${(dataSize / 1024).toFixed(1)} KB  ${(samples.length / sampleRate).toFixed(2)} s  ${channels} can.`,
  );
  return target;
}

function sine(frequency, duration, amplitude = 0.6, sampleRate = SAMPLE_RATE) {
  const count = Math.round(duration * sampleRate);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    // A short fade at both ends avoids clicks in the fixture itself.
    const envelope = Math.min(1, i / 200, (count - i) / 200);
    samples[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * amplitude * envelope;
  }
  return samples;
}

/** A short percussive click, useful to test very short effects. */
function click(duration = 0.12, sampleRate = SAMPLE_RATE) {
  const count = Math.round(duration * sampleRate);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const decay = Math.exp(-i / (sampleRate * 0.015));
    samples[i] = Math.sin((2 * Math.PI * 1800 * i) / sampleRate) * decay * 0.8;
  }
  return samples;
}

console.log('Generando los archivos de audio de prueba:');
writeWav('tono-440.wav', sine(440, 3, 0.6));
writeWav('tono-220.wav', sine(220, 2, 0.6));
writeWav('clic.wav', click(), 1);
console.log(`Carpeta: ${outputDir}`);