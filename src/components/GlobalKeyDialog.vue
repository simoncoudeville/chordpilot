<template>
  <dialog
    class="dialog-bottom"
    ref="dlg"
    @click.self="onClose"
    @cancel.prevent="onClose"
  >
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title">Music Settings</h2>
        <button
          type="button"
          class="dialog-close"
          @click="onClose"
          aria-label="Close"
        >
          <X
            class="dialog-close-icon"
            aria-hidden="true"
            :stroke-width="1.5"
            :size="16"
            :absoluteStrokeWidth="true"
          />
          <span class="sr-only">Close</span>
        </button>
      </div>
      <div class="dialog-content">
        <h3 class="section-title">Global Scale</h3>
      </div>
      <div class="dialog-content">
        <label class="toggle-label">
          <span class="label-text">Enable Global Scale</span>
          <input
            class="checkbox-hidden"
            type="checkbox"
            v-model="enabledLocal"
          />
          <span class="checkbox-toggle"> </span>
        </label>
        <p class="toggle-label-description color-meta">
          Turning on global scale adds a scale-based chord option to all pads
        </p>
      </div>
      <!-- <div class="dialog-content">
        <p class="color-meta" v-if="enabledLocal">
          Global scale is enabled. Set the global scale for all pads in Scale
          mode.
        </p>
        <p class="color-meta" v-else>
          Global scale is disabled. All pads will use Free mode.
        </p>
      </div> -->
      <div class="dialog-content edit-grid">
        <label class="flex-grow-1">
          <span class="label-text">Root</span>
          <CustomSelect
            v-model="scaleLocal"
            :options="scaleRoots"
            option-value-key="value"
            option-label-key="label"
            wrapper-class="select-scale"
            :disabled="!enabledLocal"
          />
        </label>
        <label class="flex-grow-2">
          <span class="label-text">Type</span>
          <CustomSelect
            v-model="typeLocal"
            :options="scaleTypes"
            option-value-key="value"
            option-label-key="label"
            :disabled="!enabledLocal"
          />
        </label>
      </div>
      <div class="dialog-content">
        <hr />
      </div>
      <div class="dialog-content">
        <h3 class="section-title">Tempo</h3>
        <div class="tempo-controls">
          <div class="tempo-slider-group">
            <label class="label-text">BPM</label>
            <input
              type="range"
              min="20"
              max="300"
              v-model.number="tempoLocal"
              :disabled="tempoMidiSyncLocal"
              class="tempo-slider"
            />
            <div class="tempo-display">
              {{ tempoLocal }}
            </div>
          </div>
          <label class="checkbox-label">
            <input
              type="checkbox"
              v-model="tempoMidiSyncLocal"
              :disabled="!midiEnabled"
              class="checkbox-input"
            />
            <span>Sync from MIDI clock</span>
          </label>
          <p v-if="!midiEnabled" class="color-meta tempo-hint">
            Enable MIDI to sync tempo from MIDI clock
          </p>
        </div>
      </div>
      <div
        v-if="isScaleDirty && scalePadCount > 0 && enabledLocal"
        class="dialog-content color-warning"
      >
        Changing the global scale will reset
        {{ scalePadCount }} {{ scalePadCount === 1 ? "pad" : "pads" }}
        currently in Scale mode.
      </div>
      <div
        v-if="isScaleDirty && scalePadCount > 0 && !enabledLocal && modelEnabled"
        class="dialog-content color-warning"
      >
        Disabling global scale will convert
        {{ scalePadCount }} {{ scalePadCount === 1 ? "pad" : "pads" }}
        to Free mode.
      </div>
      <div class="dialog-buttons">
        <button class="button" type="button" @click="onClose">Cancel</button>
        <button
          class="button primary"
          type="button"
          @click="onSave"
          :disabled="!isDirty"
        >
          Save
        </button>
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { ref, computed } from "vue";
import { X } from "lucide-vue-next";
import CustomSelect from "./CustomSelect.vue";

