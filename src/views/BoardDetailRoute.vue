<template>
  <BoardView
    ref="boardViewRef"
    :board-name="boardName"
    :pads="pads"
    :highlighted-notes="highlightedNotes"
    :note-velocity-map="noteVelocityMap"
    :pad-index="padIndex"
    :permission-allowed="permissionAllowed"
    :midi-enabled="midiEnabled"
    :pad-button-label-html="padButtonLabelHtml"
    :pad-note-label="padNoteLabel"
    :global-scale="globalScale"
    :global-scale-root="globalScaleRoot"
    :global-scale-display="globalScaleDisplay"
    :global-scale-type="globalScaleType"
    :global-scale-enabled="globalScaleEnabled"
    :scale-pad-count="scalePadCount"
    @back="$emit('back')"
    @start-pad="(...args) => $emit('start-pad', ...args)"
    @stop-pad="(...args) => $emit('stop-pad', ...args)"
    @update-pad="(...args) => $emit('update-pad', ...args)"
    @delete="$emit('delete', $event)"
    @edit="$emit('edit', $event)"
    @preview-start="$emit('preview-start', $event)"
    @preview-stop="$emit('preview-stop', $event)"
    @save-edit="$emit('save-edit', $event)"
    @close-edit="$emit('close-edit')"
    @close-global-key="$emit('close-global-key')"
    @save-global-key="$emit('save-global-key', $event)"
    @confirm-delete="$emit('confirm-delete')"
    @cancel-delete="$emit('cancel-delete')"
    @close-delete="$emit('close-delete')"
  />
</template>

<script setup>
import { ref } from "vue";
import BoardView from "../components/BoardView.vue";

defineProps({
  boardName: { type: String, default: "" },
  pads: { type: Array, default: () => [] },
  highlightedNotes: { type: Array, default: () => [] },
  noteVelocityMap: { type: Object, default: () => ({}) },
  padIndex: { type: Number, default: 0 },
  permissionAllowed: { type: Boolean, default: false },
  midiEnabled: { type: Boolean, default: false },
  padButtonLabelHtml: { type: Function, required: true },
  padNoteLabel: { type: Function, required: true },
  globalScale: { type: String, default: "C" },
  globalScaleRoot: { type: String, default: "C" },
  globalScaleDisplay: { type: String, default: "" },
  globalScaleType: { type: String, default: "major" },
  globalScaleEnabled: { type: Boolean, default: true },
  scalePadCount: { type: Number, default: 0 },
});

defineEmits([
  "back",
  "start-pad",
  "stop-pad",
  "update-pad",
  "delete",
  "edit",
  "preview-start",
  "preview-stop",
  "save-edit",
  "close-edit",
  "close-global-key",
  "save-global-key",
  "confirm-delete",
  "cancel-delete",
  "close-delete",
]);

const boardViewRef = ref(null);

function openEditDialog(idx) {
  boardViewRef.value?.openEditDialog(idx);
}

function closeEditDialog() {
  boardViewRef.value?.closeEditDialog();
}

function openPadDeleteDialog() {
  boardViewRef.value?.openPadDeleteDialog();
}

function closePadDeleteDialog() {
  boardViewRef.value?.closePadDeleteDialog();
}

defineExpose({
  openEditDialog,
  closeEditDialog,
  openPadDeleteDialog,
  closePadDeleteDialog,
});
</script>
