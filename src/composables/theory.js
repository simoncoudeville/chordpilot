// Apply voicing pattern to a chord note array — extensible engine-based approach
export function applyVoicingPattern(notes, voicingType) {
  if (!Array.isArray(notes) || !notes.length) return [];
  const out = [...notes];

  // Helper: parse note into { head, oct, midi, raw }
  function parseNote(n) {
    const s = String(n);
    const m = s.match(/^(.*?)(-?\d+)$/);
    const head = m ? m[1] : s;
    const oct = m ? Number(m[2]) : null;
    const midi = Note.midi(s);
    return { head, oct, midi, raw: s };
  }

  function buildNote(head, oct) {
    if (oct == null) return head;
    return `${head}${oct}`;
  }

  // Operations engine
  const OPS = {
    reorder(notesArr, idxProvider) {
      const idxs =
        typeof idxProvider === "function" ? idxProvider(notesArr) : idxProvider;
      return idxs.map((i) => notesArr[i]).filter((x) => x != null);
    },
    raiseByOctaves(notesArr, idxs, steps = 1) {
      const parsed = notesArr.map((n) => parseNote(n));
      const set = new Set(idxs);
      return parsed.map((p, i) => {
        if (!set.has(i) || p.oct == null) return p.raw;
        return buildNote(p.head, p.oct + steps);
      });
    },
    lowerByOctaves(notesArr, idxs, steps = 1) {
      const parsed = notesArr.map((n) => parseNote(n));
      const set = new Set(idxs);
      return parsed.map((p, i) => {
        if (!set.has(i) || p.oct == null) return p.raw;
        return buildNote(p.head, p.oct - steps);
      });
    },
    dropNthHighest(notesArr, n) {
      if (notesArr.length < n) return notesArr;
      const parsed = notesArr.map((n) => ({ n, midi: Note.midi(n) }));
      parsed.sort((a, b) => a.midi - b.midi);
      const idx = parsed.length - n;
      const m = parsed[idx].n.match(/^(.*?)(-?\d+)$/);
      if (m) parsed[idx].n = `${m[1]}${Number(m[2]) - 1}`;
      return parsed.map((x) => x.n);
    },
    alternateOctaves(notesArr) {
      if (notesArr.length < 2) return notesArr;
      const parsed = notesArr.map((n) => parseNote(n));
      const minOct = Math.min(
        ...parsed.map((p) => (p.oct == null ? Infinity : p.oct))
      );
      const maxOct = minOct + 1;
      return parsed.map((p, i) =>
        buildNote(p.head, i % 2 === 0 ? minOct : maxOct)
      );
    },
  };

  // Declarative pattern definitions — easy to extend with new ops
  const PATTERNS = {
    close: [],
    open: [
      {
        op: "reorder",
        idxProvider: (arr) =>
          arr
            .map((_, i) => i)
            .filter((_, i) => i % 2 === 0)
            .concat(arr.map((_, i) => i).filter((_, i) => i % 2 === 1)),
      },
      // conditional adjust: if single-octave input then raise odd indices
      { op: "conditionalRaiseOddsIfSingleOctave", steps: 1 },
    ],
    drop2: [{ op: "dropNthHighest", n: 2 }],
    drop3: [{ op: "dropNthHighest", n: 3 }],
    spread: [{ op: "alternateOctaves" }],
  };

  const pattern = PATTERNS[voicingType] || PATTERNS.close;

  // Start with original notes
  let cur = out.slice();

  for (const step of pattern) {
    if (!step || !step.op) continue;
    if (step.op === "reorder") {
      cur = OPS.reorder(cur, step.idxProvider);
      continue;
    }
    if (step.op === "conditionalRaiseOddsIfSingleOctave") {
      const parsed = cur.map((n) => parseNote(n));
      const octSet = new Set(parsed.map((p) => p.oct).filter((x) => x != null));
      if (octSet.size <= 1) {
        // raise odd indices
        const odds = cur.map((_, i) => i).filter((i) => i % 2 === 1);
        cur = OPS.raiseByOctaves(cur, odds, step.steps || 1);
      }
      continue;
    }
    if (step.op === "dropNthHighest") {
      cur = OPS.dropNthHighest(cur, step.n || 2);
      continue;
    }
    if (step.op === "alternateOctaves") {
      cur = OPS.alternateOctaves(cur);
      continue;
    }
  }

  return cur;
}

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