const props = defineProps({
  modelScale: { type: String, default: "" },
  modelType: { type: String, default: "" },
  modelEnabled: { type: Boolean, default: true },
  modelTempo: { type: Number, default: 120 },
  modelTempoMidiSync: { type: Boolean, default: false },
  midiEnabled: { type: Boolean, default: false },
  scalePadCount: { type: Number, default: 0 },
});
const emit = defineEmits(["save", "close"]);

const dlg = ref(null);
// Local, confirm-on-save state
const scaleLocal = ref(props.modelScale);
const typeLocal = ref(props.modelType);
const enabledLocal = ref(props.modelEnabled);
const tempoLocal = ref(props.modelTempo);
const tempoMidiSyncLocal = ref(props.modelTempoMidiSync);

// Scale options: display both sharp and flat names for black keys
const scaleRoots = computed(() => [
  { value: "C", label: "C" },
  { value: "Db", label: "C#/Db" },
  { value: "D", label: "D" },
  { value: "Eb", label: "D#/Eb" },
  { value: "E", label: "E" },
  { value: "F", label: "F" },
  { value: "Gb", label: "F#/Gb" },
  { value: "G", label: "G" },
  { value: "Ab", label: "G#/Ab" },
  { value: "A", label: "A" },
  { value: "Bb", label: "A#/Bb" },
  { value: "B", label: "B" },
]);

const usefulScaleTypes = [
  "major",
  "minor",
  "dorian",
  "mixolydian",
  "lydian",
  "phrygian",
  "harmonic minor",
];

const scaleTypes = computed(() =>
  usefulScaleTypes.map((name) => ({
    value: name,
    label: name.replace(/-/g, " "),
  }))
);

const isDirty = computed(
  () =>
    scaleLocal.value !== props.modelScale ||
    typeLocal.value !== props.modelType ||
    enabledLocal.value !== props.modelEnabled ||
    tempoLocal.value !== props.modelTempo ||
    tempoMidiSyncLocal.value !== props.modelTempoMidiSync
);

const isScaleDirty = computed(
  () =>
    scaleLocal.value !== props.modelScale ||
    typeLocal.value !== props.modelType ||
    enabledLocal.value !== props.modelEnabled
);

function open() {
  // Seed locals from current props on each open
  scaleLocal.value = props.modelScale;
  typeLocal.value = props.modelType;
  enabledLocal.value = props.modelEnabled;
  tempoLocal.value = props.modelTempo;
  tempoMidiSyncLocal.value = props.modelTempoMidiSync;
  dlg.value?.showModal();
}
function close() {
  dlg.value?.close();
}
function onClose() {
  emit("close");
  close();
}

function onSave() {
  emit("save", {
    scale: scaleLocal.value,
    type: typeLocal.value,
    enabled: enabledLocal.value,
    tempo: tempoLocal.value,
    tempoMidiSync: tempoMidiSyncLocal.value,
  });
  close();
}

defineExpose({ open });
</script>

<style scoped>
.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
  color: rgba(255, 255, 255, 0.7);
}

.tempo-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tempo-slider-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tempo-slider {
  width: 100%;
  height: 0.5rem;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 0.25rem;
  outline: none;
  cursor: pointer;
}

.tempo-slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tempo-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 1rem;
  height: 1rem;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  cursor: pointer;
}

.tempo-slider::-moz-range-thumb {
  width: 1rem;
  height: 1rem;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  border: none;
  cursor: pointer;
}

.tempo-slider:disabled::-webkit-slider-thumb {
  cursor: not-allowed;
}

.tempo-slider:disabled::-moz-range-thumb {
  cursor: not-allowed;
}

.tempo-slider:not(:disabled):hover::-webkit-slider-thumb {
  background: rgba(255, 255, 255, 1);
}

.tempo-slider:not(:disabled):hover::-moz-range-thumb {
  background: rgba(255, 255, 255, 1);
}

.tempo-display {
  text-align: center;
  font-family: monospace;
  font-size: 1.25rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  cursor: pointer;
  width: 1rem;
  height: 1rem;
}

.checkbox-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tempo-hint {
  font-size: 0.875rem;
  margin: 0;
}
</style>
