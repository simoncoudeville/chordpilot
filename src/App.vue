<template>
  <div class="top">
    <Keyboard
      :active-key-set="activeKeySet"
      :now-playing-html="nowPlayingHtml"
    />
    <div class="midi-status-container">
      <button
        class="button md"
        :class="midiEnabled && outputs.length > 0 ? 'valid' : 'warning'"
        type="button"
        @click="openMidiDialog"
        :disabled="!midiSupported"
        :title="!midiSupported ? 'Your browser does not support Web MIDI' : ''"
      >
        MIDI
      </button>
      <button
        class="button md icon scale"
        type="button"
        @click="openGlobalKeyDialog"
      >
        <Music2 aria-hidden="true" :size="14" stroke-width="2" />
      </button>
    </div>
  </div>

  <PadGrid
    :pads="pads"
    :permission-allowed="permissionAllowed"
    :midi-enabled="midiEnabled"
    :pad-button-label-html="padButtonLabelHtml"
    @start-pad="startPad"
    @stop-pad="stopPad"
    @edit="openEdit"
  />

  <EditDialog
    ref="editDialogRef"
    :pad-index="currentEditIndex"
    v-model:model-value="editModel"
    v-model:edit-scale-type-model="editScaleType"
    v-model:edit-voicing-model="editVoicing"
    v-model:edit-inversion-model="editInversion"
    v-model:edit-octave-model="editOctave"
    :edit-chord-options="editChordOptions"
    :edit-inversions="editInversions"
    :MAJOR_KEY_OPTIONS="MAJOR_KEY_OPTIONS"
    :global-scale="globalScale"
    :global-scale-type="globalScaleType"
    :permission-allowed="permissionAllowed"
    :midi-enabled="midiEnabled"
    :is-edit-dirty="isEditDirty"
    @save="saveEdit"
    @close="closeEdit"
    @preview-start="startPreview"
    @preview-stop="stopPreview"
  />

  <MidiDialog
    ref="midiDialogRef"
    :midi-enabled="midiEnabled"
    :midi-supported="midiSupported"
    :outputs="outputs"
    :permission="permission"
    :permission-prompt="permissionPrompt"
    v-model:midi-model-output-id="midiModelOutputId"
    v-model:midi-model-out-ch="midiModelOutCh"
    :status-display="statusDisplay"
    :is-midi-dirty="isMidiDirty"
    @save="saveMidiDialog"
    @close="closeMidiDialog"
    @rescan="rescanMidi"
    @request-permission="handleRequestPermission"
    @refresh-permission="handleRefreshPermission"
    @request-connect="handleRequestConnect"
  />

  <GlobalKeyDialog
    ref="globalKeyDialogRef"
    :MAJOR_KEY_OPTIONS="MAJOR_KEY_OPTIONS"
    :model-scale="globalScale"
    :model-type="globalScaleType"
    :scale-pad-count="scaleModePadCount"
    @close="onCloseGlobalKey"
    @save="saveGlobalKey"
  />
</template>

<script setup>
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
} from "vue";
import { WebMidi } from "webmidi";
import { Music3, Music, Music2, Usb } from "lucide-vue-next";
import { Note, Chord, Key } from "@tonaljs/tonal";
import {
  pcToCssKey,
  normalizePcForKey,
  toDisplayNotesForPad,
  normalizeChordSymbolForKey as normChordSymForPadLike,
  chordDisplayForPad,
  MAJOR_DEGREES,
  MINOR_DEGREES,
  computeChordNotesFor,
  computeBaseChordNotesFor,
  inversionIndex,
  rotate,
  toAscendingWithOctave,
  computeOrderedChordPcs,
} from "./composables/theory";
import Keyboard from "./components/Keyboard.vue";
import PadGrid from "./components/PadGrid.vue";
import EditDialog from "./components/EditDialog.vue";
import MidiDialog from "./components/MidiDialog.vue";
import GlobalKeyDialog from "./components/GlobalKeyDialog.vue";
import { useMidi } from "./composables/useMidi";
import { usePads } from "./composables/usePads";
import { useGlobalKey } from "./composables/useGlobalKey";

