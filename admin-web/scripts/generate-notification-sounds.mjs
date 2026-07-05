/**
 * Generates realistic chat-app style notification WAV files (bell / marimba partials).
 * Run: node scripts/generate-notification-sounds.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../public/sounds');
const SAMPLE_RATE = 44100;

function bellTone(freq, timeSec, durationSec) {
  if (timeSec < 0 || timeSec > durationSec) return 0;
  const partials = [
    { ratio: 1, amp: 1, decay: 4.5 },
    { ratio: 2.56, amp: 0.55, decay: 6 },
    { ratio: 5.12, amp: 0.28, decay: 9 },
    { ratio: 8.45, amp: 0.12, decay: 12 },
  ];
  let s = 0;
  for (const p of partials) {
    s += p.amp * Math.sin(2 * Math.PI * freq * p.ratio * timeSec) * Math.exp(-p.decay * timeSec);
  }
  const attack = Math.min(1, timeSec / 0.004);
  return s * attack;
}

function marimbaTone(freq, timeSec, durationSec) {
  if (timeSec < 0 || timeSec > durationSec) return 0;
  const partials = [
    { ratio: 1, amp: 1, decay: 14 },
    { ratio: 2.76, amp: 0.35, decay: 18 },
    { ratio: 5.4, amp: 0.12, decay: 22 },
  ];
  let s = 0;
  for (const p of partials) {
    s += p.amp * Math.sin(2 * Math.PI * freq * p.ratio * timeSec) * Math.exp(-p.decay * timeSec);
  }
  const attack = Math.min(1, timeSec / 0.002);
  return s * attack;
}

function mixNotes(notes, totalDurationSec) {
  const length = Math.ceil(totalDurationSec * SAMPLE_RATE);
  const buffer = new Float32Array(length);

  for (const note of notes) {
    const startSample = Math.floor(note.start * SAMPLE_RATE);
    const durSamples = Math.ceil(note.duration * SAMPLE_RATE);
    for (let i = 0; i < durSamples; i++) {
      const idx = startSample + i;
      if (idx >= length) break;
      const t = i / SAMPLE_RATE;
      const sample =
        note.type === 'marimba'
          ? marimbaTone(note.freq, t, note.duration)
          : bellTone(note.freq, t, note.duration);
      buffer[idx] += sample * (note.gain ?? 0.35);
    }
  }

  let peak = 0;
  for (let i = 0; i < length; i++) {
    peak = Math.max(peak, Math.abs(buffer[i]));
  }
  if (peak > 0) {
    const norm = 0.92 / peak;
    for (let i = 0; i < length; i++) buffer[i] *= norm;
  }

  return buffer;
}

function writeWav(filename, floatSamples) {
  const numSamples = floatSamples.length;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, floatSamples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  writeFileSync(filename, buffer);
  console.log('Wrote', filename);
}

mkdirSync(OUT_DIR, { recursive: true });

// WhatsApp-style: two soft bell pops
const whatsapp = mixNotes(
  [
    { freq: 740, start: 0, duration: 0.14, gain: 0.42, type: 'bell' },
    { freq: 988, start: 0.16, duration: 0.18, gain: 0.4, type: 'bell' },
  ],
  0.42,
);
writeWav(join(OUT_DIR, 'whatsapp.wav'), whatsapp);

// Teams-style: gentle ascending marimba triplet
const teams = mixNotes(
  [
    { freq: 523.25, start: 0, duration: 0.22, gain: 0.32, type: 'marimba' },
    { freq: 659.25, start: 0.1, duration: 0.24, gain: 0.3, type: 'marimba' },
    { freq: 783.99, start: 0.2, duration: 0.28, gain: 0.28, type: 'marimba' },
  ],
  0.55,
);
writeWav(join(OUT_DIR, 'teams.wav'), teams);

// Combined new-order alert: WhatsApp double + Teams rise
const newOrder = mixNotes(
  [
    { freq: 740, start: 0, duration: 0.13, gain: 0.38, type: 'bell' },
    { freq: 988, start: 0.14, duration: 0.16, gain: 0.36, type: 'bell' },
    { freq: 587.33, start: 0.34, duration: 0.2, gain: 0.26, type: 'marimba' },
    { freq: 739.99, start: 0.44, duration: 0.22, gain: 0.24, type: 'marimba' },
    { freq: 880, start: 0.54, duration: 0.26, gain: 0.22, type: 'marimba' },
  ],
  0.85,
);
writeWav(join(OUT_DIR, 'new-order.wav'), newOrder);
