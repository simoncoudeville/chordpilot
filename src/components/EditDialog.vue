<template>
  <dialog ref="dlg" @click.self="onClose" @cancel.prevent="onClose">
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <!--<h2 class="dialog-title">Edit Pad {{ padIndex + 1 }}</h2>-->
        <div class="toggle-buttons">
          <label class="toggle-button"
            ><input
              class="toggle-button-input sr-only"
              type="radio"
              name="mode-chooser"
              v-model="model.mode"
              value="scale"
            /><span class="toggle-button-text">Scale mode</span>
          </label>
          <label class="toggle-button"
            ><input
              class="toggle-button-input sr-only"
              type="radio"
              name="mode-chooser"
              v-model="model.mode"
              value="free"
            /><span class="toggle-button-text">Free mode</span>
          </label>
        </div>
        <button
          type="button"
          class="dialog-close"
          @click="onClose"
          aria-label="Close"
        >
          <X
            class="dialog-close-icon"
            aria-hidden="true"
            :size="14"
            stroke-width="2"
          />

          <span class="sr-only">Close</span>
        </button>
      </div>
      <template v-if="model.mode === 'scale'">
        <div class="dialog-content">
          <p class="global-scale-info color-scale">
            <Music3
              aria-hidden="true"
              :size="14"
              stroke-width="2"
              fill="currentColor"
            />

            Global scale: <span>{{ globalScale }}</span>
            {{ globalScaleType }}
          </p>
        </div>
      </template>
      <div class="dialog-content edit-grid">
        <template v-if="model.mode !== 'scale'">
          <label>
            <span class="label-text">Root</span>
            <CustomSelect
              v-model="model.freeRoot"
              :options="MAJOR_KEY_OPTIONS"
              option-value-key="value"
              option-label-key="label"
              wrapper-class="select-scale"
            />
          </label>
        </template>
        <template v-if="model.mode !== 'scale'">
          <label>
            <span class="label-text">Type</span>
            <CustomSelect
              v-model="scaleTypeProxy"
              :options="['major', 'minor']"
            />
          </label>
        </template>
        <template v-if="model.mode === 'scale'">
          <label class="flex-grow-1">
            <span class="label-text">Chord</span>
            <CustomSelect v-model="model.degree" wrapper-class="select-chord">
              <template #options>
                <option
                  v-for="ch in editChordOptions"
                  :key="ch.degree"
                  :value="ch.degree"
                >
                  {{ ch.degree }} — {{ ch.display }}
                </option>
              </template>
            </CustomSelect>
          </label>
        </template>
        <label class="flex-grow-1">
          <span class="label-text">Extension</span>
          <CustomSelect v-model="voicingProxy" :options="extensionOptions" />
        </label>
        <label class="flex-grow-1">
          <span class="label-text">Inversion</span>
          <CustomSelect v-model="inversionProxy" :options="editInversions" />
        </label>
        <label class="flex-grow-1">
          <span class="label-text">Register</span>
          <CustomSelect
            v-model="octaveProxy"
            :options="[2, 3, 4, 5, 6]"
            :cast-number="true"
          />
        </label>
      </div>
      <div class="dialog-content chord-preview">
        <div class="chord-preview-notes">
          notes: <span>{{ previewNotesHtml }}</span>
        </div>
        <button
          type="button"
          class="button large preview"
          :disabled="!permissionAllowed || !midiEnabled || !hasChordForPreview"
          @pointerdown.prevent.stop="$emit('preview-start', $event)"
          @pointerup.prevent.stop="$emit('preview-stop', $event)"
          @pointerleave.prevent.stop="$emit('preview-stop', $event)"
          @pointercancel.prevent.stop="$emit('preview-stop', $event)"
          @contextmenu.prevent
        >
          Preview
        </button>
      </div>
      <div class="dialog-buttons">
        <button type="button" @click="onClose">Cancel</button>
        <button type="button" @click="$emit('save')" :disabled="!isEditDirty">
          Save
        </button>
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { ref, computed, toRef } from "vue";
import { X } from "lucide-vue-next";
import { Music3 } from "lucide-vue-next";
import CustomSelect from "./CustomSelect.vue";
import {
  computeChordNotesFor,
  inversionIndex,
  rotate,
  toAscendingWithOctave,
  chordDisplayForPad,
  toDisplayNotesForPad,
  normalizePcForKey,
} from "../composables/theory";