// MIDI via composable
const {
  midiEnabled,
  status,
  permission,
  outputs,
  selectedOutputId,
  selectedOutCh,
  permissionAllowed: permissionAllowedMidi,
  permissionPrompt: permissionPromptMidi,
  connectMidi,
  disconnectMidi,
  updatePermissionStatus,
  renderDevices,
  getSelectedChannel,
  applySavedMidiSettings,
  hasValidSavedMidiSettings,
  saveMidiSettings,
} = useMidi();
const log = ref([]);
const nowPlaying = ref("");
const midiSupported = ref(true);
// Sticky display of the last pad that was played, even after releasing keys
const stickyNotes = ref([]);
const stickyPadLike = ref(null);
const lastActiveIdx = ref(null);
const permissionAllowed = permissionAllowedMidi;
const permissionPrompt = permissionPromptMidi;
// Deprecated: permission gating UI removed in favor of a single MIDI button
// Render-friendly nowPlaying (plain text)
const nowPlayingHtml = computed(() => nowPlaying.value);
// Track which pads are currently playing so we can stop them cleanly
// { [idx: number]: { notes: string[], outputId: string, channel: number } }
const activePads = ref({});
// Preview playback state (kept separate so it doesn't affect UI)
const previewActive = ref(null);
// active pitch classes for keyboard highlighting (lowercase, flats)
const activeKeySet = ref(new Set());

// Dialog component refs
const editDialogRef = ref(null);
const midiDialogRef = ref(null);
const globalKeyDialogRef = ref(null);
// MIDI settings dialog state
const midiModelOutputId = ref("");
const midiModelOutCh = ref(1);
const isMidiDirty = computed(() => {
  const id = midiModelOutputId.value;
  const ch = Number(midiModelOutCh.value);
  const hasOutputs = Array.isArray(outputs.value) && outputs.value.length > 0;
  const idExists = hasOutputs && outputs.value.some((o) => o.id === id);
  const chValid = ch >= 1 && ch <= 16;
  // If we don't have any outputs yet or current selection is invalid, there's nothing to save
  if (!hasOutputs || !idExists || !chValid) return false;
  // Only dirty when the selection actually differs from the current app selection
  return selectedOutputId.value !== id || Number(selectedOutCh.value) !== ch;
});

function openMidiDialog() {
  // Non-pad interaction: clear visual display
  clearVisualDisplay();
  // Seed dialog model from current selection
  midiModelOutputId.value =
    selectedOutputId.value || outputs.value[0]?.id || "";
  midiModelOutCh.value = Number(selectedOutCh.value) || 1;
  midiDialogRef.value?.open?.();
}
function closeMidiDialog() {
  midiDialogRef.value?.close?.();
}
function openGlobalKeyDialog() {
  // Non-pad interaction: clear visual display
  clearVisualDisplay();
  globalKeyDialogRef.value?.open?.();
}
function onCloseGlobalKey() {}
function saveGlobalKey({ scale, type }) {
  const changed = globalScale.value !== scale || globalScaleType.value !== type;
  globalScale.value = scale;
  globalScaleType.value = type;
  if (changed) {
    // Reset all pads in Scale mode to Unassigned so they are disabled until reconfigured
    (pads.value || []).forEach((pad, idx) => {
      if (pad?.mode === "scale") {
        resetPad(idx);
      }
    });
  }
}
function saveMidiDialog() {
  selectedOutputId.value = midiModelOutputId.value;
  selectedOutCh.value = Number(midiModelOutCh.value) || 1;
  saveMidiSettings();
  closeMidiDialog();
}

function rescanMidi() {
  try {
    renderDevices();
    // Ensure the dialog model references an existing output after refresh
    const exists = outputs.value.find((o) => o.id === midiModelOutputId.value);
    if (!exists) {
      midiModelOutputId.value = outputs.value[0]?.id || "";
    }
    logMsg("MIDI devices rescanned");
  } catch (err) {
    logMsg(`Error rescanning MIDI: ${err?.message || err}`);
  }
}

