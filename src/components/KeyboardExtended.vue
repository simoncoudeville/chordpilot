<template>
  <div class="keyboard keyboard-extended">
    <!--<div class="root-dot"></div>-->
    <div class="keyboard-wrapper">
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
            :style="
              isNoteActive(pc, oct) ? keyVelocityStyle(pc, oct) : undefined
            "
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
            :style="
              isNoteActive(pc, oct) ? keyVelocityStyle(pc, oct) : undefined
            "
            :data-note="pc.toUpperCase() + oct"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { Note } from "@tonaljs/tonal";
import { pcToKeyToken, normalizePcOct } from "../utils/music";

const props = defineProps({
  highlightedNotes: { type: Array, default: () => [] },
  noteVelocityMap: { type: Object, default: () => ({}) },
  startOctave: { type: Number, default: 2 },
  octaves: { type: Number, default: 8 },
});

const whitePcs = ["c", "d", "e", "f", "g", "a", "b"];
const blackPcs = ["db", "eb", "gb", "ab", "bb"];

// Normalize highlighted notes into a set of strings like 'c4','db3' and build velocity map
const highlightedData = computed(() => {
  const s = new Set();
  const velMap = {};
  for (const n of props.highlightedNotes || []) {
    if (!n) continue;
    try {
      const pc = Note.pitchClass(String(n));
      const oct = Note.octave(String(n));
      if (!pc || oct == null) continue;
      const [token, correctedOct] = normalizePcOct(pc, oct);
      if (!token || correctedOct == null) continue;
      const key = token + String(correctedOct);
      s.add(key);
      const v = props.noteVelocityMap?.[n];
      if (v != null) velMap[key] = v;
    } catch (e) {
      try {
        const info = Note.get(String(n));
        const [token, correctedOct] = normalizePcOct(info?.pc, info?.oct);
        if (token && typeof correctedOct === "number") {
          const key = token + String(correctedOct);
          s.add(key);
          const v = props.noteVelocityMap?.[n];
          if (v != null) velMap[key] = v;
        }
      } catch {
        // final fallback: ignore
      }
    }
  }
  return { set: s, velMap };
});

const octavesRange = computed(() => {
  const arr = [];
  for (let i = 0; i < props.octaves; i++) arr.push(props.startOctave + i);
  return arr;
});

function isNoteActive(pc, octave) {
  const key = (pc || "").toLowerCase() + String(octave);
  return highlightedData.value.set.has(key);
}

const MIN_VELOCITY_LIGHTNESS = 80; // lightness% at lowest velocity
const MAX_VELOCITY_LIGHTNESS = 100; // lightness% at full velocity

function keyVelocityStyle(pc, octave) {
  const key = (pc || "").toLowerCase() + String(octave);
  const vel = highlightedData.value.velMap[key];
  if (vel == null) return undefined;
  const range = MAX_VELOCITY_LIGHTNESS - MIN_VELOCITY_LIGHTNESS;
  const lightness = Math.round(
    MIN_VELOCITY_LIGHTNESS + Math.max(0, Math.min(1, vel)) * range,
  );
  return { "--key-velocity": lightness + "%" };
}
</script>
