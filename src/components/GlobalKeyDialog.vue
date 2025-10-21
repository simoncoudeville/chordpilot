<template>
  <dialog ref="dlg">
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title">Global Scale</h2>
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

      <div class="dialog-content edit-grid">
        <label
          >Scale
          <select v-model="scaleLocal" class="preserve-case select-scale">
            <option
              v-for="opt in MAJOR_KEY_OPTIONS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </label>
        <label
          >Type
          <select v-model="typeLocal">
            <option value="major">major</option>
            <option value="minor">minor</option>
          </select>
        </label>
        <p v-if="isDirty && scalePadCount > 0" class="grid-span-2 warning-text">
          Changing the global scale will reset {{ scalePadCount }} pads
          currently in Scale mode.
        </p>
      </div>

      <div class="dialog-buttons">
        <button type="button" @click="onClose">Cancel</button>
        <button type="button" @click="onSave" :disabled="!isDirty">Save</button>
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  modelScale: { type: String, required: true },
  modelType: { type: String, required: true },
  MAJOR_KEY_OPTIONS: { type: Array, default: () => [] },
  scalePadCount: { type: Number, default: 0 },
});
const emit = defineEmits(["save", "close"]);

const dlg = ref(null);
// Local, confirm-on-save state
const scaleLocal = ref(props.modelScale);
const typeLocal = ref(props.modelType);

const isDirty = computed(
  () =>
    scaleLocal.value !== props.modelScale || typeLocal.value !== props.modelType
);

function open() {
  // Seed locals from current props on each open
  scaleLocal.value = props.modelScale;
  typeLocal.value = props.modelType;
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
  emit("save", { scale: scaleLocal.value, type: typeLocal.value });
  close();
}

defineExpose({ open, close, dlg });
</script>