// Keep dialog selection sensible as devices appear: prefer previous selected device,
// otherwise pick the first output. Keep Save disabled by syncing app selection and dialog model.
watch(
  () => outputs.value,
  (list) => {
    const arr = Array.isArray(list) ? list : [];
    if (arr.length === 0) return;
    const currentSel = selectedOutputId.value;
    const exists = arr.some((o) => o.id === currentSel);
    const desiredId = exists ? currentSel : arr[0].id;
    if (selectedOutputId.value !== desiredId) {
      selectedOutputId.value = desiredId;
    }
    if (midiModelOutputId.value !== desiredId) {
      midiModelOutputId.value = desiredId;
    }
    const ch = Number(selectedOutCh.value);
    const chValid = ch >= 1 && ch <= 16 ? ch : 1;
    if (selectedOutCh.value !== chValid) selectedOutCh.value = chValid;
    if (Number(midiModelOutCh.value) !== chValid)
      midiModelOutCh.value = chValid;
  },
  { deep: false }
);

// Handlers for MidiDialog actions
async function handleRequestPermission() {
  // Trigger the browser permission request by attempting to enable MIDI
  try {
    await connectMidi();
  } catch {}
  await updatePermissionStatus();
}

async function handleRefreshPermission() {
  await updatePermissionStatus();
}

async function handleRequestConnect() {
  // Attempt to connect without opening the dialog again
  try {
    await connectMidi();
  } catch {}
  await updatePermissionStatus();
}

// moved theory helpers to composable

// Ensure a pad object includes current global key when in scale mode
function asPadLike(pad) {
  if (!pad) return pad;
  if (pad.mode === "scale") {
    return {
      ...pad,
      scale: globalScale.value,
      scaleTypeScale: globalScaleType.value,
    };
  }
  return pad;
}

function updateActiveKeys() {
  const next = new Set();
  const padsMap = activePads.value || {};
  const keys = Object.keys(padsMap);
  if (keys.length > 0) {
    for (const k of keys) {
      const notes = padsMap[k]?.notes || [];
      for (const n of notes) {
        const pc = Note.pitchClass(n);
        if (pc) next.add(pcToCssKey(pc));
      }
    }
  } else if ((stickyNotes.value || []).length) {
    for (const n of stickyNotes.value) {
      const pc = Note.pitchClass(n);
      if (pc) next.add(pcToCssKey(pc));
    }
  }
  activeKeySet.value = next;
}

// Keyboard component uses activeKeySet directly

// moved theory helpers to composable

function samePitchClass(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const ma = Note.midi(`${a}4`);
  const mb = Note.midi(`${b}4`);
  if (ma == null || mb == null) return false;
  return ma % 12 === mb % 12;
}

// Stop all active pads and clear keyboard highlights
function stopAllActive() {
  Object.keys(activePads.value).forEach((idx) => {
    const active = activePads.value[idx];
    const output = WebMidi.outputs.find((o) => o.id === active?.outputId);
    if (output) {
      const ch = output.channels[active.channel];
      for (const n of active.notes) ch.sendNoteOff(n);
    }
    delete activePads.value[idx];
  });
  activeKeySet.value = new Set();
  lastActiveIdx.value = null;
  nowPlaying.value = "";
  stickyNotes.value = [];
  stickyPadLike.value = null;
}

// Clear UI only (notes label + keyboard), without sending MIDI Note Off
function clearVisualDisplay() {
  activeKeySet.value = new Set();
  nowPlaying.value = "";
  stickyNotes.value = [];
  stickyPadLike.value = null;
}

// Per-pad chord state and editor
// Ableton-style enharmonic labels for scale select (value stays as our internal key spelling)
const MAJOR_KEY_OPTIONS = [
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
];
// Degrees arrays are imported from composables/theory

function defaultChord() {
  return {
    mode: "unassigned",
    // Scale-mode fields
    scale: "C",
    scaleTypeScale: "major",
    voicingScale: "triad",
    inversionScale: "root",
    octaveScale: 4,
    degree: "I",
    // Free-mode fields
    freeRoot: "C",
    scaleTypeFree: "major",
    voicingFree: "triad",
    inversionFree: "root",
    octaveFree: 4,
  };
}
// Pads via composable
const { pads, setPad, resetPad, rehydrate, persistOnChange, PAD_COUNT } =
  usePads();
