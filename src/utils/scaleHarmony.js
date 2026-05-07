import { Note } from "@tonaljs/tonal";

export function semitoneDistance(pcFrom, pcTo) {
  const base = Note.midi(`${pcFrom}4`) ?? 60;
  let target = Note.midi(`${pcTo}4`) ?? base;
  while (target < base) target += 12;
  return (target - base) % 12;
}

export function qualityFromTriad(triad, rootPc) {
  const [r, t, f] = triad;
  if (!r || !t || !f) return "";
  const third = semitoneDistance(rootPc, t);
  const fifth = semitoneDistance(rootPc, f);
  if (third === 3 && fifth === 6) return "dim";
  if (third === 4 && fifth === 8) return "aug";
  if (third === 3 && fifth === 7) return "m";
  if (third === 4 && fifth === 7) return "";
  return "";
}

export function qualityForScaleDegree(scaleNotes, index) {
  const s = Array.isArray(scaleNotes) ? scaleNotes : [];
  if (s.length < 3) return "";
  const i = index % s.length;
  const triad = [s[i], s[(i + 2) % s.length], s[(i + 4) % s.length]];
  return qualityFromTriad(triad, s[i]);
}
