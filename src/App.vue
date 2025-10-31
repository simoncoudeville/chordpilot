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
import { Music2 } from "lucide-vue-next";
import Keyboard from "./components/Keyboard.vue";
import PadGrid from "./components/PadGrid.vue";
import EditDialog from "./components/EditDialog.vue";
import MidiDialog from "./components/MidiDialog.vue";
import GlobalKeyDialog from "./components/GlobalKeyDialog.vue";
import { useMidi } from "./composables/useMidi";
import { usePads } from "./composables/usePads";
import { useGlobalKey } from "./composables/useGlobalKey";
import {
  chordDisplayForPad,
  computeOrderedChordPcs,
  computeVoicingNotes,
  toDisplayNotesForPad,
  pcToCssKey,
  MAJOR_DEGREES,
  MINOR_DEGREES,
  getPadChordMetadata,
  applyVoicingPattern,
} from "./composables/theory";

const INVERSION_LABELS = [
  "root",
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
];

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
const stickyNotes = ref([]);
const stickyLabel = ref("");
const lastActiveIdx = ref(null);
const permissionAllowed = permissionAllowedMidi;
const permissionPrompt = permissionPromptMidi;
const nowPlayingHtml = computed(() => nowPlaying.value);
const activePads = ref({});
const previewActive = ref(null);
const activeKeySet = ref(new Set());

const editDialogRef = ref(null);
const midiDialogRef = ref(null);
const globalKeyDialogRef = ref(null);

// Per-pad voicing type (not stored in pad model by default)
const padVoicingTypes = ref([]);

const midiModelOutputId = ref("");
const midiModelOutCh = ref(1);
const isMidiDirty = computed(() => {
  const list = outputs.value || [];
  if (!Array.isArray(list) || list.length === 0) return false;
  const id = midiModelOutputId.value;
  const ch = Number(midiModelOutCh.value);
  const idExists = list.some((o) => o.id === id);
  const chValid = ch >= 1 && ch <= 16;
  if (!idExists || !chValid) return false;
  return selectedOutputId.value !== id || Number(selectedOutCh.value) !== ch;
});

function formatNowPlaying(label, notes) {
  // Only show played notes, not the chord label
  return Array.isArray(notes) && notes.length ? notes.join(" ") : "";
}

function labelForPadLike(padLike) {
  if (!padLike || padLike.mode === "unassigned" || padLike.assigned === false)
    return "Unassigned";
  const symbol = chordDisplayForPad(padLike) || "";
  if (padLike.mode === "scale") {
    return symbol || padLike.degree || "Chord";
  }
  return symbol || "Custom";
}

function buildPadInfo(rawPad, idx = null) {
  const padLike = asPadLike(rawPad);
  if (!padLike || padLike.mode === "unassigned" || padLike.assigned === false)
    return null;
  const baseOctaveRaw =
    padLike.mode === "free" ? padLike.octaveFree : padLike.octaveScale;
  const parsedOct = Number(baseOctaveRaw);
  const baseOctave = Number.isFinite(parsedOct) ? parsedOct : 4;
  const orderedPcs = computeOrderedChordPcs(padLike) || [];
  let notes = orderedPcs.length ? computeVoicingNotes(padLike, baseOctave) : [];

  // Determine voicingType from the new pad properties
  let voicingType =
    padLike.mode === "free"
      ? padLike.voicingPatternFree
      : padLike.voicingPatternScale;
  if (!voicingType) voicingType = "close";

  // Apply voicing pattern unless the chord is non-tertian (add2/add9/sus)
  const nonTertian = ["add2", "add9", "sus2", "sus4"];
  const padVoicingName =
    padLike.mode === "free" ? padLike.voicingFree : padLike.voicingScale;
  if (!nonTertian.includes(padVoicingName)) {
    notes = applyVoicingPattern(notes, voicingType);
  }

  const displayNotes = toDisplayNotesForPad(notes, padLike);
  const cssKeys = orderedPcs.map((pc) => pcToCssKey(pc));
  const label = labelForPadLike(padLike);
  return { padLike, notes, displayNotes, cssKeys, label };
}

