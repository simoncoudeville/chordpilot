<template>
  <div class="view-shell">
    <Transition :name="viewTransitionName" @after-enter="onViewAfterEnter">
      <div v-if="showListView" key="list" class="view-panel" ref="listPanelRef">
        <BoardListView
          :boards="allBoards"
          :midi-supported="midiSupported"
          @select-board="onSelectBoard"
          @create-board="onCreateBoard"
          @duplicate-board="onDuplicateBoard"
          @delete-board="onDeleteBoard"
          @rename-board="onRenameBoard"
          @open-info="openInfoDialog"
          @open-midi="openMidiDialog"
        />
      </div>
      <div v-else key="detail" class="view-panel">
        <BoardView
          ref="boardViewRef"
          :board-name="activeBoard?.name"
          :pads="pads"
          :highlighted-notes="currentlyPlayingNoteNames"
          :note-velocity-map="noteVelocityMap"
          :pad-index="currentPadIndex"
          :permission-allowed="permissionAllowed"
          :midi-enabled="midiEnabled"
          :pad-button-label-html="padButtonLabelHtml"
          :pad-note-label="padNoteLabel"
          :global-scale="globalScale"
          :global-scale-root="preferredGlobalScaleRoot"
          :global-scale-display="globalScaleDisplayName"
          :global-scale-type="globalScaleType"
          :global-scale-enabled="globalScaleEnabled"
          :scale-pad-count="scaleModePadCount"
          @back="goBackToList"
          @start-pad="onStartPad"
          @stop-pad="onStopPad"
          @update-pad="onUpdatePad"
          @delete="requestDeletePad"
          @edit="openEditDialog"
          @preview-start="onPreviewStart"
          @preview-stop="onPreviewStop"
          @save-edit="saveEdit"
          @close-edit="closeEdit"
          @close-global-key="onCloseGlobalKey"
          @save-global-key="saveGlobalKey"
          @confirm-delete="confirmDeletePad"
          @cancel-delete="cancelDeletePad"
          @close-delete="onClosePadDeleteDialog"
        />
      </div>
    </Transition>
  </div>
  <div class="toast warning" popover="manual" ref="midiWarningRef">
    <button
      class="button-warning"
      type="button"
      @click="
        () => {
          openMidiDialog();
        }
      "
    >
      <AlertTriangle
        aria-hidden="true"
        :stroke-width="1.5"
        :size="16"
        :absoluteStrokeWidth="true"
      />
      {{ midiWarningLabel }}
    </button>
    <button
      class="popover-close"
      type="button"
      @click="closeMidiWarning"
      aria-label="Close"
    >
      <X
        aria-hidden="true"
        :stroke-width="1.5"
        :size="16"
        :absoluteStrokeWidth="true"
      />
      <span class="sr-only">Close</span>
    </button>
  </div>
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
  <InfoDialog
    ref="infoDialogRef"
    :midi-supported="midiSupported"
    @close="onCloseInfo"
  />
  <ChangelogDialog
    ref="changelogDialogRef"
    @close="onCloseChangelog"
    @dismiss="onDismissChangelog"
  />
  <div class="toast" popover="manual" ref="toastRef">{{ toastMessage }}</div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { WebMidi } from "webmidi";
import { AlertTriangle, X } from "lucide-vue-next";

import BoardView from "./components/BoardView.vue";
import MidiDialog from "./components/MidiDialog.vue";
import InfoDialog from "./components/InfoDialog.vue";
import ChangelogDialog from "./components/ChangelogDialog.vue";
import BoardListView from "./components/BoardListView.vue";
import { useMidi } from "./composables/useMidi";
import { useBoards } from "./composables/useBoards";
import { useToast } from "./composables/useToast";
import { createDefaultPad } from "./utils/migration";
import { Scale, Note } from "@tonaljs/tonal";
import {
  normalizeChordType,
  normalizeExtension,
  buildChordDefinition,
} from "./utils/chordSystem";
import {
  formatNoteName,
  formatChordSymbol,
  preferredScaleRoot,
  formatScaleName,
  simplifyNoteName,
} from "./utils/enharmonic";
import { qualityForScaleDegree } from "./utils/scaleHarmony";
import { changelog } from "./data/changelog";

const {
  midiEnabled,
  status,
  permission,
  outputs,
  selectedOutputId,
  selectedOutCh,
  permissionAllowed: permissionAllowedMidi,
  permissionPrompt: permissionPromptMidi,
  midiWasConnected,
  connectMidi,
  disconnectMidi,
  updatePermissionStatus,
  renderDevices,
  getSelectedChannel,
  saveMidiSettings,
} = useMidi();