function clampOctave(value, fallback = 4) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(6, Math.max(2, Math.round(n)));
}

function normalizeScaleType(type) {
  const t = String(type || "major").toLowerCase();
  return t === "minor" ? "minor" : "major";
}

function normalizeNumber(num) {
  if (num == null) return null;
  const n = Number(num);
  if (!Number.isFinite(n)) return null;
  return ((n % 12) + 12) % 12;
}

function dedupePitchClasses(nums) {
  const seen = new Set();
  const out = [];
  for (const raw of nums || []) {
    const n = normalizeNumber(raw);
    if (n == null || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function extensionIntervalsForVoicing(voicing) {
  switch (String(voicing || "").toLowerCase()) {
    case "add9":
      return ["9M"];
    case "6":
      return ["6M"];
    case "9":
      return ["9M"];
    case "11":
      return ["9M", "11P"];
    case "13":
      return ["9M", "11P", "13M"];
    default:
      return [];
  }
}

function prettifyChordSymbol(symbol) {
  if (!symbol || typeof symbol !== "string") return symbol;
  return symbol
    .replace(/dim(?![a-z])/gi, "°")
    .replace(/m7b5/gi, "ø7")
    .replace(/maj7\(9\)/gi, "maj9")
    .replace(/maj7\(11\)/gi, "maj11")
    .replace(/maj7\(13\)/gi, "maj13")
    .replace(/([A-G](?:#{1,2}|b{1,2})?)m7\(9\)/gi, "$1m9")
    .replace(/([A-G](?:#{1,2}|b{1,2})?)m7\(11\)/gi, "$1m11")
    .replace(/([A-G](?:#{1,2}|b{1,2})?)m7\(13\)/gi, "$1m13")
    .replace(/([A-G](?:#{1,2}|b{1,2})?)7\(9\)/gi, "$19")
    .replace(/([A-G](?:#{1,2}|b{1,2})?)7\(11\)/gi, "$1 11")
    .replace(/([A-G](?:#{1,2}|b{1,2})?)7\(13\)/gi, "$1 13")
    .replace(/([A-G](?:#{1,2}|b{1,2})?)\s11/gi, "$111")
    .replace(/([A-G](?:#{1,2}|b{1,2})?)\s13/gi, "$113");
}

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
  return normalizeNumber(midi);
}

// Get canonical name from pitch-class number using either flat or sharp preference
export function canonicalPcFromNumber(pcn, preferFlats) {
  const n = normalizeNumber(pcn);
  if (n == null) return "";
  const key = `${n}|${preferFlats ? 1 : 0}`;
  const cached = CANON_CACHE.get(key);
  if (cached) return cached;
  const arr = preferFlats ? PC_FLAT_NAMES : PC_SHARP_NAMES;
  const name = arr[n % 12];
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
  let root;
  let type;
  if (typeof padLikeOrRoot === "string") {
    root = padLikeOrRoot;
    type = typeOpt || "major";
  } else {
    const pad = padLikeOrRoot || {};
    type = pad.mode === "free" ? pad.scaleTypeFree : pad.scaleTypeScale;
    type = normalizeScaleType(type);
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
  const m = sym.match(/^([A-G](?:#{1,2}|[bB]{1,2})?)(.*)$/);
  if (!m) return sym;
  const root = canonicalizePc(m[1], preferFlatsForKey(scaleRoot, type));
  return `${root}${m[2] || ""}`;
}

function normalizePadForTheory(rawPad = {}) {
  const mode =
    rawPad.mode === "free"
      ? "free"
      : rawPad.mode === "scale"
      ? "scale"
      : "unassigned";
  const assigned = rawPad.assigned === false ? false : true;
  const scaleTypeScale = normalizeScaleType(rawPad.scaleTypeScale);
  const scaleTypeFree = normalizeScaleType(
    rawPad.scaleTypeFree != null ? rawPad.scaleTypeFree : scaleTypeScale
  );
  const rawScale = rawPad.scale || "C";
  const rawFreeRoot = rawPad.freeRoot || rawScale;
  const scale = canonicalizePc(
    rawScale,
    preferFlatsForKey(rawScale, scaleTypeScale)
  );
  const freeRoot = canonicalizePc(
    rawFreeRoot,
    preferFlatsForKey(rawFreeRoot, scaleTypeFree)
  );
  const degreeList = scaleTypeScale === "minor" ? MINOR_DEGREES : MAJOR_DEGREES;
  const degree =
    mode === "scale"
      ? degreeList.includes(rawPad.degree)
        ? rawPad.degree
        : degreeList[0]
      : rawPad.degree || degreeList[0];
  return {
    ...rawPad,
    mode,
    assigned,
    scale,
    freeRoot,
    scaleTypeScale,
    scaleTypeFree,
    degree,
    voicingScale: rawPad.voicingScale || "triad",
    voicingFree: rawPad.voicingFree || "triad",
    inversionScale: rawPad.inversionScale || "root",
    inversionFree: rawPad.inversionFree || "root",
    octaveScale: clampOctave(rawPad.octaveScale),
    octaveFree: clampOctave(rawPad.octaveFree),
  };
}

function buildChordContext(rawPad) {
  const normalized = normalizePadForTheory(rawPad || {});
  if (
    !normalized ||
    normalized.mode === "unassigned" ||
    normalized.assigned === false
  ) {
    return null;
  }
  const mode = normalized.mode;
  const scaleType =
    mode === "free" ? normalized.scaleTypeFree : normalized.scaleTypeScale;
  const voicing =
    mode === "free" ? normalized.voicingFree : normalized.voicingScale;
  const inversion =
    mode === "free" ? normalized.inversionFree : normalized.inversionScale;
  const octave =
    mode === "free" ? normalized.octaveFree : normalized.octaveScale;
  const root = mode === "free" ? normalized.freeRoot : normalized.scale;
  const preferFlats = preferFlatsForKey(root, scaleType);
  let triadSymbol = "";
  let seventhSymbol = "";

  if (mode === "free") {
    const rootNorm = normalizePcForKey(root, normalized);
    triadSymbol = scaleType === "minor" ? `${rootNorm}m` : rootNorm;
    seventhSymbol = scaleType === "minor" ? `${rootNorm}m7` : `${rootNorm}maj7`;
  } else {
    const degreeList = scaleType === "minor" ? MINOR_DEGREES : MAJOR_DEGREES;
    const idxRaw = degreeList.indexOf(normalized.degree);
    const idx = idxRaw >= 0 ? idxRaw : 0;
    const actualDegree = degreeList[idx];
    const keyInfo =
      scaleType === "major" ? Key.majorKey(root) : Key.minorKey(root).natural;
    const triadRaw = keyInfo?.triads?.[idx] ?? actualDegree;
    const seventhRaw = (keyInfo?.chords && keyInfo.chords[idx]) || triadRaw;
    triadSymbol = normalizeChordSymbolForKey(triadRaw, normalized);
    seventhSymbol = normalizeChordSymbolForKey(seventhRaw, normalized);
  }

  return {
    pad: normalized,
    mode,
    scaleType,
    voicing,
    inversion,
    octave,
    root,
    preferFlats,
    triadSymbol,
    seventhSymbol,
  };
}

function symbolForNoteStack(ctx) {
  const voicing = String(ctx.voicing || "");
  const lower = voicing.toLowerCase();
  const triadSymbol = ctx.triadSymbol || "";
  const seventhSymbol = ctx.seventhSymbol || "";
  const rootDisplay = normalizePcForKey(ctx.root, ctx.pad);

  switch (lower) {
    case "sus2":
    case "sus4":
      return `${rootDisplay}${lower}`;
    case "triad":
    case "add2":
    case "add9":
    case "6":
      return triadSymbol;
    case "7":
      return seventhSymbol || (triadSymbol ? `${triadSymbol}7` : "");
    case "9":
    case "11":
    case "13":
      if (seventhSymbol) {
        return `${seventhSymbol}(${voicing})`;
      }
      if (triadSymbol) {
        return `${triadSymbol}${voicing}`;
      }
      return `${rootDisplay}${voicing}`;
    default:
      return triadSymbol;
  }
}

function buildBasePitchClassInfo(ctx) {
  const { triadSymbol, seventhSymbol, voicing, pad, root } = ctx;
  const candidates = [];
  const primarySymbolGuess = symbolForNoteStack(ctx);
  if (primarySymbolGuess) candidates.push(primarySymbolGuess);
  if (seventhSymbol && !candidates.includes(seventhSymbol)) {
    candidates.push(seventhSymbol);
  }
  if (triadSymbol && !candidates.includes(triadSymbol)) {
    candidates.push(triadSymbol);
  }

  let symbolUsed = "";
  let primaryInfo = null;
  let noteSource = [];

  for (const sym of candidates) {
    if (!sym) continue;
    const info = Chord.get(sym);
    if (info?.notes?.length) {
      primaryInfo = info;
      symbolUsed = sym;
      noteSource = info.notes;
      break;
    }
  }

  if (!noteSource.length && triadSymbol) {
    const triadInfo = Chord.get(triadSymbol);
    if (triadInfo?.notes?.length) {
      primaryInfo = triadInfo;
      symbolUsed = triadSymbol;
      noteSource = triadInfo.notes;
    }
  }

  const rootSource = primaryInfo?.tonic || noteSource[0] || root;
  const rootName = rootSource
    ? normalizePcForKey(Note.pitchClass(rootSource), pad)
    : normalizePcForKey(root, pad);
  const rootNum = pcNumberFromName(rootName);
  let baseStack = dedupePitchClasses(
    noteSource.map((note) => pcNumberFromName(note)).filter((n) => n != null)
  );
  if (!baseStack.length && rootNum != null) {
    baseStack = [normalizeNumber(rootNum)];
  }

  if ((voicing === "sus2" || voicing === "sus4") && rootNum != null) {
    const secondNum = pcNumberFromName(Note.transpose(rootName, "2M"));
    const fourthNum = pcNumberFromName(Note.transpose(rootName, "4P"));
    const fifthNum = pcNumberFromName(Note.transpose(rootName, "5P"));
    const required =
      voicing === "sus2"
        ? [rootNum, secondNum, fifthNum]
        : [rootNum, fourthNum, fifthNum];
    baseStack = dedupePitchClasses(required);
  }

  if (voicing === "add2" && rootNum != null) {
    const secondNum = pcNumberFromName(Note.transpose(rootName, "2M"));
    if (secondNum != null) {
      const filtered = baseStack.filter(
        (pc) =>
          pc !== normalizeNumber(rootNum) && pc !== normalizeNumber(secondNum)
      );
      baseStack = [
        normalizeNumber(rootNum),
        normalizeNumber(secondNum),
        ...filtered,
      ];
    }
  }

  return {
    baseStack,
    rootNum: rootNum != null ? normalizeNumber(rootNum) : null,
    rootName,
    symbol: symbolUsed,
  };
}

function buildChordPitchClassStack(ctx) {
  const baseInfo = buildBasePitchClassInfo(ctx);
  const baseNums = baseInfo.baseStack;
  const baseNames = baseNums.map((num) =>
    canonicalPcFromNumber(num, ctx.preferFlats)
  );
  const intervals = extensionIntervalsForVoicing(ctx.voicing);
  const tensionNames = [];
  const seen = new Set(baseNums.map((n) => normalizeNumber(n)));
  const rootName = baseInfo.rootName
    ? canonicalizePc(baseInfo.rootName, ctx.preferFlats)
    : null;
  if (intervals.length && rootName) {
    for (const interval of intervals) {
      const noteName = Note.transpose(rootName, interval);
      const num = normalizeNumber(pcNumberFromName(noteName));
      if (num == null || seen.has(num)) continue;
      seen.add(num);
      tensionNames.push(canonicalPcFromNumber(num, ctx.preferFlats));
    }
  }
  return {
    baseNums,
    baseNames,
    tensionNames,
    rootNum: baseInfo.rootNum,
    rootName,
    symbol: baseInfo.symbol,
  };
}

function resolveChordKind(triadInfo, seventhInfo) {
  const triadQuality = (triadInfo?.quality || "").toLowerCase();
  const seventhType = (seventhInfo?.type || "").toLowerCase();
  if (seventhType.includes("dominant")) return "dominant";
  if (seventhType.includes("half-diminished")) return "half-diminished";
  if (seventhType.includes("diminished")) return "diminished";
  if (seventhType.includes("augmented")) return "augmented";
  if (seventhType.includes("minor")) return "minor";
  if (seventhType.includes("major")) return "major";
  if (triadQuality.includes("diminished")) return "diminished";
  if (triadQuality.includes("augmented")) return "augmented";
  if (triadQuality.includes("minor")) return "minor";
  return "major";
}

export function getPadChordMetadata(pad) {
  const ctx = buildChordContext(pad);
  if (!ctx) return null;
  const baseInfo = buildBasePitchClassInfo(ctx);
  const triadInfo = ctx.triadSymbol ? Chord.get(ctx.triadSymbol) : null;
  const seventhInfo = ctx.seventhSymbol ? Chord.get(ctx.seventhSymbol) : null;
  const kind = resolveChordKind(triadInfo, seventhInfo);
  const fullStack = computeChordNotesFor(ctx.pad, ctx) || [];
  return {
    kind,
    triadSymbol: ctx.triadSymbol,
    seventhSymbol: ctx.seventhSymbol,
    baseNoteCount: baseInfo.baseStack.length,
    fullNoteCount: fullStack.length,
    preferFlats: ctx.preferFlats,
  };
}

export function chordDisplayForPad(pad) {
  const ctx = buildChordContext(pad);
  if (!ctx) return "";
  const {
    voicing,
    triadSymbol,
    seventhSymbol,
    root,
    pad: normalized,
    inversion,
  } = ctx;
  const stack = buildChordPitchClassStack(ctx);
  const symbolUsed = stack.symbol || "";
  const rootDisplay = normalizePcForKey(root, normalized);

  let label = "";
  if (voicing === "sus2" || voicing === "sus4") {
    label = prettifyChordSymbol(symbolUsed || `${rootDisplay}${voicing}`);
  } else if (voicing === "triad") {
    label = prettifyChordSymbol(symbolUsed || triadSymbol);
  } else if (voicing === "add2" || voicing === "add9") {
    label = prettifyChordSymbol(`${triadSymbol}(${voicing})`);
  } else if (voicing === "6") {
    label = prettifyChordSymbol(symbolUsed || `${triadSymbol}6`);
  } else if (voicing === "7") {
    const base = symbolUsed || seventhSymbol || `${triadSymbol}7`;
    label = prettifyChordSymbol(base);
  } else if (["9", "11", "13"].includes(String(voicing))) {
    const base = seventhSymbol || (triadSymbol ? `${triadSymbol}7` : "");
    if (base) {
      label = prettifyChordSymbol(`${base}(${voicing})`);
    } else {
      label = prettifyChordSymbol(`${rootDisplay}${voicing}`);
    }
  } else {
    label = prettifyChordSymbol(symbolUsed || triadSymbol);
  }

  // Add bass note for non-root inversions
  const invIdx = inversionIndex(inversion);
  if (invIdx > 0 && stack.baseNames && stack.baseNames.length) {
    const bassPc = stack.baseNames[invIdx % stack.baseNames.length];
    const bassNote = canonicalPcFromNumber(
      pcNumberFromName(bassPc),
      ctx.preferFlats
    );
    if (bassNote && !label.endsWith(`/${bassNote}`)) {
      label = `${label}/${bassNote}`;
    }
  }
  return label;
}

function degreeIndexInternal(deg, type) {
  const list = type === "minor" ? MINOR_DEGREES : MAJOR_DEGREES;
  return list.indexOf(deg);
}

export function degreeIndex(deg, type) {
  return degreeIndexInternal(deg, type);
}

export function computeChordNotesFor(pad, contextOpt) {
  const ctx = contextOpt || buildChordContext(pad);
  if (!ctx) return [];
  const stack = buildChordPitchClassStack(ctx);
  if (!stack.baseNames.length) return [];
  return [...stack.baseNames, ...stack.tensionNames];
}

export function computeBaseChordNotesFor(pad) {
  const ctx = buildChordContext(pad);
  if (!ctx) return [];
  const stack = buildChordPitchClassStack(ctx);
  return [...stack.baseNames];
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
  const list = Array.isArray(pcs) ? pcs : [];
  if (!list.length) return [];

  const sanitizeCandidate = (pc, octave, hasOct) => {
    let candidate = hasOct ? pc : `${pc}${octave}`;
    let midi = Note.midi(candidate);
    if (midi == null) {
      const norm = pc.replace("♭", "b").replace("♯", "#");
      candidate = hasOct ? pc : `${norm}${octave}`;
      midi = Note.midi(candidate);
    }
    return { candidate, midi };
  };

  let lastMidi = -Infinity;
  let currentOct = baseOct;
  const result = [];
  for (const pc of list) {
    const hasOct = /[0-9]$/.test(pc);
    let octave = hasOct ? null : currentOct;
    let { candidate, midi } = sanitizeCandidate(pc, octave ?? baseOct, hasOct);
    while (midi != null && midi <= lastMidi) {
      const m = candidate.match(/^(.*?)(-?\d+)$/);
      if (m) {
        const nextOct = Number(m[2]) + 1;
        candidate = `${m[1]}${nextOct}`;
        midi = Note.midi(candidate);
      } else if (!hasOct) {
        octave = (octave ?? baseOct) + 1;
        ({ candidate, midi } = sanitizeCandidate(pc, octave, hasOct));
      } else {
        break;
      }
    }
    const m2 = candidate.match(/^(.*?)(-?\d+)$/);
    if (m2 && !hasOct) {
      currentOct = Number(m2[2]);
    }
    if (midi != null) lastMidi = midi;
    result.push(candidate);
  }
  return result;
}

// Compute ordered pitch classes for a pad's chord using a global, consistent rule
export function computeOrderedChordPcs(pad) {
  const ctx = buildChordContext(pad);
  if (!ctx) return [];
  const stack = buildChordPitchClassStack(ctx);
  const base = stack.baseNames;
  if (!base.length) return [];
  const invIdx = inversionIndex(ctx.inversion);
  const inv = base.length ? invIdx % base.length : 0;
  return orderChordPcsFromStack(stack, inv);
}

function raiseNoteOctave(note, steps = 1) {
  if (!note || !steps) return note;
  const m = String(note).match(/^(.*?)(-?\d+)$/);
  if (!m) return note;
  const head = m[1];
  const oct = Number(m[2]);
  if (!Number.isFinite(oct)) return note;
  return `${head}${oct + steps}`;
}

function orderChordPcsFromStack(stack, inv) {
  const base = stack.baseNames || [];
  const tensions = stack.tensionNames || [];
  if (!base.length) return [];
  const rotation = base.length ? inv % base.length : 0;
  const rotatedBase = rotation
    ? base.slice(rotation).concat(base.slice(0, rotation))
    : [...base];
  return [...rotatedBase, ...tensions];
}

export function computeVoicingNotes(pad, baseOct = 4) {
  const ctx = buildChordContext(pad);
  if (!ctx) return [];
  const stack = buildChordPitchClassStack(ctx);
  const baseLen = stack.baseNames.length;
  if (!baseLen) return [];
  const invIdx = inversionIndex(ctx.inversion);
  const inv = invIdx;
  let ordered = orderChordPcsFromStack(stack, 0);
  // Build initial voicing with explicit octaves
  let notes = toAscendingWithOctave(ordered, baseOct);
  // For each inversion, move the lowest note by pitch up one octave, keep rest in order, append moved note at end
  for (let i = 0; i < inv; i++) {
    if (notes.length) {
      // Find the lowest note by pitch
      let minIdx = 0;
      let minMidi = Note.midi(notes[0]);
      for (let j = 1; j < notes.length; j++) {
        const midi = Note.midi(notes[j]);
        if (midi < minMidi) {
          minMidi = midi;
          minIdx = j;
        }
      }
      // Remove the lowest note, move it up one octave, and append at the end
      const movedNote = notes.splice(minIdx, 1)[0];
      const m = movedNote.match(/^(.*?)(-?\d+)$/);
      if (m) {
        const head = m[1];
        const oct = Number(m[2]);
        const newNote = `${head}${oct + 1}`;
        notes.push(newNote);
      }
    }
  }
  return notes;
}