function setActiveKeys(keys = []) {
  const keySet = new Set();
  (keys || []).forEach((k) => {
    if (k) keySet.add(String(k).toLowerCase());
  });
  activeKeySet.value = keySet;
}

function refreshActiveKeys() {
  const keys = new Set();
  Object.values(activePads.value).forEach((info) => {
    (info?.cssKeys || []).forEach((k) => keys.add(k));
  });
  activeKeySet.value = keys;
}

function syncNowPlayingFromActivePads() {
  const indices = Object.keys(activePads.value)
    .map((n) => Number(n))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  if (indices.length) {
    const idx = indices[indices.length - 1];
    lastActiveIdx.value = idx;
    const info = activePads.value[idx];
    nowPlaying.value = formatNowPlaying(info?.label || "", info?.displayNotes);
    return;
  }
  lastActiveIdx.value = null;
  nowPlaying.value = formatNowPlaying(stickyLabel.value, stickyNotes.value);
}

function openMidiDialog() {
  clearVisualDisplay();
  midiModelOutputId.value =
    selectedOutputId.value || outputs.value?.[0]?.id || "";
  midiModelOutCh.value = Number(selectedOutCh.value) || 1;
  midiDialogRef.value?.open?.();
}

function closeMidiDialog() {
  midiDialogRef.value?.close?.();
}

function openGlobalKeyDialog() {
  clearVisualDisplay();
  globalKeyDialogRef.value?.open?.();
}

function onCloseGlobalKey() {}

function saveGlobalKey({ scale, type }) {
  const changed = globalScale.value !== scale || globalScaleType.value !== type;
  globalScale.value = scale;
  globalScaleType.value = type;
  if (changed) {
    (pads.value || []).forEach((pad, idx) => {
      if (pad?.mode === "scale") resetPad(idx);
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
    const exists = outputs.value?.find((o) => o.id === midiModelOutputId.value);
    if (!exists) midiModelOutputId.value = outputs.value?.[0]?.id || "";
    logMsg("MIDI devices rescanned");
  } catch (err) {
    logMsg(`Error rescanning MIDI: ${err?.message || err}`);
  }
}

watch(
  () => outputs.value,
  (list) => {
    const arr = Array.isArray(list) ? list : [];
    if (!arr.length) return;
    const current = selectedOutputId.value;
    const exists = arr.some((o) => o.id === current);
    const desiredId = exists ? current : arr[0].id;
    if (selectedOutputId.value !== desiredId)
      selectedOutputId.value = desiredId;
    if (midiModelOutputId.value !== desiredId)
      midiModelOutputId.value = desiredId;
    const ch = Number(selectedOutCh.value);
    const chValid = ch >= 1 && ch <= 16 ? ch : 1;
    if (selectedOutCh.value !== chValid) selectedOutCh.value = chValid;
    if (Number(midiModelOutCh.value) !== chValid)
      midiModelOutCh.value = chValid;
  },
  { deep: false }
);

async function handleRequestPermission() {
  try {
    await connectMidi();
  } catch {}
  await updatePermissionStatus();
}

async function handleRefreshPermission() {
  await updatePermissionStatus();
}

async function handleRequestConnect() {
  try {
    await connectMidi();
  } catch {}
  await updatePermissionStatus();
}

function asPadLike(pad) {
  if (!pad) return null;
  if (pad.mode === "scale") {
    return {
      ...pad,
      scale: globalScale.value,
      scaleTypeScale: globalScaleType.value,
    };
  }
  return pad;
}

function stopAllActive() {
  Object.keys(activePads.value).forEach((idx) => {
    const active = activePads.value[idx];
    if (!active) return;
    if (active.outputId && active.channel != null) {
      const output = WebMidi.outputs.find((o) => o.id === active.outputId);
      const ch = output?.channels?.[active.channel];
      if (ch) {
        for (const note of active.notes || []) ch.sendNoteOff(note);
      }
    }
    delete activePads.value[idx];
  });
  activePads.value = {};
  previewActive.value = null;
  clearVisualDisplay();
}

function clearVisualDisplay() {
  activeKeySet.value = new Set();
  nowPlaying.value = "";
  stickyNotes.value = [];
  stickyLabel.value = "";
  lastActiveIdx.value = null;
}

function defaultChord() {
  return {
    mode: "unassigned",
    scale: "C",
    scaleTypeScale: "major",
    voicingScale: "triad",
    inversionScale: "root",
    octaveScale: 4,
    voicingPatternScale: "close",
    degree: "I",
    freeRoot: "C",
    scaleTypeFree: "major",
    voicingFree: "triad",
    inversionFree: "root",
    octaveFree: 4,
    voicingPatternFree: "close",
    assigned: false,
  };
}

const { pads, setPad, resetPad, rehydrate, persistOnChange } = usePads();
const {
  globalScale,
  globalScaleType,
  rehydrateGlobalKey,
  persistOnChange: persistGlobalKey,
} = useGlobalKey();

const scaleModePadCount = computed(
  () => (pads.value || []).filter((p) => p?.mode === "scale").length
);

const contextMenuHandler = (e) => {
  try {
    e.preventDefault();
  } catch {}
};

onMounted(() => {
  rehydrate();
  persistOnChange();
  rehydrateGlobalKey();
  persistGlobalKey();
  midiSupported.value = Boolean(
    (WebMidi && "supported" in WebMidi ? WebMidi.supported : undefined) ??
      (typeof navigator !== "undefined" &&
        typeof navigator.requestMIDIAccess === "function")
  );
  updatePermissionStatus();

  window.addEventListener("blur", stopAllActive);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("beforeunload", stopAllActive);
  document.addEventListener("contextmenu", contextMenuHandler);

  nextTick(() => {
    try {
      midiDialogRef.value?.open?.();
    } catch {}
  });
});

onBeforeUnmount(() => {
  stopAllActive();
  window.removeEventListener("blur", stopAllActive);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("beforeunload", stopAllActive);
  document.removeEventListener("contextmenu", contextMenuHandler);
  disconnectMidi();
});

const currentEditIndex = ref(0);
const editModel = ref(defaultChord());

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
    // Set voicing type for edit dialog
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
    const next = Math.min(6, Math.max(2, Number(val) || 4));
    if (editModel.value.mode === "free") editModel.value.octaveFree = next;
    else editModel.value.octaveScale = next;
  },
});