// Global key via composable
const {
  globalScale,
  globalScaleType,
  rehydrateGlobalKey,
  persistOnChange: persistGlobalKey,
} = useGlobalKey();

// Count how many pads are currently in scale mode (for dialog warning)
const scaleModePadCount = computed(
  () => (pads.value || []).filter((p) => p?.mode === "scale").length
);

// Global context menu suppressor (helps reduce long-press menu on mobile)
const contextMenuHandler = (e) => {
  try {
    e.preventDefault();
  } catch {}
};

// On mount, always rehydrate pads from storage if available
onMounted(() => {
  rehydrate();
  persistOnChange();
  rehydrateGlobalKey();
  persistGlobalKey();
  // Always refresh MIDI permission state on load
  midiSupported.value = Boolean(
    (WebMidi && "supported" in WebMidi ? WebMidi.supported : undefined) ??
      (typeof navigator !== "undefined" &&
        typeof navigator.requestMIDIAccess === "function")
  );
  updatePermissionStatus();

  window.addEventListener("blur", stopAllActive);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("beforeunload", stopAllActive);
  // Suppress context menu globally
  document.addEventListener("contextmenu", contextMenuHandler);

  // Open MIDI dialog on page load
  nextTick(() => {
    try {
      midiDialogRef.value?.open?.();
    } catch {}
  });
});

const editDialog = ref(null);
const currentEditIndex = ref(0);
const editModel = ref(defaultChord());

// Mode-specific edit bindings so switching modes doesn't copy values between them
const editScaleType = computed({
  get: () =>
    editModel.value.mode === "free"
      ? editModel.value.scaleTypeFree
      : editModel.value.scaleTypeScale,
  set: (val) => {
    if (editModel.value.mode === "free") editModel.value.scaleTypeFree = val;
    else editModel.value.scaleTypeScale = val;
  },
});
const editVoicing = computed({
  get: () =>
    editModel.value.mode === "free"
      ? editModel.value.voicingFree
      : editModel.value.voicingScale,
  set: (val) => {
    if (editModel.value.mode === "free") editModel.value.voicingFree = val;
    else editModel.value.voicingScale = val;
  },
});
const editInversion = computed({
  get: () =>
    editModel.value.mode === "free"
      ? editModel.value.inversionFree
      : editModel.value.inversionScale,
  set: (val) => {
    if (editModel.value.mode === "free") editModel.value.inversionFree = val;
    else editModel.value.inversionScale = val;
  },
});
const editOctave = computed({
  get: () =>
    editModel.value.mode === "free"
      ? editModel.value.octaveFree
      : editModel.value.octaveScale,
  set: (val) => {
    const v = Math.min(6, Math.max(2, Number(val) || 4));
    if (editModel.value.mode === "free") editModel.value.octaveFree = v;
    else editModel.value.octaveScale = v;
  },
});
const isEditDirty = computed(() => {
  const pad = pads.value[currentEditIndex.value] || defaultChord();
  const m = editModel.value;
  if (pad.mode === "unassigned") {
    // Only dirty if a chord degree is chosen (valid assignment)
    return Boolean(m.degree);
  }
  return (
    pad.mode !== m.mode ||
    pad.scale !== m.scale ||
    pad.freeRoot !== m.freeRoot ||
    pad.scaleTypeScale !== m.scaleTypeScale ||
    pad.scaleTypeFree !== m.scaleTypeFree ||
    pad.degree !== m.degree ||
    pad.voicingScale !== m.voicingScale ||
    pad.voicingFree !== m.voicingFree ||
    pad.inversionScale !== m.inversionScale ||
    pad.inversionFree !== m.inversionFree ||
    Number(pad.octaveScale) !== Number(m.octaveScale) ||
    Number(pad.octaveFree) !== Number(m.octaveFree)
  );
});

