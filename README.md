# MIDI Test (Vite + WebMIDI + WebMidi.js)

This is a tiny Web MIDI test app using Vite and the `webmidi` library. It lists your MIDI outputs, lets you send chords (e.g., Cm9) to your synth or DAW.

## Features

- Connect/permission flow for Web MIDI
- Live list of outputs (with id/state/connection)
- Output selection + channel selection
- Play Cm9 chord button
- Panic (All Notes Off + Sustain Off)
- Rescan devices and live hot‑plug updates

## Requirements

- Modern browser with Web MIDI support (Chrome/Edge recommended)
- HTTPS (or `localhost`) is required for Web MIDI
- For mobile devices, use ngrok or localhost.run for a trusted HTTPS tunnel

## Run locally

1. Install deps

```bash
npm install
```

2. Start dev server

```bash
npm run dev
```

3. Open the app (on your computer)

- Use the URL shown in the terminal (e.g., `https://192.168.86.xx:3000` or `https://192.168.86.xx:3001`).
- Your browser may warn about a self-signed certificate—accept it once.

4. In the page

- Click "Connect MIDI" and Allow.
- Pick Output port and Channel.
- Click "Play Cm9" to send a chord.
- Use Panic if notes hang.

## Mobile access (phone/tablet)

Web MIDI requires HTTPS. Your dev server uses a self‑signed certificate, which phones don’t trust by default. Use one of these options:

### Option A: ngrok (quickest)

1. Verify your ngrok account email: https://dashboard.ngrok.com/user/settings
2. Start your dev server (keep it running):

```bash
npm run dev
```

3. In a new terminal, tunnel to your current dev URL (example):

```bash
ngrok http https://192.168.86.54:3001
```

4. Open the HTTPS URL from ngrok (e.g., `https://...ngrok-free.app`) on your phone.

Notes:
- Keep both terminals running (Vite and ngrok).
- The URL changes each ngrok session (unless on a paid plan).
- If you see an interstitial, tap "Visit Site".

If you don’t want to verify ngrok right now, you can use an alternative like `localhost.run`:

```bash
ssh -R 80:192.168.86.54:3001 nokey@localhost.run
```

It will print a public HTTPS URL you can open on your phone.

## Troubleshooting device detection

- Only IAC Driver shows up:
  - Ensure your synth is in USB MIDI mode (not storage/audio-only).
  - macOS: open Audio MIDI Setup > Show MIDI Studio; confirm the device has input/output ports and is online.
  - Try different cable/USB port; avoid problematic hubs.
  - Temporarily disable the IAC Driver to reduce confusion.

- No permission prompt or denied:
  - Click the lock icon in the browser address bar to reset site permissions.
  - The page shows Permission status—ensure it’s "granted".

- Hot plug not reflected:
  - Use the Rescan button.
  - Unplug/replug the device; the list should update.

## Project structure

- `index.html` – Entry HTML
- `src/App.vue` – All UI and MIDI logic (Vue)
- `src/main.js` – Vue entrypoint
- `vite.config.js` – Vite config

## Notes

- The “Play Cm9” button currently sends the chord `C3, Eb3, G3, Bb3, D4` on the selected output/channel for 1s.
- Panic sends CC 123 (All Notes Off) and CC 64 (Sustain Off) on the selected output/channel.
- Want different chord voicings or a virtual keyboard? Open an issue or adjust `src/App.vue` where the chord array is defined.