const isEditDirty = computed(() => {
  const pad = pads.value[currentEditIndex.value] || defaultChord();
  const model = editModel.value;
  if (pad.mode === "unassigned" || pad.assigned === false) {
    return model.mode !== "unassigned" || model.degree !== "I";
  }
  return (
    pad.mode !== model.mode ||
    pad.scale !== model.scale ||
    pad.freeRoot !== model.freeRoot ||
    pad.scaleTypeScale !== model.scaleTypeScale ||
    pad.scaleTypeFree !== model.scaleTypeFree ||
    pad.degree !== model.degree ||
    pad.voicingScale !== model.voicingScale ||
    pad.voicingFree !== model.voicingFree ||
    pad.voicingPatternScale !== model.voicingPatternScale ||
    pad.voicingPatternFree !== model.voicingPatternFree ||
    pad.inversionScale !== model.inversionScale ||
    pad.inversionFree !== model.inversionFree ||
    Number(pad.octaveScale) !== Number(model.octaveScale) ||
    Number(pad.octaveFree) !== Number(model.octaveFree)
  );
});

const editChordOptions = computed(() => {
  const type =
    (globalScaleType.value || "major") === "minor" ? "minor" : "major";
  const degrees = type === "minor" ? MINOR_DEGREES : MAJOR_DEGREES;
  return degrees.map((degree) => {
    const padLike = {
      mode: "scale",
      assigned: true,
      degree,
      scale: globalScale.value,
      scaleTypeScale: type,
      voicingScale: "triad",
      inversionScale: "root",
    };
    const label = labelForPadLike(padLike);
    // Always show degree number in select
    return {
      degree,
      name: `${degree} ${label}`,
      display: `${degree} - ${label}`,
    };
  });
});

