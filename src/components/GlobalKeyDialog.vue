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
          <svg
            class="dialog-close-icon"
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13.5 4.5L4.5 13.5"
              stroke-width="1.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M4.5 4.5L13.5 13.5"
              stroke-width="1.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>

          <span class="sr-only">Close</span>
        </button>
      </div>

      <div class="dialog-content edit-grid">
        <label
          >Scale
          <select v-model="scaleLocal" class="select-scale">
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
        <p
          v-if="isDirty && scalePadCount > 0"
          class="grid-span-2 color-warning"
        >
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
