<template>
  <div class="keyboard keyboard-extended">
    <div class="keyboard-octaves">
      <div v-for="oct in octavesRange" :key="oct" class="keyboard-octave">
        <div
          v-for="pc in whitePcs"
          :key="pc + oct"
          :class="[
            'key',
            `key-${pc}`,
            'key-white',
            isNoteActive(pc, oct) ? 'key-played' : '',
          ]"
          :data-note="pc.toUpperCase() + oct"
        ></div>
        <div
          v-for="pc in blackPcs"
          :key="pc + oct"
          :class="[
            'key',
            `key-${pc}`,
            'key-black',
            isNoteActive(pc, oct) ? 'key-played' : '',
          ]"
          :data-note="pc.toUpperCase() + oct"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { Note } from "@tonaljs/tonal";

const props = defineProps({
  highlightedNotes: { type: Array, default: () => [] },
  startOctave: { type: Number, default: 2 },
  octaves: { type: Number, default: 8 },
});

const whitePcs = ["c", "d", "e", "f", "g", "a", "b"];
const blackPcs = ["db", "eb", "gb", "ab", "bb"];

// Normalize highlighted notes into a set of strings like 'c4','db3'
const highlightedSet = computed(() => {
  const s = new Set();
  for (const n of props.highlightedNotes || []) {
    if (!n) continue;
    // Use Tonal to get pitch class and octave
    try {
      const pc = Note.pitchClass(String(n)); // e.g. 'C#' or 'Db'
      const oct = Note.octave(String(n));
      if (!pc || oct == null) continue;
      // Convert sharps to flats for our class names
      const pcUpper = pc.toUpperCase();
      const mapped = pcUpper.replace("#", "b");
      // But replace C#->Db etc for correct names
      const sharpToFlat = {
        "C#": "Db",
        "D#": "Eb",
        "F#": "Gb",
        "G#": "Ab",
        "A#": "Bb",
      };
      const normalized = sharpToFlat[pcUpper] || pcUpper;
      s.add(normalized.toLowerCase() + String(oct));
    } catch (e) {
      // fallback: raw string lower
      s.add(String(n).toLowerCase());
    }
  }
  return s;
});

const octavesRange = computed(() => {
  const arr = [];
  for (let i = 0; i < props.octaves; i++) arr.push(props.startOctave + i);
  return arr;
});

function isNoteActive(pc, octave) {
  const key = (pc || "").toLowerCase() + String(octave);
  return highlightedSet.value.has(key);
}
</script>
