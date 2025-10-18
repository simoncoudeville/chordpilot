# Chordpilot (Vite + Vue 3 + WebMIDI)

Chordpilot is a browser-based chord pad tool for quickly auditioning and sending harmonies to your synths or DAW over MIDI. It uses WebMidi.js for MIDI I/O and Tonal.js for music-theory utilities.

## Highlights

- Two editing modes per pad
  - Free mode: choose any Root (C#/Db style labels), Type (major/minor), Voicing (triad/7/add9/9/11/13), Inversion, and Octave.
  - Scale mode: choose a musical Key and a diatonic Chord by degree (I, ii, …) with the same Voicing/Inversion/Octave options.
- Preview: press-and-hold audition while editing a pad.
- Notation that makes sense: enharmonic display follows the chosen key (e.g., G#/Ab), with lowercase flats in UI text.
- Live keyboard: keys light up while notes are held.
- MIDI settings: pick Output + Channel; your choice is remembered.
- Persistence: all pads and MIDI settings are saved to localStorage and restored on load.

## Requirements

- A browser with Web MIDI support (Chrome/Edge recommended).
- HTTPS (or `http://localhost`) is required for Web MIDI. For phones/tablets, use an HTTPS tunnel like ngrok.

## Getting started

1) Install dependencies

```bash
npm install
```

2) Start the dev server

```bash
npm run dev
```

3) Open the app

- Use the URL in the terminal (localhost or your LAN IP).
- Grant MIDI permission when prompted, then click “Connect MIDI” if needed.
- Open “MIDI Settings” to choose your Output + Channel (saved afterwards).

## Using pads

- Each pad can be edited (Edit button) and played (press and hold).
- Mode
  - Free: select Root and Type; set Voicing, Inversion, Octave.
  - Scale: select Scale (Key) and Chord degree; set Voicing, Inversion, Octave.
- Preview in the dialog auditions the current settings while held.
- The pad label shows the chord (with slash bass for inversions when relevant), rendered with key-appropriate #/b.

## Notation rules

- Scale select and Free root use Ableton-style labels (C#/Db) for clarity.
- Flats render with a lowercase b in the UI (e.g., Bb) even under global uppercase styling.
- “Now playing” notes are normalized to the current key/root for clean display.

## MIDI notes

- WebMidi.js handles device detection and output/channel routing.
- The app prevents stuck notes by tracking active pads; preview and pad presses send note off on release.

## Persisted settings

- Pads and MIDI settings are stored in localStorage under:
  - `midi-test:pads`
  - `midi-test:midi-settings`

## Project structure

- `index.html` – App entry
- `src/App.vue` – Main UI, music logic, and MIDI interactions
- `src/main.js` – Vue bootstrap
- `src/style.css` – Global styles (with flat-accidental overrides)
- `vite.config.js` – Vite config

## Mobile access (optional)

If you want to control hardware from your phone/tablet on the same network, tunnel the dev server over HTTPS (e.g., ngrok):

```bash
ngrok http http://<your-local-ip>:3000
```

Open the ngrok HTTPS URL on your phone, grant MIDI permission, and connect to a portable synth via USB/host if supported.

## Troubleshooting

- No devices or permission denied: reset site permissions (lock icon), then reload and allow MIDI.
- Device doesn’t appear: check macOS Audio MIDI Setup, try a different cable/port, or avoid problematic hubs.
- Stuck notes: release the pad/preview; leaving or closing the page sends note off for any sustained notes.

## License

MIT