const {
  boards: allBoards,
  activeBoard,
  loadBoards,
  setActiveBoard,
  createBoard,
  deleteBoard,
  renameBoard,
  duplicateBoard,
  updateActiveBoardPads,
  updateActiveBoardScale,
} = useBoards();

const { toastMessage } = useToast();

const showListView = ref(true);
const viewTransitionName = ref("view-push-forward");
const listPanelRef = ref(null);
const savedListScroll = ref(0);
const listScrollTargetRef = ref(null);
const listScrollHandlerRef = ref(null);

const midiSupported = ref(true);
const permissionAllowed = permissionAllowedMidi;
const permissionPrompt = permissionPromptMidi;

const midiDialogRef = ref(null);
const infoDialogRef = ref(null);
const changelogDialogRef = ref(null);
const boardViewRef = ref(null);
const midiWarningRef = ref(null);
const toastRef = ref(null);

const currentPadIndex = ref(0);
const deleteConfirmIndex = ref(null);

const midiModelOutputId = ref("");
const midiModelOutCh = ref(1);
const isMidiDirty = computed(() => {
  const list = outputs.value || [];
  if (!Array.isArray(list) || list.length === 0) return false;
  const id = midiModelOutputId.value;
  const ch = Number(midiModelOutCh.value);
  const idExists = list.some((o) => String(o?.id) === String(id));
  const chValid = ch >= 1 && ch <= 16;
  if (!idExists || !chValid) return false;
  const currentId = selectedOutputId.value;
  const currentCh = Number(selectedOutCh.value);
  return (
    String(currentId) !== String(id) || Number.isNaN(ch) || currentCh !== ch
  );
});

// Global scale state
const globalScale = ref("C");
const globalScaleType = ref("major");
const globalScaleEnabled = ref(true);

const preferredGlobalScaleRoot = computed(() =>
  preferredScaleRoot(globalScale.value, globalScaleType.value),
);

const globalScaleDisplayName = computed(() =>
  formatScaleName(globalScale.value, globalScaleType.value),
);

const globalScaleNotes = computed(() => {
  try {
    return (
      Scale.get(`${preferredGlobalScaleRoot.value} ${globalScaleType.value}`)
        .notes || []
    );
  } catch {
    return [];
  }
});

// Load all local state from the active board in one shot.
// Always call this instead of loadGlobalScaleSettings/loadPads individually
// to keep pads and scale in sync with the board.
function loadActiveBoardState() {
  const board = activeBoard.value;
  if (!board) return;
  if (board.scale) {
    if (board.scale.root) globalScale.value = board.scale.root;
    if (board.scale.type) globalScaleType.value = board.scale.type;
    if (typeof board.scale.enabled === "boolean")
      globalScaleEnabled.value = board.scale.enabled;
  }
  if (Array.isArray(board.pads)) {
    pads.value = board.pads.map((p) =>
      p ? { ...createDefaultPad(), ...p } : createDefaultPad(),
    );
  }
}

// Save global scale settings to active board
function saveGlobalScaleSettings() {
  updateActiveBoardScale({
    root: globalScale.value,
    type: globalScaleType.value,
    enabled: globalScaleEnabled.value,
  });
}

