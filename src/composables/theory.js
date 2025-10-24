// Shared theory utilities: canonical pitch class naming, enharmonics, formatting
import { Note, Key, Chord } from "@tonaljs/tonal";

export const PC_FLAT_NAMES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];
export const PC_SHARP_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export const MAJOR_DEGREES = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
export const MINOR_DEGREES = ["i", "ii°", "III", "iv", "v", "VI", "VII"];

const CANON_CACHE = new Map();

export function pcToNumber(pc) {
  const m = Note.midi(`${pc}4`);
  return m == null ? null : m % 12;
}

// Convert a pitch-class name or note (with or without octave) to pitch-class number [0..11]
export function pcNumberFromName(noteOrPc) {
  const s = String(noteOrPc || "");
  const hasOct = /\d/.test(s);
  const midi = Note.midi(hasOct ? s : `${s}4`);
  if (midi == null) return null;
  return ((midi % 12) + 12) % 12;
}

// Get canonical name from pitch-class number using either flat or sharp preference
export function canonicalPcFromNumber(pcn, preferFlats) {
  if (pcn == null || Number.isNaN(pcn)) return "";
  const key = `${pcn}|${preferFlats ? 1 : 0}`;
  const cached = CANON_CACHE.get(key);
  if (cached) return cached;
  const arr = preferFlats ? PC_FLAT_NAMES : PC_SHARP_NAMES;
  const name = arr[Number(pcn) % 12];
  CANON_CACHE.set(key, name);
  return name;
}

export function canonicalizePc(pc, preferFlats) {
  const key = `${pc}|${preferFlats ? 1 : 0}`;
  const cached = CANON_CACHE.get(key);
  if (cached) return cached;
  const n = pcToNumber(pc);
  if (n == null) return pc;
  const val = (preferFlats ? PC_FLAT_NAMES : PC_SHARP_NAMES)[n];
  CANON_CACHE.set(key, val);
  return val;
}

export function preferFlatsForKey(root, type) {
  if (!root) return true;
  const isMinor = String(type).toLowerCase() === "minor";
  if (root.includes("b")) return true;
  if (root.includes("#")) return false;
  const FLAT_KEYS_MAJOR = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"]);
  const FLAT_KEYS_MINOR = new Set(["D", "G", "C", "F", "Bb", "Eb", "Ab"]);
  return isMinor ? FLAT_KEYS_MINOR.has(root) : FLAT_KEYS_MAJOR.has(root);
}

export function normalizePcForKey(pc, padLikeOrRoot, typeOpt) {
  if (!pc) return pc;
  let root, type;
  if (typeof padLikeOrRoot === "string") {
    root = padLikeOrRoot;
    type = typeOpt || "major";
  } else {
    const pad = padLikeOrRoot || {};
    type = pad.mode === "free" ? pad.scaleTypeFree : pad.scaleTypeScale;
    root = pad.mode === "free" ? pad.freeRoot : pad.scale;
  }
  return canonicalizePc(pc, preferFlatsForKey(root, type));
}

// Always flats for CSS key names
export function pcToCssKey(pc) {
  const n = pcToNumber(pc);
  if (n == null) return String(pc || "").toLowerCase();
  return PC_FLAT_NAMES[n].toLowerCase();
}

export function formatNotesForDisplay(notesWithOctave, padLike) {
  return toDisplayNotesForPad(notesWithOctave, padLike);
}