const editChordOptions = computed(() => {
  // In scale mode, use the global key instead of per-pad controls
  const scale = globalScale.value;
  const type = globalScaleType.value;
  if (type === "major") {
    const k = Key.majorKey(scale);
    return MAJOR_DEGREES.map((deg, i) => {
      const name = k.triads[i];
      const display = normChordSymForPadLike(name, {
        mode: "scale",
        scale,
        scaleTypeScale: type,
      });
      return { degree: deg, name, display };
    });
  } else {
    const k = Key.minorKey(scale).natural;
    return MINOR_DEGREES.map((deg, i) => {
      const name = k.triads[i];
      const display = normChordSymForPadLike(name, {
        mode: "scale",
        scale,
        scaleTypeScale: type,
      });
      return { degree: deg, name, display };
    });
  }
});
const editInversions = computed(() => {
  const padLike = {
    ...editModel.value,
    voicingFree: editVoicing.value,
    voicingScale: editVoicing.value,
    scaleTypeFree: editScaleType.value,
    scaleTypeScale: editScaleType.value,
  };
  const len = computeBaseChordNotesFor(padLike).length;
  return Array.from({ length: len }, (_, i) => (i === 0 ? "root" : ordinal(i)));
});

// Removed unused statusClass

// Human-friendly status message for the badge
const statusDisplay = computed(() => {
  if (!midiSupported.value) return "Web MIDI not supported";
  if (midiEnabled.value) {
    if (!outputs.value?.length) return "MIDI connected — no devices detected";
    return "MIDI connected";
  }
  if (permission.value === "granted") return "MIDI allowed — not connected";
  if (permission.value === "prompt") return "MIDI permission required";
  if (permission.value === "denied") return "MIDI denied";
  return status.value || "MIDI not connected";
});

// Auto-reconnect: if permission is granted and browser supports Web MIDI,
// enable MIDI silently on permission changes or initial load
watch(
  () => permission.value,
  async (p) => {
    if (p === "granted" && midiSupported.value && !midiEnabled.value) {
      try {
        await connectMidi();
      } catch {}
    }
  },
  { immediate: false }
);

function openEdit(idx) {
  // Non-pad interaction: clear visual display
  clearVisualDisplay();
  currentEditIndex.value = idx;
  const pad = pads.value[idx];
  const isUnassigned = pad.mode === "unassigned";
  // Step 1: set scale or root and mode-specific fields directly without copying between modes
  editModel.value.mode = isUnassigned ? "scale" : pad.mode || "free";
  editModel.value.scale = globalScale.value;
  editModel.value.freeRoot = pad.freeRoot || "C";
  editModel.value.scaleTypeScale = globalScaleType.value;
  editModel.value.scaleTypeFree = pad.scaleTypeFree;
  editModel.value.voicingScale = isUnassigned ? "triad" : pad.voicingScale;
  editModel.value.voicingFree = pad.voicingFree;
  editModel.value.octaveScale = isUnassigned ? 4 : pad.octaveScale;
  editModel.value.octaveFree = pad.octaveFree;
  // Wait for computed options to update, then set degree and inversion
  nextTick(() => {
    if (isUnassigned) {
      // Pick first available chord option (usually I)
      const firstDeg =
        (editChordOptions.value && editChordOptions.value[0]?.degree) || "I";
      editModel.value.degree = firstDeg;
    } else {
      editModel.value.degree = pad.degree;
    }
    editModel.value.inversionScale = isUnassigned ? "root" : pad.inversionScale;
    editModel.value.inversionFree = pad.inversionFree;
    // Force recompute of dependent computed properties by updating editModel
    editModel.value = { ...editModel.value };
    editDialogRef.value?.open?.();
  });
}
function closeEdit() {
  // Ensure any preview notes are stopped when closing the dialog
  try {
    stopPreview();
  } catch {}
  editDialogRef.value?.close?.();
}
function saveEdit() {
  setPad(currentEditIndex.value, { ...editModel.value, assigned: true });
  closeEdit();
}

// Remove unused padLabel and chordSymbol

// Chord display with voicing (e.g., Dm7, Cadd9, G9)
const chordDisplay = chordDisplayForPad;

