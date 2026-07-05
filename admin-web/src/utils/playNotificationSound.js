/**
 * Plays real WAV notification sounds from /public/sounds/.
 * Generated with bell + marimba partials (WhatsApp / Teams style).
 */

const SOUNDS = {
  newOrder: '/sounds/new-order.wav',
  whatsapp: '/sounds/whatsapp.wav',
  teams: '/sounds/teams.wav',
};

/** @type {Record<string, HTMLAudioElement>} */
const cache = {};

function getClip(key) {
  const url = SOUNDS[key];
  if (!url) return null;

  if (!cache[key]) {
    const audio = new Audio(url);
    audio.preload = 'auto';
    cache[key] = audio;
  }

  return cache[key];
}

function playClip(key, volume = 0.9) {
  const audio = getClip(key);
  if (!audio) return;

  try {
    const instance = audio.cloneNode();
    instance.volume = volume;
    void instance.play().catch((err) => {
      console.warn(`Notification sound (${key}) blocked:`, err?.message || err);
    });
  } catch (err) {
    console.warn('Notification sound failed:', err);
  }
}

/** Default alert when a new order arrives (WhatsApp ding + Teams chime). */
export function playNewOrderSound() {
  playClip('newOrder', 0.92);
}

/** Optional: WhatsApp-style double bell only. */
export function playWhatsAppSound() {
  playClip('whatsapp', 0.9);
}

/** Optional: Teams-style ascending marimba only. */
export function playTeamsSound() {
  playClip('teams', 0.88);
}

/** Preload clips after first user interaction (avoids browser autoplay block). */
export function primeNotificationAudio() {
  Object.keys(SOUNDS).forEach((key) => {
    const audio = getClip(key);
    if (!audio) return;
    audio.load();
    // Silent prime — satisfies gesture requirement in strict browsers
    const silent = audio.cloneNode();
    silent.volume = 0.001;
    void silent.play()
      .then(() => silent.pause())
      .catch(() => {});
  });
}