// Rebuild display note names from pitch-class numbers consistently
export function toDisplayNotesForPad(notesWithOctave, padLike) {
  const keyRoot = padLike?.mode === "free" ? padLike.freeRoot : padLike.scale;
  const type =
    padLike?.mode === "free" ? padLike.scaleTypeFree : padLike.scaleTypeScale;
  const prefer = preferFlatsForKey(keyRoot, type);
  return (notesWithOctave || []).map((n) => {
    const m = String(n).match(/^([A-Ga-g][#bB]*)(-?\d+)$/);
    if (!m) return n;
    const pcRaw = m[1];
    const oct = m[2];
    const pcn = pcNumberFromName(pcRaw);
    if (pcn == null) return n;
    const name = canonicalPcFromNumber(pcn, prefer);
    return `${name}${oct}`;
  });
}

export function normalizeChordSymbolForKey(sym, padLike) {
  if (!sym || typeof sym !== "string") return sym;
  const type =
    padLike?.mode === "free" ? padLike.scaleTypeFree : padLike.scaleTypeScale;
  const scaleRoot = padLike?.mode === "free" ? padLike.freeRoot : padLike.scale;
  // Accept uppercase 'B' accidentals defensively, though we emit lowercase 'b'
  const m = sym.match(/^([A-G](?:#{1,2}|[bB]{1,2})?)(.*)$/);
  if (!m) return sym;
  const root = canonicalizePc(m[1], preferFlatsForKey(scaleRoot, type));
  return `${root}${m[2] || ""}`;
}

export function chordDisplayForPad(pad) {
  // Build a display-friendly chord symbol including add/sus/7/9...
  const v = pad.mode === "free" ? pad.voicingFree : pad.voicingScale;
  let triadSymbol = "";
  if (pad.mode === "free") {
    const rootNorm = normalizePcForKey(pad.freeRoot, pad);
    triadSymbol =
      pad.scaleTypeFree === "minor" ? `${rootNorm}m` : `${rootNorm}`;
  } else {
    const type = pad.scaleTypeScale;
    const degs = type === "major" ? MAJOR_DEGREES : MINOR_DEGREES;
    const idx = degs.indexOf(pad.degree);
    const keyInfo =
      type === "major"
        ? Key.majorKey(pad.scale)
        : Key.minorKey(pad.scale).natural;
    const raw = keyInfo?.triads?.[idx] || pad.degree;
    triadSymbol = normalizeChordSymbolForKey(raw, pad);
  }
  if (v === "sus2" || v === "sus4") {
    const info = Chord.get(triadSymbol);
    let rootPc =
      info.tonic ||
      (info.notes?.[0] ? Note.pitchClass(info.notes[0]) : "") ||
      "";
    rootPc = normalizePcForKey(rootPc, pad);
    return `${rootPc}${v}`;
  }
  if (v === "triad") return triadSymbol;
  if (v === "add2" || v === "add9") return `${triadSymbol}(${v})`;
  if (["6", "7", "9", "11", "13"].includes(v)) return `${triadSymbol}${v}`;
  return triadSymbol;
}

// --- Shared chord/voicing note computation utilities ---
export function degreeIndex(deg, type) {
  return (type === "major" ? MAJOR_DEGREES : MINOR_DEGREES).indexOf(deg);
}

// Build pitch classes for a pad's chord, respecting mode (scale vs free) and voicing
export function computeChordNotesFor(pad) {
  const voicing = pad.mode === "free" ? pad.voicingFree : pad.voicingScale;
  let baseSymbol = "";
  if (pad?.mode === "free") {
    const root = pad.freeRoot;
    const st = pad.scaleTypeFree;
    const triadSymbol = st === "minor" ? `${root}m` : `${root}`;
    const seventhSymbol = st === "minor" ? `${root}m7` : `${root}maj7`;
    baseSymbol = ["triad", "add2", "add9", "6", "sus2", "sus4"].includes(
      voicing
    )
      ? triadSymbol
      : seventhSymbol;
  } else {
    const st = pad.scaleTypeScale;
    const idx = degreeIndex(pad.degree, st);
    if (idx < 0) return [];
    const keyInfo =
      st === "major"
        ? Key.majorKey(pad.scale)
        : Key.minorKey(pad.scale).natural;
    const triadSymbol = keyInfo.triads[idx];
    const seventhSymbol =
      (keyInfo.chords && keyInfo.chords[idx]) || triadSymbol;
    baseSymbol = ["triad", "add2", "add9", "6", "sus2", "sus4"].includes(
      voicing
    )
      ? triadSymbol
      : seventhSymbol;
  }
  let baseNotes = Chord.get(baseSymbol).notes;
  const root = Chord.get(baseSymbol).tonic || baseNotes[0];
  // Handle sus chords by replacing the 3rd with 2 or 4
  if (voicing === "sus2" || voicing === "sus4") {
    const tonic = root;
    if (tonic) {
      const second = Note.transpose(tonic, "2M"); // major 2nd from root
      const fourth = Note.transpose(tonic, "4P"); // perfect 4th from root
      const fifth = Note.transpose(tonic, "5P");
      baseNotes =
        voicing === "sus2" ? [tonic, second, fifth] : [tonic, fourth, fifth];
    }
  }
  // For add2, place the 2nd right above the root (not as a top add9)
  if (voicing === "add2" && root) {
    const second = Note.transpose(root, "2M");
    const rootPc = Note.pitchClass(root);
    const secondPc = Note.pitchClass(second);
    const pcs = baseNotes.map((n) => Note.pitchClass(n));
    const rest = pcs.filter((pc) => pc !== rootPc && pc !== secondPc);
    baseNotes = [rootPc, secondPc, ...rest];
  }
  const tensions = [];
  if (voicing === "add9") tensions.push("9M");
  // add2 is handled by reordering baseNotes above; do not also append as a top tension
  if (voicing === "6") tensions.push("6M");
  if (voicing === "9") tensions.push("9M");
  if (voicing === "11") tensions.push("9M", "11P");
  if (voicing === "13") tensions.push("9M", "11P", "13M");
  const extra = root ? tensions.map((ivl) => Note.transpose(root, ivl)) : [];
  const all = [...baseNotes, ...extra];
  const seen = new Set();
  const unique = [];
  for (const n of all) {
    const pc = Note.pitchClass(n);
    if (!seen.has(pc)) {
      seen.add(pc);
      unique.push(pc);
    }
  }
  return unique;
}

// Compute only the base chord notes (triad or seventh), excluding added tensions
export function computeBaseChordNotesFor(pad) {
  const voicing = pad.mode === "free" ? pad.voicingFree : pad.voicingScale;
  let baseSymbol = "";
  if (pad?.mode === "free") {
    const root = pad.freeRoot;
    const st = pad.scaleTypeFree;
    const triadSymbol = st === "minor" ? `${root}m` : `${root}`;
    const seventhSymbol = st === "minor" ? `${root}m7` : `${root}maj7`;
    baseSymbol = ["triad", "add2", "add9", "6", "sus2", "sus4"].includes(
      voicing
    )
      ? triadSymbol
      : seventhSymbol;
  } else {
    const st = pad.scaleTypeScale;
    const idx = degreeIndex(pad.degree, st);
    if (idx < 0) return [];
    const keyInfo =
      st === "major"
        ? Key.majorKey(pad.scale)
        : Key.minorKey(pad.scale).natural;
    const triadSymbol = keyInfo.triads[idx];
    const seventhSymbol =
      (keyInfo.chords && keyInfo.chords[idx]) || triadSymbol;
    baseSymbol = ["triad", "add2", "add9", "6", "sus2", "sus4"].includes(
      voicing
    )
      ? triadSymbol
      : seventhSymbol;
  }
  let baseNotes = Chord.get(baseSymbol).notes.map((n) => Note.pitchClass(n));
  // Handle sus by replacing the 3rd with 2 or 4
  if (voicing === "sus2" || voicing === "sus4") {
    const info = Chord.get(baseSymbol);
    let rootPc = info.tonic || (info.notes?.[0] ? Note.pitchClass(info.notes[0]) : "");
    if (rootPc) {
      const second = Note.pitchClass(Note.transpose(rootPc, "2M"));
      const fourth = Note.pitchClass(Note.transpose(rootPc, "4P"));
      const fifth = Note.pitchClass(Note.transpose(rootPc, "5P"));
      baseNotes = voicing === "sus2" ? [rootPc, second, fifth] : [rootPc, fourth, fifth];
    }
  }
  // For add2, place the 2nd right above the root in base ordering
  if (voicing === "add2") {
    const info = Chord.get(baseSymbol);
    const rootPc = info.tonic || (info.notes?.[0] ? Note.pitchClass(info.notes[0]) : "");
    if (rootPc) {
      const second = Note.pitchClass(Note.transpose(rootPc, "2M"));
      const pcs = baseNotes.map((n) => Note.pitchClass(n));
      const rest = pcs.filter((pc) => pc !== rootPc && pc !== second);
      baseNotes = [rootPc, second, ...rest];
    }
  }
  // Deduplicate while preserving order
  const seen = new Set();
  const unique = [];
  for (const pc of baseNotes) {
    if (!seen.has(pc)) {
      seen.add(pc);
      unique.push(pc);
    }
  }
  return unique;
}

export function inversionIndex(label) {
  if (label === "root") return 0;
  const m = String(label || "").match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

export function rotate(arr, k) {
  const n = arr.length;
  if (!n) return [];
  const r = ((k % n) + n) % n;
  return arr.slice(r).concat(arr.slice(0, r));
}

// Ensure notes are strictly ascending by raising octaves as needed
export function toAscendingWithOctave(pcs, baseOct = 4) {
  let lastMidi = -Infinity;
  let currentOct = baseOct;
  const result = [];
  for (const pc of pcs) {
    const hasOct = /[0-9]$/.test(pc);
    let candidate = hasOct ? pc : `${pc}${currentOct}`;
    let midi = Note.midi(candidate);
    if (midi == null) {
      // Try normalizing unicode accidentals if any
      const norm = pc.replace("♭", "b").replace("♯", "#");
      candidate = hasOct ? pc : `${norm}${currentOct}`;
      midi = Note.midi(candidate);
    }
    while (midi != null && midi <= lastMidi) {
      const m = candidate.match(/^(.*?)(-?\d+)$/);
      if (m) {
        const nextOct = Number(m[2]) + 1;
        candidate = `${m[1]}${nextOct}`;
      } else if (!hasOct) {
        currentOct += 1;
        candidate = `${pc}${currentOct}`;
      } else {
        break;
      }
      midi = Note.midi(candidate);
    }
    const m2 = candidate.match(/^(.*?)(-?\d+)$/);
    if (m2 && !hasOct) currentOct = Number(m2[2]);
    if (midi != null) lastMidi = midi;
    result.push(candidate);
  }
  return result;
}
