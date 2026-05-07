<template>
  <div class="top detail-top">
    <button
      class="icon-button"
      type="button"
      @click="$emit('back')"
      aria-label="Back to boards"
    >
      <ArrowLeft
        aria-hidden="true"
        :stroke-width="1.5"
        :size="20"
        :absoluteStrokeWidth="true"
      />
    </button>
    <h2 class="board-title">{{ boardName }}</h2>
    <button
      class="icon-button"
      type="button"
      @click="openGlobalKeyDialog"
      aria-label="Board scale settings"
    >
      <Music2
        aria-hidden="true"
        :stroke-width="1.5"
        :size="20"
        :absoluteStrokeWidth="true"
      />
    </button>
  </div>
  <PadGrid
    :pads="pads"
    :permission-allowed="permissionAllowed"
    :midi-enabled="midiEnabled"
    :pad-button-label-html="padButtonLabelHtml"
    :pad-note-label="padNoteLabel"
    @start-pad="(idx, e, coords) => $emit('start-pad', idx, e, coords)"
    @stop-pad="(idx) => $emit('stop-pad', idx)"
    @update-pad="(idx, coords) => $emit('update-pad', idx, coords)"
    @delete="(idx) => $emit('delete', idx)"
    @edit="(idx) => $emit('edit', idx)"
  />
  <div class="bottom">
    <KeyboardExtended
      :highlighted-notes="highlightedNotes"
      :note-velocity-map="noteVelocityMap"
    />
  </div>

  <EditDialog
    ref="editDialogRef"
    :pad-index="padIndex"
    :pad-state="pads[padIndex]"
    :global-scale-root="globalScaleRoot"
    :global-scale-display="globalScaleDisplay"
    :global-scale-type="globalScaleType"
    :global-scale-enabled="globalScaleEnabled"
    :permission-allowed="permissionAllowed"
    :midi-enabled="midiEnabled"
    @preview-start="$emit('preview-start', $event)"
    @preview-stop="$emit('preview-stop')"
    @save="$emit('save-edit', $event)"
    @close="$emit('close-edit')"
  />
  <GlobalKeyDialog
    ref="globalKeyDialogRef"
    :model-scale="globalScale"
    :model-type="globalScaleType"
    :model-enabled="globalScaleEnabled"
    :scale-pad-count="scalePadCount"
    @close="$emit('close-global-key')"
    @save="$emit('save-global-key', $event)"
  />
  <PadDeleteDialog
    ref="padDeleteDialogRef"
    @confirm="$emit('confirm-delete')"
    @cancel="$emit('cancel-delete')"
    @close="$emit('close-delete')"
  />
</template>

<script setup>
import { ref } from "vue";
import { ArrowLeft, Music2 } from "lucide-vue-next";
import KeyboardExtended from "./KeyboardExtended.vue";
import PadGrid from "./PadGrid.vue";
import EditDialog from "./EditDialog.vue";
import GlobalKeyDialog from "./GlobalKeyDialog.vue";
import PadDeleteDialog from "./PadDeleteDialog.vue";

const props = defineProps({
  boardName: String,
  pads: Array,
  highlightedNotes: {
    type: Array,
    default: () => [],
  },
  noteVelocityMap: {
    type: Object,
    default: () => ({}),
  },
  padIndex: Number,
  permissionAllowed: Boolean,
  midiEnabled: Boolean,
  padButtonLabelHtml: Function,
  padNoteLabel: Function,
  globalScale: String,
  globalScaleRoot: String,
  globalScaleDisplay: String,
  globalScaleType: String,
  globalScaleEnabled: Boolean,
  scalePadCount: Number,
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

const editDialogRef = ref(null);
const globalKeyDialogRef = ref(null);
const padDeleteDialogRef = ref(null);

function openEditDialog(idx) {
  editDialogRef.value?.open?.();
}

function openGlobalKeyDialog() {
  globalKeyDialogRef.value?.open?.();
}

function openPadDeleteDialog() {
  padDeleteDialogRef.value?.open?.();
}

function closeEditDialog() {
  editDialogRef.value?.close?.();
}

function closePadDeleteDialog() {
  padDeleteDialogRef.value?.close?.();
}

defineExpose({
  openEditDialog,
  openGlobalKeyDialog,
  openPadDeleteDialog,
  closeEditDialog,
  closePadDeleteDialog,
});
</script>
