<template>
  <div class="top">
    <Keyboard
      :active-key-set="activeKeySet"
      :now-playing-html="nowPlayingHtml"
    />
    <div class="midi-status-container">
      <template v-if="!permissionAllowed && !permissionPrompt">
        <button class="primary" @click="requestMidiPermission">
          Allow MIDI
        </button>
      </template>
      <template v-else-if="!midiEnabled">
        <button class="primary" @click="connectMidiAndMaybeOpenDialog">
          Connect MIDI
        </button>
      </template>
      <template v-else>
        <button class="primary" type="button" @click="openMidiDialog">
          MIDI
        </button>
      </template>
      <button class="primary icon" type="button" @click="openGlobalKeyDialog">
        <!-- Global scale: {{ globalScale }} {{ globalScaleType }} -->
        ♪
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
    :outputs="outputs"
    v-model:midi-model-output-id="midiModelOutputId"
    v-model:midi-model-out-ch="midiModelOutCh"
    :status-display="statusDisplay"
    :is-midi-dirty="isMidiDirty"
    @save="saveMidiDialog"
    @close="closeMidiDialog"
    @rescan="rescanMidi"
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
  inversionIndex,
  rotate,
  toAscendingWithOctave,
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
const lastActiveIdx = ref(null);
const permissionAllowed = permissionAllowedMidi;
const permissionPrompt = permissionPromptMidi;
function requestMidiPermission() {
  connectMidiAndMaybeOpenDialog();
}
// Render-friendly nowPlaying with lowercase flats
const nowPlayingHtml = computed(() => decorateFlats(nowPlaying.value));
// Track which pads are currently playing so we can stop them cleanly
// { [idx: number]: { notes: string[], outputId: string, channel: number } }
const activePads = ref({});
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
  return (
    selectedOutputId.value !== midiModelOutputId.value ||
    Number(selectedOutCh.value) !== Number(midiModelOutCh.value)
  );
});

