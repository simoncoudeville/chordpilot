<template>
  <div class="pads">
    <div class="pad" v-for="(pad, idx) in pads" :key="idx">
      <button
        class="pad-play"
        :class="{
          'pad-unassigned':
            pad?.mode === 'unassigned' || pad?.assigned === false,
        }"
        @pointerdown.prevent.stop="onStart(idx, pad, $event)"
        @pointerup.prevent.stop="onStop(idx, pad, $event)"
        @pointerleave.prevent.stop="onStop(idx, pad, $event)"
        @pointercancel.prevent.stop="onStop(idx, pad, $event)"
        @contextmenu.prevent
      >
        <span>
          {{
            pad?.mode === "unassigned" || pad?.assigned === false
              ? "Unassigned"
              : padButtonLabelHtml(pad)
          }}
        </span>
      </button>
      <div
        class="pad-buttons"
        v-if="!(pad?.mode === 'unassigned' || pad?.assigned === false)"
      >
        <button class="pad-edit" @click="$emit('edit', idx)">Edit</button>
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

function onStart(idx, pad, e) {
  if (pad?.mode === "unassigned" || pad?.assigned === false) {
    emit("edit", idx);
    return;
  }
  emit("start-pad", idx, e);
}
function onStop(idx, pad, e) {
  if (pad?.mode === "unassigned" || pad?.assigned === false) return;
  emit("stop-pad", idx, e);
}
</script>