const editInversions = computed(() => {
  const pad = editModel.value || defaultChord();
  const padLike = asPadLike({ ...pad, assigned: true });
  if (!padLike || padLike.mode === "unassigned" || padLike.assigned === false)
    return INVERSION_LABELS.slice(0, 1);
  const meta = getPadChordMetadata(padLike);
  // Use fullNoteCount for inversions so tensions are included
  const count = meta?.fullNoteCount || 0;
  const max = count > 0 ? Math.min(count, INVERSION_LABELS.length) : 1;
  return INVERSION_LABELS.slice(0, Math.max(1, max));
});

watch(
  editInversions,
  (options) => {
    const list = options && options.length ? options : ["root"];
    const pad = editModel.value;
    if (!pad) return;
    const mode = pad.mode === "free" ? "free" : "scale";
    const current =
      mode === "free"
        ? pad.inversionFree || "root"
        : pad.inversionScale || "root";
    if (list.includes(current)) return;
    const fallback = list[0] || "root";
    if (mode === "free") editModel.value.inversionFree = fallback;
    else editModel.value.inversionScale = fallback;
  },
  { immediate: true }
);

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

watch(
  () => permission.value,
  async (p) => {
    if (p === "granted" && midiSupported.value && !midiEnabled.value) {
      try {
        await connectMidi();
        applySavedMidiSettings();
      } catch {}
    }
  },
  { immediate: false }
);

watch(
  () => midiEnabled.value,
  (enabled) => {
    if (enabled) {
      applySavedMidiSettings();
    } else {
      stopAllActive();
      disconnectMidi();
    }
  },
  { immediate: true }
);

function openEdit(idx) {
  clearVisualDisplay();
  currentEditIndex.value = idx;
  const pad = pads.value[idx] || defaultChord();
  const isUnassigned = pad.mode === "unassigned" || pad.assigned === false;
  editModel.value = {
    ...defaultChord(),
    ...pad,
    mode: isUnassigned ? "scale" : pad.mode || "free",
    scale: globalScale.value,
    scaleTypeScale: globalScaleType.value,
    assigned: true,
  };
  // Ensure editModel carries the pad's persisted voicingType (if any)
  // so the dialog initializes correctly.
  try {
    editModel.value.voicingType =
      pad.voicingType || padVoicingTypes.value[idx] || "close";
  } catch {}
  nextTick(() => {
    if (isUnassigned) {
      editModel.value.degree = editChordOptions.value?.[0]?.degree || "I";
      editModel.value.inversionScale = "root";
      editModel.value.inversionFree = "root";
    }
    // Ensure per-pad voicing cache tracks the pad's current voicing.
    // Only use the explicit `voicingType` field; do not map chord extension
    // fields (voicingFree / voicingScale) into the voicing pattern selector.
    try {
      const savedVoicing = editModel.value.voicingType || "close";
      padVoicingTypes.value[currentEditIndex.value] = savedVoicing;
    } catch {}

    editDialogRef.value?.open?.();
  });
}

function closeEdit() {
  try {
    stopPreview();
  } catch {}
  editDialogRef.value?.close?.();
}

function saveEdit() {
  // Persist the voicing choice into the saved pad so playback uses it later.
  const modelCopy = { ...editModel.value };
  // Persist only the explicit voicingType field (do not derive from extension)
  const persistedVoicing = modelCopy.voicingType || "close";
  modelCopy.voicingType = persistedVoicing;

  // Also cache it in the runtime per-pad voicing array so UI reflects it
  try {
    padVoicingTypes.value[currentEditIndex.value] = persistedVoicing;
  } catch {}

  setPad(currentEditIndex.value, { ...modelCopy, assigned: true });
  closeEdit();
}

function padButtonLabel(pad) {
  return labelForPadLike(asPadLike(pad));
}

function padButtonLabelHtml(pad) {
  return padButtonLabel(pad);
}

function logMsg(msg) {
  log.value.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  if (log.value.length > 100) log.value.shift();
}