function openMidiDialog() {
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
  for (const k of Object.keys(padsMap)) {
    const notes = padsMap[k]?.notes || [];
    for (const n of notes) {
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
  updatePermissionStatus();

  window.addEventListener("blur", stopAllActive);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("beforeunload", stopAllActive);
  // Suppress context menu globally
  document.addEventListener("contextmenu", contextMenuHandler);
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
  const len = computeChordNotesFor(padLike).length;
  return Array.from({ length: len }, (_, i) => (i === 0 ? "root" : ordinal(i)));
});

// Removed unused statusClass

// Human-friendly status message for the badge
const statusDisplay = computed(() => {
  if (midiEnabled.value) return "MIDI connected";
  if (permission.value === "granted") return "MIDI allowed — not connected";
  if (permission.value === "prompt") return "MIDI permission required";
  if (permission.value === "denied") return "MIDI denied";
  return status.value || "MIDI not enabled";
});

function openEdit(idx) {
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
  const invIdx = inversionIndex(
    pad.mode === "free" ? pad.inversionFree : pad.inversionScale
  );
  const ordered = rotate(raw, invIdx);
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
  const plain = padButtonLabel(pad);
  return decorateFlats(plain);
}

function decorateFlats(text) {
  if (!text) return "";
  // Replace note flats like Ab, Bb, Cb, Db, Eb, Fb, Gb including before suffixes (e.g., Dbm7)
  return text.replace(/([A-G])b/g, '$1<span class="acc-flat">b</span>');
}

function logMsg(msg) {
  log.value.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  if (log.value.length > 100) log.value.shift();
}

// Wrapper: connect MIDI then open settings if nothing valid was saved
async function connectMidiAndMaybeOpenDialog() {
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
  const invIdx = inversionIndex(
    pad.mode === "free" ? pad.inversionFree : pad.inversionScale
  );
  const ordered = rotate(raw, invIdx);
  const baseOct = Number(
    (pad.mode === "free" ? pad.octaveFree : pad.octaveScale) ?? 4
  );
  const notesWithOctave = toAscendingWithOctave(ordered, baseOct);
  const sel = getSelectedChannel();
  if (!sel) return;
  // Ensure we capture this pointer so release is detected even if cursor leaves
  try {
    e?.target?.setPointerCapture?.(e.pointerId);
  } catch {}
  for (const n of notesWithOctave) sel.ch.sendNoteOn(n);
  activePads.value[idx] = {
    notes: notesWithOctave,
    outputId: sel.output.id,
    channel: sel.chNum,
  };
  lastActiveIdx.value = idx;
  nowPlaying.value = `${toDisplayNotesForPad(notesWithOctave, pad).join(" ")}`;
  updateActiveKeys();
  if (pad.mode === "free") {
    logMsg(
      `Start ${idx + 1}: [Free] ${pad.freeRoot} ${pad.scaleTypeFree} ${
        pad.voicingFree
      } ${pad.inversionFree} -> (${notesWithOctave.join(", ")}) on ${
        sel.output.name
      } ch${sel.chNum}`
    );
  } else {
    logMsg(
      `Start ${idx + 1}: ${pad.scale} ${pad.scaleTypeScale} ${pad.degree} ${
        pad.voicingScale
      } ${pad.inversionScale} -> (${notesWithOctave.join(", ")}) on ${
        sel.output.name
      } ch${sel.chNum}`
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
      nowPlaying.value = "";
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
  if (activePads.value["preview"]) return;
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
  const invIdx = inversionIndex(
    padLike.mode === "free" ? padLike.inversionFree : padLike.inversionScale
  );
  const ordered = rotate(raw, invIdx);
  const baseOct = Number(
    (padLike.mode === "free" ? padLike.octaveFree : padLike.octaveScale) ?? 4
  );
  const notesWithOctave = toAscendingWithOctave(ordered, baseOct);
  const sel = getSelectedChannel();
  if (!sel) return;
  try {
    e?.target?.setPointerCapture?.(e.pointerId);
  } catch {}
  for (const n of notesWithOctave) sel.ch.sendNoteOn(n);
  activePads.value["preview"] = {
    notes: notesWithOctave,
    outputId: sel.output.id,
    channel: sel.chNum,
  };
  // Reflect preview notes in the background now-playing display
  nowPlaying.value = `${toDisplayNotesForPad(notesWithOctave, padLike).join(
    " "
  )}`;
  updateActiveKeys();
  if (padLike.mode === "free") {
    logMsg(
      `Preview [Free]: ${padLike.freeRoot} ${padLike.scaleTypeFree} ${
        padLike.voicingFree
      } ${padLike.inversionFree} -> (${notesWithOctave.join(", ")}) on ${
        sel.output.name
      } ch${sel.chNum}`
    );
  } else {
    logMsg(
      `Preview: ${padLike.scale} ${padLike.scaleTypeScale} ${padLike.degree} ${
        padLike.voicingScale
      } ${padLike.inversionScale} -> (${notesWithOctave.join(", ")}) on ${
        sel.output.name
      } ch${sel.chNum}`
    );
  }
}

function stopPreview(e) {
  const active = activePads.value["preview"];
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
  delete activePads.value["preview"];
  updateActiveKeys();
  // Restore now-playing to last active pad (if any), otherwise clear
  if (lastActiveIdx.value != null && activePads.value[lastActiveIdx.value]) {
    const idx = lastActiveIdx.value;
    const nextPad = asPadLike(pads.value[idx]);
    const nextNotes = activePads.value[idx]?.notes || [];
    nowPlaying.value = `${toDisplayNotesForPad(nextNotes, nextPad).join(" ")}`;
  } else {
    const remaining = Object.keys(activePads.value)
      .filter((k) => k !== "preview")
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n))
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
      nowPlaying.value = "";
    }
  }
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