// Button label: e.g., Em 7 Inv 2 Oct 1
function padButtonLabel(pad) {
  if (pad?.mode === "unassigned" || pad?.assigned === false)
    return "Unassigned";
  // Compute notes as played
  const padLike =
    pad.mode === "scale"
      ? {
          ...pad,
          scale: globalScale.value,
          scaleTypeScale: globalScaleType.value,
        }
      : pad;
  const raw = computeChordNotesFor(padLike);
  const ordered = computeOrderedChordPcs(padLike);
  const baseOct = Number(
    (pad.mode === "free" ? pad.octaveFree : pad.octaveScale) ?? 4
  );
  const notesWithOctave = toAscendingWithOctave(ordered, baseOct);
  // Bass note is first note played (strip octave)
  const bass = Note.pitchClass(notesWithOctave[0]);
  // Chord symbol with voicing
  const symbol = chordDisplay(padLike);
  // Root note for this chord (from unrotated chord notes)
  const root = Note.pitchClass(raw[0]);
  // Normalized bass for display according to key
  const bassDisplay = normalizePcForKey(bass, padLike);
  // Show as e.g. Dm7 or Dm7/A with normalized enharmonics
  return samePitchClass(bass, root) ? symbol : `${symbol}/${bassDisplay}`;
}

// Render-friendly label that keeps flats in lowercase (e.g., Bb)
function padButtonLabelHtml(pad) {
  return padButtonLabel(pad);
}

function logMsg(msg) {
  log.value.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  if (log.value.length > 100) log.value.shift();
}

// Wrapper: connect MIDI then open settings if nothing valid was saved
async function connectMidiAndMaybeOpenDialog() {
  // Non-pad interaction: clear visual display
  clearVisualDisplay();
  await connectMidi();
  try {
    if (!hasValidSavedMidiSettings()) openMidiDialog();
  } catch {}
}

function startPad(idx, e) {
  if (activePads.value[idx]) return; // already playing
  const padOrig = pads.value[idx];
  if (padOrig?.mode === "unassigned" || padOrig?.assigned === false) return; // nothing to play
  const pad =
    padOrig.mode === "scale"
      ? {
          ...padOrig,
          scale: globalScale.value,
          scaleTypeScale: globalScaleType.value,
        }
      : padOrig;
  const raw = computeChordNotesFor(pad);
  const ordered = computeOrderedChordPcs(pad);
  const baseOct = Number(
    (pad.mode === "free" ? pad.octaveFree : pad.octaveScale) ?? 4
  );
  const notesWithOctave = toAscendingWithOctave(ordered, baseOct);
  const sel = getSelectedChannel();
  // Ensure we capture this pointer so release is detected even if cursor leaves
  try {
    e?.target?.setPointerCapture?.(e.pointerId);
  } catch {}
  if (sel) {
    for (const n of notesWithOctave) sel.ch.sendNoteOn(n);
  }
  activePads.value[idx] = {
    notes: notesWithOctave,
    outputId: sel ? sel.output.id : null,
    channel: sel ? sel.chNum : null,
  };
  lastActiveIdx.value = idx;
  nowPlaying.value = `${toDisplayNotesForPad(notesWithOctave, pad).join(" ")}`;
  // Remember this chord for sticky display after release
  stickyNotes.value = [...notesWithOctave];
  stickyPadLike.value = pad;
  updateActiveKeys();
  const midiInfo = sel ? ` on ${sel.output.name} ch${sel.chNum}` : " (no MIDI)";
  if (pad.mode === "free") {
    logMsg(
      `Start ${idx + 1}: [Free] ${pad.freeRoot} ${pad.scaleTypeFree} ${
        pad.voicingFree
      } ${pad.inversionFree} -> (${notesWithOctave.join(", ")})${midiInfo}`
    );
  } else {
    logMsg(
      `Start ${idx + 1}: ${pad.scale} ${pad.scaleTypeScale} ${pad.degree} ${
        pad.voicingScale
      } ${pad.inversionScale} -> (${notesWithOctave.join(", ")})${midiInfo}`
    );
  }
}

