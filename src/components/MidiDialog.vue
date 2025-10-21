<template>
  <dialog ref="dlg">
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title">MIDI Settings</h2>
        <button
          type="button"
          class="dialog-close"
          @click="onClose"
          aria-label="Close"
        >
          <span aria-hidden="true">&times;</span>
          <span class="sr-only">Close</span>
        </button>
      </div>
      <div class="dialog-content">
        <span class="midi-status-message">{{ statusDisplay }}</span>
        <!--<button type="button" @click="$emit('rescan')" :disabled="!midiEnabled">Rescan</button>-->
      </div>
      <div class="dialog-content edit-grid">
        <label
          >Output Port
          <select v-model="outputIdProxy">
            <option
              v-for="output in outputs"
              :key="output.id"
              :value="output.id"
            >
              {{ output.name }}
            </option>
          </select>
        </label>
        <label
          >Channel
          <select v-model.number="outChProxy">
            <option v-for="ch in 16" :key="ch" :value="ch">{{ ch }}</option>
          </select>
        </label>
      </div>
      <div class="dialog-buttons">
        <button type="button" @click="onClose">Close</button>
        <button type="button" @click="$emit('save')" :disabled="!isMidiDirty">
          Save
        </button>
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  midiEnabled: { type: Boolean, default: false },
  outputs: { type: Array, default: () => [] },
  midiModelOutputId: { type: String, default: "" },
  midiModelOutCh: { type: Number, default: 1 },
  statusDisplay: { type: String, default: "" },
  isMidiDirty: { type: Boolean, default: false },
});

const emit = defineEmits([
  "update:midiModelOutputId",
  "update:midiModelOutCh",
  "save",
  "close",
  "rescan",
]);

const dlg = ref(null);

const outputIdProxy = computed({
  get: () => props.midiModelOutputId,
  set: (val) => emit("update:midiModelOutputId", val),
});
const outChProxy = computed({
  get: () => props.midiModelOutCh,
  set: (val) => emit("update:midiModelOutCh", val),
});

function open() {
  dlg.value?.showModal();
}
function close() {
  dlg.value?.close();
}

function onClose() {
  emit("close");
}

defineExpose({ open, close, dlg });
</script>
