<template>
  <div class="pads">
    <div class="pad" v-for="(pad, idx) in pads" :key="idx">
      <button
        class="pad-play"
        :disabled="
          !permissionAllowed ||
          !midiEnabled ||
          pad?.mode === 'unassigned' ||
          pad?.assigned === false
        "
        @pointerdown.prevent.stop="onStart(idx, $event)"
        @pointerup.prevent.stop="onStop(idx, $event)"
        @pointerleave.prevent.stop="onStop(idx, $event)"
        @pointercancel.prevent.stop="onStop(idx, $event)"
        @contextmenu.prevent
      >
        <span
          :class="{
            'preserve-case': !(
              pad?.mode === 'unassigned' || pad?.assigned === false
            ),
          }"
          v-html="
            pad?.mode === 'unassigned' || pad?.assigned === false
              ? 'Unassigned'
              : padButtonLabelHtml(pad)
          "
        ></span>
      </button>
      <div class="pad-buttons">
        <button
          class="pad-edit"
          @click="$emit('edit', idx)"
          :disabled="!permissionAllowed || !midiEnabled"
        >
          Edit
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  pads: { type: Array, required: true },
  permissionAllowed: { type: Boolean, default: false },
  midiEnabled: { type: Boolean, default: false },
  padButtonLabelHtml: { type: Function, required: true },
});

const emit = defineEmits(["start-pad", "stop-pad", "edit"]);

function onStart(idx, e) {
  emit("start-pad", idx, e);
}
function onStop(idx, e) {
  emit("stop-pad", idx, e);
}
</script>
