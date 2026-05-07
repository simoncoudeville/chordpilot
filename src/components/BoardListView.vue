<template>
  <div class="top">
    <h1>Chordboard</h1>
    <div class="top-buttons">
      <button
        class="icon-button"
        type="button"
        @click="$emit('open-midi')"
        :disabled="!midiSupported"
        :title="!midiSupported ? 'Your browser does not support Web MIDI' : ''"
        aria-label="MIDI settings"
      >
        <Icon
          aria-hidden="true"
          :iconNode="Midi"
          :stroke-width="1.5"
          :size="20"
          :absoluteStrokeWidth="true"
        />
      </button>
      <button
        class="icon-button"
        type="button"
        @click="$emit('open-info')"
        aria-label="App information"
      >
        <InfoIcon
          aria-hidden="true"
          :stroke-width="1.5"
          :size="20"
          :absoluteStrokeWidth="true"
        />
      </button>
    </div>
  </div>

  <div class="board-list">
    <div
      v-for="board in props.boards"
      :key="board.id"
      class="board-row"
      @click="selectBoard(board.id)"
    >
      <div class="board-row-info">
        <h2>{{ board.name }}</h2>
        <p class="color-meta">{{ formatDate(board.createdAt) }}</p>
      </div>
      <button
        class="icon-button"
        type="button"
        @click.stop="openBoardMenu(board.id)"
        aria-label="Board options"
      >
        <EllipsisVertical
          aria-hidden="true"
          :stroke-width="1.5"
          :size="20"
          :absoluteStrokeWidth="true"
        />
      </button>
    </div>
  </div>
  <button
    class="fab"
    type="button"
    @click="createNewBoard"
    aria-label="New board"
  >
    <Plus
      aria-hidden="true"
      :stroke-width="1.5"
      :size="20"
      :absoluteStrokeWidth="true"
    />
  </button>

  <!-- Board Actions Dialog -->
  <dialog
    ref="actionsDialogRef"
    class="dialog-bottom"
    @click.self="closeActionsDialog"
    @cancel.prevent="closeActionsDialog"
  >
    <form
      class="dialog-body dialog-body--no-top"
      method="dialog"
      @submit.prevent
    >
      <div class="dialog-content action-list">
        <button class="action-button" type="button" @click="startRename">
          <Pencil
            aria-hidden="true"
            :stroke-width="1.5"
            :size="16"
            :absoluteStrokeWidth="true"
          />
          Rename
        </button>
        <button class="action-button" type="button" @click="doDuplicate">
          <Copy
            aria-hidden="true"
            :stroke-width="1.5"
            :size="16"
            :absoluteStrokeWidth="true"
          />
          Duplicate
        </button>
        <button class="action-button" type="button" @click="startDelete">
          <Trash2
            aria-hidden="true"
            :stroke-width="1.5"
            :size="16"
            :absoluteStrokeWidth="true"
          />
          Delete
        </button>
      </div>
    </form>
  </dialog>

  <!-- Rename Dialog -->
  <dialog
    ref="renameDialogRef"
    @click.self="closeRenameDialog"
    @cancel.prevent="closeRenameDialog"
  >
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title">Rename Board</h2>
        <button
          type="button"
          class="dialog-close"
          @click="closeRenameDialog"
          aria-label="Close"
        >
          <X
            class="dialog-close-icon"
            aria-hidden="true"
            :stroke-width="1.5"
            :size="16"
            :absoluteStrokeWidth="true"
          />
          <span class="sr-only">Close</span>
        </button>
      </div>
      <div class="dialog-content">
        <input
          ref="renameInputRef"
          v-model="renamingBoardName"
          type="text"
          class="input"
          placeholder="Enter board name"
          @keyup.enter="confirmRename"
          @keyup.escape="closeRenameDialog"
        />
      </div>
      <div class="dialog-buttons">
        <button class="button" type="button" @click="closeRenameDialog">
          Cancel
        </button>
        <button class="button primary" type="button" @click="confirmRename">
          Rename
        </button>
      </div>
    </form>
  </dialog>

  <!-- Delete Confirmation Dialog -->
  <dialog
    ref="deleteDialogRef"
    @click.self="closeDeleteDialog"
    @cancel.prevent="closeDeleteDialog"
  >
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title">Delete "{{ deletingBoardName }}"?</h2>
        <button
          type="button"
          class="dialog-close"
          @click="closeDeleteDialog"
          aria-label="Close"
        >
          <X
            class="dialog-close-icon"
            aria-hidden="true"
            :stroke-width="1.5"
            :size="16"
            :absoluteStrokeWidth="true"
          />
          <span class="sr-only">Close</span>
        </button>
      </div>
      <div class="dialog-content">
        <p class="color-meta">This action cannot be undone.</p>
      </div>
      <div class="dialog-buttons">
        <button class="button" type="button" @click="closeDeleteDialog">
          Cancel
        </button>
        <button class="button primary" type="button" @click="confirmDelete">
          Delete
        </button>
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { ref, nextTick } from "vue";
import {
  Copy,
  EllipsisVertical,
  Icon,
  InfoIcon,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-vue-next";

const Midi = [
  ["path", { d: "M12 18h.01", key: "mhygvu" }],
  ["path", { d: "M16.24 16.24h.01", key: "1x84wr" }],
  ["path", { d: "M18 12h.01", key: "yjnet6" }],
  ["path", { d: "M6 12h.01", key: "c2rlol" }],
  ["path", { d: "M7.76 16.24h.01", key: "11ncrc" }],
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
];

const props = defineProps({
  boards: {
    type: Array,
    required: true,
  },
  midiSupported: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits([
  "select-board",
  "create-board",
  "duplicate-board",
  "delete-board",
  "rename-board",
  "open-info",
  "open-midi",
]);

const actionsDialogRef = ref(null);
const renameDialogRef = ref(null);
const deleteDialogRef = ref(null);
const renameInputRef = ref(null);

const activeBoardId = ref(null);
const actionsBoardName = ref("");
const renamingBoardId = ref(null);
const renamingBoardName = ref("");
const deletingBoardId = ref(null);
const deletingBoardName = ref("");

function selectBoard(boardId) {
  emit("select-board", boardId);
}

function createNewBoard() {
  emit("create-board");
}

function openBoardMenu(boardId) {
  const board = props.boards.find((b) => b.id === boardId);
  if (board) {
    activeBoardId.value = boardId;
    actionsBoardName.value = board.name;
    actionsDialogRef.value?.showModal();
  }
}

function closeActionsDialog() {
  actionsDialogRef.value?.close();
  activeBoardId.value = null;
  actionsBoardName.value = "";
}

function startRename() {
  const boardId = activeBoardId.value;
  const board = props.boards.find((b) => b.id === boardId);
  closeActionsDialog();
  if (board) {
    renamingBoardId.value = boardId;
    renamingBoardName.value = board.name;
    renameDialogRef.value?.showModal();
    nextTick(() => {
      renameInputRef.value?.focus();
      renameInputRef.value?.select();
    });
  }
}

function confirmRename() {
  if (renamingBoardName.value.trim() && renamingBoardId.value) {
    emit("rename-board", renamingBoardId.value, renamingBoardName.value);
    closeRenameDialog();
  }
}

function closeRenameDialog() {
  renameDialogRef.value?.close();
  renamingBoardId.value = null;
  renamingBoardName.value = "";
}

function doDuplicate() {
  const boardId = activeBoardId.value;
  closeActionsDialog();
  if (boardId) {
    emit("duplicate-board", boardId);
  }
}

function startDelete() {
  const boardId = activeBoardId.value;
  const boardName = actionsBoardName.value;
  closeActionsDialog();
  if (boardId) {
    deletingBoardId.value = boardId;
    deletingBoardName.value = boardName;
    deleteDialogRef.value?.showModal();
  }
}

function confirmDelete() {
  if (deletingBoardId.value) {
    emit("delete-board", deletingBoardId.value);
    closeDeleteDialog();
  }
}

function closeDeleteDialog() {
  deleteDialogRef.value?.close();
  deletingBoardId.value = null;
  deletingBoardName.value = "";
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  if (Number.isNaN(date.getTime())) return "";

  const toLocalDayStart = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const oneDay = 86400000;
  const dayDiff = Math.round(
    (toLocalDayStart(now) - toLocalDayStart(date)) / oneDay,
  );

  if (dayDiff === 0) return "today";
  if (dayDiff === 1) return "yesterday";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
</script>
