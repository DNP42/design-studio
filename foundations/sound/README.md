# UI sounds

UI sounds are optional. A product works fully without them.

## Rules
1. Sound is **off by default**. The user turns it on.
2. Show a mute toggle on every page where sound can play. Put it in the same place on every page. Give it a text label ("Sound: on" / "Sound: off") and `aria-pressed`.
3. Remember the choice in `localStorage` under the key `ui-sound` (`"on"` or `"off"`). Wrap every read and write in `try/catch`. When storage fails, sound stays off.
4. Play a sound only as the answer to a user action (click, tap, key). Never on page load, hover, scroll or typing. Never more than one sound per action.
5. Keep a sound at 300 ms or less. Set the gain at 0.3 or less. Use soft tones: no alarm, siren or buzz.
6. A sound never carries information alone. Every sound has a visible equivalent, such as a message or an icon (WCAG 1.3.3).
7. Prefer short tones made with the Web Audio API: 0 kB of files. When you use files, keep each file at 10 kB or less and load them only after the user turns sound on.
8. Create the `AudioContext` only after the first user action, because browsers block audio before it.

## Allowed sounds
| Event | Sound |
|---|---|
| Success (copied, saved, downloaded) | One soft high tone |
| Error | One soft low tone |
| Toggle sound on | The success tone, as a sample |

No other events get a sound.

## Example
```js
const SOUND_KEY = "ui-sound";
let audioContext;

function isSoundOn() {
  try { return localStorage.getItem(SOUND_KEY) === "on"; } catch { return false; }
}

function saveSoundChoice(isOn) {
  try { localStorage.setItem(SOUND_KEY, isOn ? "on" : "off"); } catch {}
}

function playTone(frequencyHz, durationMs = 120) {
  if (!isSoundOn()) return;
  audioContext ??= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const endAt = audioContext.currentTime + durationMs / 1000;
  oscillator.frequency.value = frequencyHz;
  gain.gain.setValueAtTime(0.2, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, endAt);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(endAt);
}

// playTone(880) for success, playTone(330) for an error.
```