async function connectMidiAndMaybeOpenDialog() {
  clearVisualDisplay();
  await connectMidi();
  try {
    if (!hasValidSavedMidiSettings()) openMidiDialog();
  } catch {}
}

function startPad(idx, e) {
  if (activePads.value[idx]) return;
  const padOrig = pads.value[idx];
  if (!padOrig || padOrig.mode === "unassigned" || padOrig.assigned === false)
    return;
  const info = buildPadInfo(padOrig, idx);
  if (!info || !info.notes.length) return;
  const sel = getSelectedChannel();
  try {
    e?.target?.setPointerCapture?.(e.pointerId);
  } catch {}
  if (sel) {
    const channel = sel.output?.channels?.[sel.chNum];
    if (channel) {
      info.notes.forEach((note) => channel.sendNoteOn(note));
    }
  }
  activePads.value[idx] = {
    ...info,
    outputId: sel ? sel.output.id : null,
    channel: sel ? sel.chNum : null,
  };
  stickyNotes.value = info.displayNotes;
  stickyLabel.value = info.label;
  lastActiveIdx.value = idx;
  refreshActiveKeys();
  syncNowPlayingFromActivePads();
  const midiInfo = sel ? ` on ${sel.output.name} ch${sel.chNum}` : " (no MIDI)";
  const notesText = info.displayNotes.length
    ? ` — ${info.displayNotes.join(" ")}`
    : "";
  logMsg(`Start ${idx + 1}: ${info.label}${midiInfo}${notesText}`);
}

function stopPad(idx, e) {
  const active = activePads.value[idx];
  if (!active) return;
  try {
    e?.target?.releasePointerCapture?.(e.pointerId);
  } catch {}
  if (active.outputId && active.channel != null) {
    const output = WebMidi.outputs.find((o) => o.id === active.outputId);
    const ch = output?.channels?.[active.channel];
    if (ch) {
      for (const note of active.notes || []) ch.sendNoteOff(note);
    }
  }
  delete activePads.value[idx];
  refreshActiveKeys();
  syncNowPlayingFromActivePads();
  logMsg(`Stop  ${idx + 1}: ${active.label}`);
}

function startPreview(e) {
  if (previewActive.value) return;
  // Accept voicingType from event payload
  let voicingType = "close";
  let eventObj = e;
  if (e && typeof e === "object" && "voicingType" in e) {
    voicingType = e.voicingType?.value || e.voicingType || "close";
    eventObj = e.event || e;
  }
  // Always use voicingType from event payload for preview
  const info = buildPadInfo(
    { ...editModel.value, voicingType },
    currentEditIndex.value
  );
  if (!info || !info.notes.length) return;
  const sel = getSelectedChannel();
  try {
    eventObj?.target?.setPointerCapture?.(eventObj.pointerId);
  } catch {}
  if (sel) {
    const channel = sel.output?.channels?.[sel.chNum];
    if (channel) {
      info.notes.forEach((note) => channel.sendNoteOn(note));
    }
  }
  previewActive.value = {
    ...info,
    outputId: sel ? sel.output.id : null,
    channel: sel ? sel.chNum : null,
  };
  setActiveKeys(info.cssKeys);
  nowPlaying.value = formatNowPlaying(info.label, info.displayNotes);
  logMsg("Preview start");
}

function stopPreview(e) {
  const active = previewActive.value;
  if (!active) return;
  let eventObj = e;
  if (e && typeof e === "object" && "event" in e) {
    eventObj = e.event || e;
  }
  try {
    eventObj?.target?.releasePointerCapture?.(eventObj.pointerId);
  } catch {}
  if (active.outputId && active.channel != null) {
    const output = WebMidi.outputs.find((o) => o.id === active.outputId);
    const ch = output?.channels?.[active.channel];
    if (ch) {
      for (const note of active.notes || []) ch.sendNoteOff(note);
    }
  }
  previewActive.value = null;
  refreshActiveKeys();
  syncNowPlayingFromActivePads();
  logMsg("Preview stop");
}

function onVisibilityChange() {
  if (document.visibilityState !== "visible") stopAllActive();
}
</script>