function stopPad(idx, e) {
  const active = activePads.value[idx];
  if (!active) return;
  // Release pointer capture if we have it
  try {
    e?.target?.releasePointerCapture?.(e.pointerId);
  } catch {}
  // Stop using the original output/channel used to start the pad (in case user switched outputs mid-hold)
  const output = WebMidi.outputs.find((o) => o.id === active.outputId);
  if (output) {
    const ch = output.channels[active.channel];
    for (const n of active.notes) ch.sendNoteOff(n);
    logMsg(
      `Stop  ${idx + 1}: (${active.notes.join(", ")}) on ${output.name} ch${
        active.channel
      }`
    );
  }
  delete activePads.value[idx];
  updateActiveKeys();
  if (lastActiveIdx.value === idx) {
    const remaining = Object.keys(activePads.value)
      .map((n) => Number(n))
      .sort((a, b) => a - b);
    if (remaining.length) {
      const nextIdx = remaining[remaining.length - 1];
      lastActiveIdx.value = nextIdx;
      const nextPad = asPadLike(pads.value[nextIdx]);
      const nextNotes = activePads.value[nextIdx]?.notes || [];
      nowPlaying.value = `${toDisplayNotesForPad(nextNotes, nextPad).join(
        " "
      )}`;
    } else {
      lastActiveIdx.value = null;
      // Show sticky last-played notes if available
      if ((stickyNotes.value || []).length && stickyPadLike.value) {
        nowPlaying.value = `${toDisplayNotesForPad(
          stickyNotes.value,
          stickyPadLike.value
        ).join(" ")}`;
      } else {
        nowPlaying.value = "";
      }
    }
  }
}

//

function ordinal(n) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

// updatePermissionStatus is provided by useMidi

// --- Preview playback for chord dialog ---
function startPreview(e) {
  if (previewActive.value) return;
  const pad = editModel.value;
  if (pad?.mode === "unassigned" || pad?.assigned === false) return;
  const padLike = {
    ...pad,
    scale: globalScale.value,
    scaleTypeScale: globalScaleType.value,
    voicingFree: editVoicing.value,
    voicingScale: editVoicing.value,
    scaleTypeFree: editScaleType.value,
    inversionFree: editInversion.value,
    inversionScale: editInversion.value,
    octaveFree: editOctave.value,
    octaveScale: editOctave.value,
  };
  const raw = computeChordNotesFor(padLike);
  const ordered = computeOrderedChordPcs(padLike);
  const baseOct = Number(
    (padLike.mode === "free" ? padLike.octaveFree : padLike.octaveScale) ?? 4
  );
  const notesWithOctave = toAscendingWithOctave(ordered, baseOct);
  const sel = getSelectedChannel();
  try {
    e?.target?.setPointerCapture?.(e.pointerId);
  } catch {}
  if (sel) {
    for (const n of notesWithOctave) sel.ch.sendNoteOn(n);
  }
  // Track preview separately so it doesn't affect keyboard highlights/labels
  previewActive.value = {
    notes: notesWithOctave,
    outputId: sel ? sel.output.id : null,
    channel: sel ? sel.chNum : null,
  };
  const midiInfo2 = sel
    ? ` on ${sel.output.name} ch${sel.chNum}`
    : " (no MIDI)";
  if (padLike.mode === "free") {
    logMsg(
      `Preview [Free]: ${padLike.freeRoot} ${padLike.scaleTypeFree} ${
        padLike.voicingFree
      } ${padLike.inversionFree} -> (${notesWithOctave.join(", ")})${midiInfo2}`
    );
  } else {
    logMsg(
      `Preview: ${padLike.scale} ${padLike.scaleTypeScale} ${padLike.degree} ${
        padLike.voicingScale
      } ${padLike.inversionScale} -> (${notesWithOctave.join(
        ", "
      )})${midiInfo2}`
    );
  }
}

function stopPreview(e) {
  const active = previewActive.value;
  if (!active) return;
  try {
    e?.target?.releasePointerCapture?.(e.pointerId);
  } catch {}
  const output = WebMidi.outputs.find((o) => o.id === active.outputId);
  if (output) {
    const ch = output.channels[active.channel];
    for (const n of active.notes) ch.sendNoteOff(n);
    logMsg(
      `Stop preview: (${active.notes.join(", ")}) on ${output.name} ch${
        active.channel
      }`
    );
  }
  previewActive.value = null;
}

// Safety: stop any sustained notes if the page loses focus or is closed
onBeforeUnmount(() => {
  stopAllActive();
  window.removeEventListener("blur", stopAllActive);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("beforeunload", stopAllActive);
  document.removeEventListener("contextmenu", contextMenuHandler);
});

function onVisibilityChange() {
  if (document.hidden) stopAllActive();
}
</script>