const props = defineProps({
  padIndex: { type: Number, default: 0 },
  modelValue: { type: Object, required: true }, // editModel object
  editScaleTypeModel: { type: String, required: true },
  editVoicingModel: { type: String, required: true },
  editInversionModel: { type: String, required: true },
  editOctaveModel: { type: Number, required: true },
  editChordOptions: { type: Array, default: () => [] },
  editInversions: { type: Array, default: () => [] },
  MAJOR_KEY_OPTIONS: { type: Array, default: () => [] },
  globalScale: { type: String, default: "" },
  globalScaleType: { type: String, default: "" },
  permissionAllowed: { type: Boolean, default: false },
  midiEnabled: { type: Boolean, default: false },
  isEditDirty: { type: Boolean, default: false },
});

const emit = defineEmits([
  "update:modelValue",
  "update:editScaleTypeModel",
  "update:editVoicingModel",
  "update:editInversionModel",
  "update:editOctaveModel",
  "save",
  "close",
  "preview-start",
  "preview-stop",
]);
const SUPPORTED_VOICINGS = [
  "triad",
  "add2",
  "add9",
  "6",
  "7",
  "9",
  "11",
  "13",
  "sus2",
  "sus4",
];
function allowedVoicingsForChord(chordType) {
  const t = String(chordType || "").toLowerCase();
  let list = ["triad"];
  if (t === "major" || t === "minor") {
    list = ["triad", "add2", "add9", "6", "7", "9", "11", "13", "sus2", "sus4"];
  } else if (t === "dominant") {
    list = ["7", "9", "11", "13", "7sus4", "7alt"];
  } else if (t === "diminished") {
    list = ["triad", "7"];
  } else if (t === "augmented") {
    list = ["triad", "add9", "maj7"];
  } else {
    list = ["triad"];
  }
  return list.filter((v) => SUPPORTED_VOICINGS.includes(v));
}
const extensionOptions = computed(() =>
  allowedVoicingsForChord(scaleTypeProxy.value)
);

const dlg = ref(null);

const model = toRef(props, "modelValue");
const scaleTypeProxy = computed({
  get: () => props.editScaleTypeModel,
  set: (v) => emit("update:editScaleTypeModel", v),
});
const voicingProxy = computed({
  get: () => props.editVoicingModel,
  set: (v) => emit("update:editVoicingModel", v),
});
const inversionProxy = computed({
  get: () => props.editInversionModel,
  set: (v) => emit("update:editInversionModel", v),
});
const octaveProxy = computed({
  get: () => props.editOctaveModel,
  set: (v) => emit("update:editOctaveModel", v),
});

function open() {
  dlg.value?.showModal();
}
function close() {
  dlg.value?.close();
}

function onClose() {
  emit("preview-stop");
  emit("close");
}

defineExpose({ open, close, dlg });

const hasChordForPreview = computed(() => true);

// --- Preview chord name + notes (mirrors App logic) ---
const padLikeForPreview = computed(() => {
  const m = model.value;
  return {
    ...m,
    // Always use global key for scale mode
    scale: props.globalScale,
    scaleTypeScale: props.globalScaleType,
    // Use current edit proxies for mode-specific values
    voicingFree: voicingProxy.value,
    voicingScale: voicingProxy.value,
    scaleTypeFree: scaleTypeProxy.value,
    inversionFree: inversionProxy.value,
    inversionScale: inversionProxy.value,
    octaveFree: octaveProxy.value,
    octaveScale: octaveProxy.value,
  };
});

const previewSymbol = computed(() =>
  chordDisplayForPad(padLikeForPreview.value)
);
const previewNotesAsc = computed(() => {
  const raw = computeChordNotesFor(padLikeForPreview.value);
  const invIdx = inversionIndex(
    padLikeForPreview.value.mode === "free"
      ? padLikeForPreview.value.inversionFree
      : padLikeForPreview.value.inversionScale
  );
  const ordered = rotate(raw, invIdx);
  const baseOct = Number(
    (padLikeForPreview.value.mode === "free"
      ? padLikeForPreview.value.octaveFree
      : padLikeForPreview.value.octaveScale) ?? 4
  );
  return toAscendingWithOctave(ordered, baseOct);
});

const previewSymbolWithBass = computed(() => {
  const padLike = padLikeForPreview.value;
  const sym = previewSymbol.value;
  const bassPc = normalizePcForKey(
    (previewNotesAsc.value[0] || "").replace(/\d+$/, ""),
    padLike
  );
  const rootPc = normalizePcForKey(
    (computeChordNotesFor(padLike)[0] || "").replace(/\d+$/, ""),
    padLike
  );
  return bassPc && rootPc && bassPc !== rootPc ? `${sym}/${bassPc}` : sym;
});

const previewChordHtml = computed(() => previewSymbolWithBass.value);
const previewNotesHtml = computed(() => {
  const padLike = padLikeForPreview.value;
  const notes = toDisplayNotesForPad(previewNotesAsc.value, padLike);
  return notes.join(" ");
});
</script>