function openEditDialog(idx) {
  clearVisualDisplay();
  currentPadIndex.value = idx;
  boardViewRef.value?.openEditDialog(idx);
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

function onCloseGlobalKey() {}

function openInfoDialog() {
  clearVisualDisplay();
  infoDialogRef.value?.open?.();
}

function onCloseInfo() {}

function onCloseChangelog() {
  // Do nothing when closed normally (will show again next time)
}

function onDismissChangelog() {
  // Mark as seen ONLY when explicitly dismissed
  const latestVersion = changelog[0]?.version;
  if (latestVersion) {
    try {
      localStorage.setItem(CHANGELOG_KEY, latestVersion);
    } catch (e) {
      console.warn("Failed to save changelog seen state:", e);
    }
  }
}

const CHANGELOG_KEY = "chordboard:changelog-seen";

function checkChangelog() {
  const latestVersion = changelog[0]?.version;
  if (!latestVersion) return;

  const seenVersion = localStorage.getItem(CHANGELOG_KEY);
  if (seenVersion !== latestVersion) {
    // Open dialog
    // Use setTimeout to ensure it opens after mount and other inits
    setTimeout(() => {
      changelogDialogRef.value?.open?.();
    }, 500);
  }
}

function requestDeletePad(idx) {
  deleteConfirmIndex.value = idx;
  boardViewRef.value?.openPadDeleteDialog();
}

function resetDeleteDialogState() {
  deleteConfirmIndex.value = null;
}

function cancelDeletePad() {
  boardViewRef.value?.closePadDeleteDialog();
  resetDeleteDialogState();
}

function onClosePadDeleteDialog() {
  resetDeleteDialogState();
}

function confirmDeletePad() {
  const idx = deleteConfirmIndex.value;
  if (typeof idx !== "number" || idx < 0 || idx >= pads.value.length) {
    boardViewRef.value?.closePadDeleteDialog();
    resetDeleteDialogState();
    return;
  }
  const pad = pads.value[idx];
  if (pad && pad.mode !== "unassigned" && pad.assigned !== false) {
    onStopPad(idx, pad, null);
  }
  pads.value.splice(idx, 1, createDefaultPad());
  savePads();
  boardViewRef.value?.closePadDeleteDialog();
  resetDeleteDialogState();
}

function saveGlobalKey({ scale, type, enabled }) {
  const wasEnabled = globalScaleEnabled.value;
  const changed =
    String(scale) !== String(globalScale.value) ||
    String(type) !== String(globalScaleType.value);

  // If disabling scale mode, migrate all scale-mode pads to free mode
  if (wasEnabled && !enabled) {
    pads.value = pads.value.map((p) => {
      if (p && p.mode === "scale" && p.assigned !== false) {
        // Calculate current musical values
        const rootPc = chordRootForPad(p);
        const q = qualityForDegree(currentScaleIndex(p));
        const chordType =
          q === "m"
            ? "minor"
            : q === "dim"
              ? "diminished"
              : q === "aug"
                ? "augmented"
                : "major";

        // Return new pad object in free mode
        return {
          ...p,
          mode: "free",
          free: {
            root: rootPc,
            type: chordType,
            octave: p.scale.octave,
            extension: p.scale.extension,
            inversion: p.scale.inversion,
            voicing: p.scale.voicing,
            accidental: null,
          },
        };
      }
      return p;
    });
    savePads();
  } else if (enabled && changed) {
    // Reset affected pads silently; warning is shown inline in dialog
    const hasAffected = (pads.value || []).some(
      (p) => p && p.mode === "scale" && p.assigned !== false,
    );
    if (hasAffected) {
      pads.value = pads.value.map((p) =>
        p && p.mode === "scale" && p.assigned !== false
          ? createDefaultPad()
          : p,
      );
      savePads();
    }
  }
  globalScale.value = scale;
  globalScaleType.value = type;
  globalScaleEnabled.value = enabled;
  saveGlobalScaleSettings();
}

// Board management handlers
function onSelectBoard(boardId) {
  savedListScroll.value = getListScrollTarget()?.scrollTop ?? 0;
  viewTransitionName.value = "view-push-forward";
  setActiveBoard(boardId);
  loadActiveBoardState();
  showListView.value = false;
}

function goBackToList() {
  viewTransitionName.value = "view-push-back";
  showListView.value = true;
}

function onViewAfterEnter() {
  if (showListView.value) {
    const target = getListScrollTarget();
    if (target) target.scrollTop = savedListScroll.value;
  }
}

function getListScrollTarget() {
  const panel = listPanelRef.value;
  if (!panel) return null;
  return panel.querySelector(".board-list") || panel;
}

function onCreateBoard() {
  const existing = allBoards.value;
  let num = existing.length + 1;
  const usedNames = new Set(existing.map((b) => b.name));
  while (usedNames.has(`Board ${num}`)) num++;
  const board = createBoard(`Board ${num}`);
  onSelectBoard(board.id);
}

function onDuplicateBoard(boardId) {
  duplicateBoard(boardId);
}

function onDeleteBoard(boardId) {
  deleteBoard(boardId);
  // If we deleted the active board and there are still boards left
  if (activeBoard.value) {
    loadActiveBoardState();
  }
}

function onRenameBoard(boardId, newName) {
  renameBoard(boardId, newName);
}

function rescanMidi() {
  try {
    renderDevices();
    const exists = outputs.value?.find((o) => o.id === midiModelOutputId.value);
    if (!exists) midiModelOutputId.value = outputs.value?.[0]?.id || "";
  } catch (err) {
    // Error rescanning MIDI
  }
}

function saveMidiDialog() {
  selectedOutputId.value = midiModelOutputId.value;
  selectedOutCh.value = Number(midiModelOutCh.value) || 1;
  saveMidiSettings();
  closeMidiDialog();
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
  { deep: false },
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

function clearVisualDisplay() {
  lastPlayedNotes.value = [];
}

const PAD_COUNT = 12;
const DEFAULT_ATTACK = 0.75;

const pads = ref(Array.from({ length: PAD_COUNT }, createDefaultPad));
function savePads() {
  updateActiveBoardPads(pads.value);
}

onMounted(() => {
  midiSupported.value = Boolean(
    (WebMidi && "supported" in WebMidi ? WebMidi.supported : undefined) ??
    (typeof navigator !== "undefined" &&
      typeof navigator.requestMIDIAccess === "function"),
  );
  updatePermissionStatus();

  // Load boards (handles migration from legacy format)
  loadBoards();

  checkChangelog();

  if (showMidiWarningButton.value) {
    midiWarningRef.value?.showPopover();
  }
});

onBeforeUnmount(() => {
  disconnectMidi();
});

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

const hasMidiOutputs = computed(
  () => Array.isArray(outputs.value) && outputs.value.length > 0,
);

const showMidiWarningButton = computed(() => {
  if (!midiSupported.value) return true;
  if (!midiEnabled.value) return true;
  return !hasMidiOutputs.value;
});

function closeMidiWarning() {
  midiWarningRef.value?.hidePopover();
}

watch(
  toastMessage,
  (msg) => {
    if (msg) {
      toastRef.value?.showPopover();
    } else {
      toastRef.value?.hidePopover();
    }
  },
  { flush: "post" },
);

// Drive show/hide via the warning condition
watch(
  showMidiWarningButton,
  (visible) => {
    if (visible) {
      midiWarningRef.value?.showPopover();
    } else {
      midiWarningRef.value?.hidePopover();
    }
  },
  { flush: "post" },
);

const midiWarningLabel = computed(() => {
  if (!midiSupported.value) return "Your browser does not support Web MIDI";
  if (!midiEnabled.value) return "MIDI is not enabled";
  if (!hasMidiOutputs.value) return "No MIDI devices detected";
  const text = statusDisplay.value || "";
  return text ? `${text}` : "MIDI configuration issue";
});

// Count scale-mode pads for inline warning in GlobalKeyDialog
const scaleModePadCount = computed(() =>
  (pads.value || []).reduce(
    (acc, p) => acc + (p && p.mode === "scale" && p.assigned !== false ? 1 : 0),
    0,
  ),
);

watch(
  () => permission.value,
  async (p) => {
    if (p === "granted" && midiSupported.value && !midiEnabled.value) {
      try {
        // Auto-connect if MIDI was connected in the last session.
        // connectMidi() calls applySavedMidiSettings() internally.
        if (midiWasConnected.value) {
          await connectMidi();
        }
      } catch (e) {
        console.error("Failed to auto-connect MIDI:", e);
      }
    }
  },
  { immediate: false },
);

// Safety net: if midiEnabled is cleared externally, ensure WebMidi is torn down.
// applySavedMidiSettings is intentionally NOT called here — connectMidi() handles it.
watch(
  () => midiEnabled.value,
  (enabled) => {
    if (!enabled) {
      disconnectMidi();
    }
  },
  { immediate: true },
);

watch(
  listPanelRef,
  () => {
    if (listScrollTargetRef.value && listScrollHandlerRef.value) {
      listScrollTargetRef.value.removeEventListener(
        "scroll",
        listScrollHandlerRef.value,
      );
    }

    const target = getListScrollTarget();
    listScrollTargetRef.value = target;
    if (!target) return;

    target.scrollTop = savedListScroll.value;
    const onListScroll = () => {
      savedListScroll.value = target.scrollTop;
    };
    listScrollHandlerRef.value = onListScroll;
    target.addEventListener("scroll", onListScroll, { passive: true });
  },
  { flush: "post" },
);

onBeforeUnmount(() => {
  if (listScrollTargetRef.value && listScrollHandlerRef.value) {
    listScrollTargetRef.value.removeEventListener(
      "scroll",
      listScrollHandlerRef.value,
    );
  }
});

function saveEdit(snapshot) {
  try {
    const idx = Number(currentPadIndex.value) || 0;
    const next = { ...createDefaultPad(), ...snapshot, assigned: true };
    pads.value.splice(idx, 1, next);
    savePads();
  } catch (e) {
    console.error("Failed to save pad edit:", e);
  }
  closeEdit();
}

function closeEdit() {
  boardViewRef.value?.closeEditDialog();
}

// Build chord label and notes from pad state
function qualityForDegree(index) {
  return qualityForScaleDegree(globalScaleNotes.value, index);
}

function buildChordSymbol(rootPc, type, extension) {
  const definition = buildChordDefinition(rootPc, type, extension);
  return definition.displaySymbol;
}

function pcsToAscending(pcs, baseOct) {
  const out = [];
  let lastMidi = -Infinity;
  let oct = Number.isFinite(baseOct) ? baseOct : 4;
  for (const pc of pcs) {
    let n = `${pc}${oct}`;
    let m = Note.midi(n) ?? -Infinity;
    if (m <= lastMidi) {
      oct += 1;
      n = `${pc}${oct}`;
      m = Note.midi(n) ?? m;
    }
    out.push(n);
    lastMidi = m;
  }
  return out;
}

// --- Inversion & Voicing helpers (mirror EditDialog logic) ---
function sortByMidi(notes) {
  return [...notes].sort((a, b) => (Note.midi(a) ?? 0) - (Note.midi(b) ?? 0));
}
function raiseOct(note, delta = 1) {
  const info = Note.get(note);
  const pc = info?.pc || note.replace(/[0-9]/g, "");
  const baseOct =
    typeof info?.oct === "number"
      ? info.oct
      : Number.parseInt(note.replace(/^[^0-9]+/, ""), 10) || 4;
  return `${pc}${baseOct + delta}`;
}
function lowerOct(note, delta = 1) {
  return raiseOct(note, -delta);
}
function insertAscending(arr, note) {
  const m = Note.midi(note) ?? 0;
  const out = [];
  let inserted = false;
  for (const n of arr) {
    const mi = Note.midi(n) ?? 0;
    if (!inserted && m <= mi) {
      out.push(note);
      inserted = true;
    }
    out.push(n);
  }
  if (!inserted) out.push(note);
  return out;
}

function applyInversion(notes, inversionLabel) {
  const order = ["root", "1st", "2nd", "3rd", "4th"];
  const steps = Math.max(0, order.indexOf(String(inversionLabel)));
  let res = sortByMidi(notes);
  for (let i = 0; i < steps; i++) {
    if (!res.length) break;
    const lowest = res.shift();
    const raised = raiseOct(lowest, 1);
    res = insertAscending(res, raised);
  }
  return sortByMidi(res);
}

function applyVoicing(notes, pattern) {
  const n = notes.length;
  if (n <= 1 || !pattern || pattern === "close") return sortByMidi(notes);
  let out = [...notes];
  switch (pattern) {
    case "open": {
      const evens = out.filter((_, i) => i % 2 === 0);
      const oddsRaised = out
        .filter((_, i) => i % 2 === 1)
        .map((x) => raiseOct(x, 1));
      out = [...evens, ...oddsRaised];
      break;
    }
    case "drop2": {
      if (n >= 2) {
        const idx = n - 2; // second highest
        out[idx] = lowerOct(out[idx], 1);
      }
      break;
    }
    case "drop3": {
      if (n >= 3) {
        const idx = n - 3; // third highest
        out[idx] = lowerOct(out[idx], 1);
      }
      break;
    }
    case "spread": {
      const mid = Math.floor(n / 2);
      out = out.map((x, i) => (i >= mid ? raiseOct(x, 1) : x));
      break;
    }
    default:
      break;
  }
  return sortByMidi(out);
}

function simplifyNoteList(notes) {
  if (!Array.isArray(notes)) return [];
  return notes.map((n) => simplifyNoteName(n));
}

function chordRootForPad(pad) {
  if (!pad) return "C";
  if (pad.mode === "scale") {
    const s = Array.isArray(globalScaleNotes.value)
      ? globalScaleNotes.value
      : [];
    const deg = Math.max(1, parseInt(pad?.scale?.degree ?? "1", 10) || 1);
    const i = (deg - 1) % (s.length || 7);
    return s[i] || "C";
  }
  return pad?.free?.root || "C";
}

function currentScaleIndex(pad) {
  if (!pad || pad.mode !== "scale") return 0;
  const s = Array.isArray(globalScaleNotes.value) ? globalScaleNotes.value : [];
  const deg = Math.max(1, parseInt(pad?.scale?.degree ?? "1", 10) || 1);
  return (deg - 1) % (s.length || 7);
}

function padChordSymbol(pad) {
  if (!pad || pad.mode === "unassigned" || pad.assigned === false) return "";
  if (pad.mode === "scale") {
    const rootPc = chordRootForPad(pad);
    const q = qualityForDegree(currentScaleIndex(pad));
    const type =
      q === "m"
        ? "minor"
        : q === "dim"
          ? "diminished"
          : q === "aug"
            ? "augmented"
            : "major";
    const ext = normalizeExtension(pad?.scale?.extension);
    return buildChordSymbol(rootPc, type, ext);
  } else if (pad.mode === "free") {
    const rootPc = pad?.free?.root || "C";
    const type = normalizeChordType(pad?.free?.type);
    const ext = normalizeExtension(pad?.free?.extension);
    return buildChordSymbol(rootPc, type, ext);
  }
  return "";
}

function padBaseOctave(pad) {
  if (!pad) return 4;
  if (pad.mode === "scale") {
    const val = Number(pad?.scale?.octave);
    return Number.isFinite(val) ? val : 4;
  }
  if (pad.mode === "free") {
    const val = Number(pad?.free?.octave);
    return Number.isFinite(val) ? val : 4;
  }
  return 4;
}

function padNotes(pad) {
  const symbol = padChordSymbol(pad);
  if (!symbol) return [];
  const type =
    pad.mode === "scale"
      ? normalizeChordType(qualityForDegree(currentScaleIndex(pad)))
      : normalizeChordType(pad?.free?.type);
  const extension =
    pad.mode === "scale"
      ? normalizeExtension(pad?.scale?.extension)
      : normalizeExtension(pad?.free?.extension);
  const definition = buildChordDefinition(
    chordRootForPad(pad),
    type,
    extension,
  );
  const pcs = definition.notes;
  const oct = padBaseOctave(pad);
  if (!pcs.length) {
    const rootPc = symbol.replace(/[^A-G#b].*$/, "");
    return [`${rootPc}${oct}`];
  }
  // Base ascending stack
  const base = pcsToAscending(pcs, oct);
  const inv =
    pad.mode === "scale" ? pad?.scale?.inversion : pad?.free?.inversion;
  const voi = pad.mode === "scale" ? pad?.scale?.voicing : pad?.free?.voicing;
  const afterInv = applyInversion(base, inv || "root");
  const afterVoicing = applyVoicing(afterInv, voi || "close");
  return sortByMidi(afterVoicing);
}

function padButtonLabelHtml(pad) {
  const s = padChordSymbol(pad);
  if (!s) return "UNASSIGNED";
  return formatChordSymbol(
    s,
    preferredGlobalScaleRoot.value,
    globalScaleType.value,
  );
}

function padNoteLabel(pad) {
  const notes = padNotes(pad);
  if (!notes.length) return "";
  return notes
    .map((note) =>
      formatNoteName(
        simplifyNoteName(note),
        preferredGlobalScaleRoot.value,
        globalScaleType.value,
      ),
    )
    .join(" ");
}

import { reactive } from "vue";
const activePadNotes = reactive({});
const activeNoteVelocities = reactive({}); // {[padIdx]: {[noteStr]: velocity}}

const padTimers = reactive({});
const padSchedules = reactive({});
const padVisualReleaseTimers = reactive({});
const VISUAL_RELEASE_MS = 120;

function onStartPad(idx, e, coords) {
  try {
    if (padVisualReleaseTimers[idx]) {
      clearTimeout(padVisualReleaseTimers[idx]);
      padVisualReleaseTimers[idx] = null;
    }

    // Clear any existing state for this pad
    if (padTimers[idx]) {
      padTimers[idx].forEach((id) => clearTimeout(id));
      padTimers[idx] = [];
    } else {
      padTimers[idx] = [];
    }
    padSchedules[idx] = []; // Track scheduled notes { note, time }

    const pad = pads.value?.[idx];
    const rawNotes = padNotes(pad);
    const notes = simplifyNoteList(rawNotes);
    if (!notes.length) return;
    const sel = getSelectedChannel();
    const ch = sel?.ch;
    if (!ch) return;

    // Calculate start parameters
    let baseVelocity = DEFAULT_ATTACK;
    let strumDuration = 0;
    let humanizeAmount = 0;
    let tiltAmount = 0;

    const settings = pad.settings || { x: "none", y: "none" };

    // Helper to process axis
    const processAxis = (axisValue, func) => {
      if (func === "velocity") {
        baseVelocity = axisValue;
      } else if (func === "strum") {
        // Map 0-1 to 0-500ms
        strumDuration = axisValue * 500;
      } else if (func === "humanization") {
        humanizeAmount = axisValue;
      } else if (func === "velocity-tilt") {
        // Map 0-1 to -1 to 1
        tiltAmount = (axisValue - 0.5) * 2;
      }
    };

    if (coords) {
      processAxis(coords.x, settings.x);
      processAxis(coords.y, settings.y);
    }

    // Keep current highlights until explicit release to avoid flicker on rapid retriggers.
    if (!Array.isArray(activePadNotes[idx])) activePadNotes[idx] = [];
    lastPlayedNotes.value = notes.slice(); // Remember last played chord

    const now = WebMidi.time;
    const strumStep =
      strumDuration > 0 && notes.length > 1 ? strumDuration / notes.length : 0;

    // Look-ahead time for buffering (send notes this many ms in advance)
    const BUFFER_MS = 50;

    // Play notes with individual velocity and timing
    notes.forEach((n, i) => {
      let vel = baseVelocity;

      // Apply Velocity Tilt
      if (tiltAmount !== 0 && notes.length > 1) {
        // -1 (bass loud) to 1 (treble loud)
        // Position in chord: 0 to 1
        const pos = i / (notes.length - 1);
        // Bias: -1 (bass) to 1 (treble)
        const bias = pos * 2 - 1;
        // Effect: tilt * bias.
        // If tilt is -1 (bass loud): bass(bias=-1) -> +1, treble(bias=1) -> -1
        // If tilt is 1 (treble loud): bass(bias=-1) -> -1, treble(bias=1) -> +1
        // Scale factor: 0.25 (so +/- 0.25 velocity change)
        vel += tiltAmount * bias * 0.25;
      }

      // Apply Humanization (Velocity)
      if (humanizeAmount > 0) {
        // +/- 0.2 (approx 25 velocity steps) at max
        const delta = (Math.random() - 0.5) * 0.4 * humanizeAmount;
        vel += delta;
      }

      // Clamp velocity
      vel = Math.max(0.01, Math.min(1, vel));

      // Calculate exact MIDI timestamp for this note
      let noteTime = now + i * strumStep;

      // Apply Humanization (Microtiming)
      if (humanizeAmount > 0) {
        // +/- 35ms * amount
        const timeDelta = (Math.random() - 0.5) * 70 * humanizeAmount;
        noteTime += timeDelta;
      }

      // Ensure we don't schedule in the past
      if (noteTime < now) noteTime = now;

      const schedule = () => {
        try {
          // Use precise MIDI time
          ch.playNote(n, { attack: vel, time: noteTime });
          if (!Array.isArray(activePadNotes[idx])) activePadNotes[idx] = [];
          if (!activePadNotes[idx].includes(n)) {
            activePadNotes[idx] = [...activePadNotes[idx], n];
          }
          if (!activeNoteVelocities[idx]) activeNoteVelocities[idx] = {};
          activeNoteVelocities[idx] = {
            ...activeNoteVelocities[idx],
            [n]: vel,
          };
          // Track that we sent this note to the driver
          padSchedules[idx].push({ note: n, time: noteTime });
        } catch {}
      };

      const timeUntilNote = noteTime - WebMidi.time;

      // If note is far in future, wait before scheduling
      // This allows us to cancel the setTimeout if user releases pad early
      if (timeUntilNote > BUFFER_MS) {
        const wakeupTime = timeUntilNote - BUFFER_MS;
        const timerId = setTimeout(schedule, wakeupTime);
        padTimers[idx].push(timerId);
      } else {
        // Close enough, schedule immediately
        schedule();
      }
    });

    // Send initial continuous values if applicable
    if (coords) {
      sendContinuousExpression(ch, settings.x, coords.x);
      sendContinuousExpression(ch, settings.y, coords.y);
    }
  } catch (e) {
    console.error("Failed to start pad:", e);
  }
}

function onUpdatePad(idx, coords) {
  try {
    const pad = pads.value?.[idx];
    if (!pad) return;
    const sel = getSelectedChannel();
    const ch = sel?.ch;
    if (!ch) return;

    const settings = pad.settings || { x: "none", y: "none" };
    sendContinuousExpression(ch, settings.x, coords.x);
    sendContinuousExpression(ch, settings.y, coords.y);
  } catch (e) {
    console.warn("Failed to send continuous expression:", e);
  }
}

function sendContinuousExpression(ch, func, value) {
  if (func === "aftertouch") {
    // Send channel aftertouch
    try {
      ch.setChannelAftertouch(value);
    } catch (e) {
      console.warn("Failed to send aftertouch:", e);
    }
  }
}

function onStopPad(idx) {
  try {
    // 1. Cancel any future notes that haven't been sent to MIDI driver yet
    if (padTimers[idx]) {
      padTimers[idx].forEach((id) => clearTimeout(id));
      padTimers[idx] = [];
    }

    // 2. Stop notes that were already sent or played
    // We need to stop them SAFELY.
    // If a note was scheduled for the future (e.g. now + 100ms),
    // sending stopNote() NOW (at now) might be ignored or cause stuck note
    // depending on the driver/synth because NoteOff comes before NoteOn.
    // So we must schedule the stop to happen slightly AFTER the start.
    const scheduled = padSchedules[idx] || [];
    const now = WebMidi.time;

    // We also stop 'activePadNotes' just in case, though padSchedules covers it
    const fallbackNotes = activePadNotes[idx] || [];
    const sel = getSelectedChannel();
    const ch = sel?.ch;

    if (ch) {
      // Create a set of notes we know about from schedule
      const handledNotes = new Set();

      scheduled.forEach((item) => {
        handledNotes.add(item.note);
        try {
          // Schedule stop at least 20ms after start, or now, whichever is later
          const stopTime = Math.max(now, item.time + 20);
          ch.stopNote(item.note, { time: stopTime });
        } catch (e) {
          console.warn("Failed to stop note:", item.note, e);
        }
      });

      // Legacy cleanup for any notes not in our schedule list (safety net)
      fallbackNotes.forEach((n) => {
        if (!handledNotes.has(n)) {
          try {
            ch.stopNote(n);
          } catch (e) {
            console.warn("Failed to stop fallback note:", n, e);
          }
        }
      });
    }
  } catch (e) {
    console.error("Failed to stop pad:", e);
  } finally {
    if (padVisualReleaseTimers[idx]) {
      clearTimeout(padVisualReleaseTimers[idx]);
    }
    padVisualReleaseTimers[idx] = setTimeout(() => {
      activePadNotes[idx] = [];
      activeNoteVelocities[idx] = {};
      padVisualReleaseTimers[idx] = null;
    }, VISUAL_RELEASE_MS);
    padSchedules[idx] = [];
  }
}
// Preview MIDI handling
const activePreviewNotes = ref([]);
// Track the last played chord to keep it visible on keyboard
const lastPlayedNotes = ref([]);

// Notes that are currently sounding right now (pads + preview).
const currentlyPlayingNoteNames = computed(() => {
  const fromPads = Object.values(activePadNotes).flatMap((arr) =>
    Array.isArray(arr) ? arr : [],
  );
  const fromPreview = Array.isArray(activePreviewNotes.value)
    ? activePreviewNotes.value
    : [];
  return simplifyNoteList([...fromPads, ...fromPreview]);
});

// Velocity map for currently playing notes (used for visual brightness on keyboard)
const noteVelocityMap = computed(() => {
  const map = {};
  for (const padVels of Object.values(activeNoteVelocities)) {
    if (padVels && typeof padVels === "object") {
      Object.assign(map, padVels);
    }
  }
  for (const n of activePreviewNotes.value || []) {
    map[n] = DEFAULT_ATTACK;
  }
  return map;
});

function onPreviewStart(payload) {
  try {
    const rawNotes = Array.isArray(payload?.notes) ? payload.notes : [];
    const notes = simplifyNoteList(rawNotes);
    if (!notes.length) return;
    const sel = getSelectedChannel();
    const ch = sel?.ch;
    if (!ch) return;
    activePreviewNotes.value = notes.slice();
    try {
      ch.playNote(notes, { attack: DEFAULT_ATTACK });
    } catch (e) {
      console.warn("Batch playNote failed, retrying individually:", e);
      for (const n of notes) {
        try {
          ch.playNote(n, { attack: DEFAULT_ATTACK });
        } catch {}
      }
    }
  } catch (e) {
    console.error("Failed to start preview:", e);
  }
}

function onPreviewStop() {
  try {
    if (!activePreviewNotes.value.length) return;
    const sel = getSelectedChannel();
    const ch = sel?.ch;
    if (!ch) return;
    try {
      ch.stopNote(activePreviewNotes.value);
    } catch (e) {
      console.warn("Batch stopNote failed, retrying individually:", e);
      for (const n of activePreviewNotes.value) {
        try {
          ch.stopNote(n);
        } catch {}
      }
    }
  } catch (e) {
    console.error("Failed to stop preview:", e);
  } finally {
    activePreviewNotes.value = [];
  }
}
</script>
