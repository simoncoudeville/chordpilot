<template>
  <dialog
    class="dialog-bottom"
    ref="dlg"
    @click.self="onClose"
    @cancel.prevent="onClose"
  >
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title">Presets</h2>
        <button
          type="button"
          class="dialog-close"
          @click="onClose"
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

      <!-- Save New Preset Section -->
      <div class="dialog-content">
        <h3 class="mb-1">Save Current Board</h3>
        <p class="color-meta mb-1">
          Save your current pad configuration and global scale settings as a
          preset.
        </p>
        <div class="flex gap-1">
          <input
            type="text"
            v-model="newPresetName"
            placeholder="Preset name..."
            class="input flex-grow"
            @keyup.enter="onSavePreset"
            maxlength="50"
          />
          <button
            type="button"
            class="button primary"
            @click="onSavePreset"
            :disabled="!newPresetName.trim()"
          >
            <Save :size="16" :stroke-width="1.5" />
            Save
          </button>
        </div>
      </div>

      <div class="dialog-content">
        <hr />
      </div>

      <!-- Presets List -->
      <div class="dialog-content">
        <h3 class="mb-1">Saved Presets</h3>
        <p class="color-meta mb-1" v-if="presets.length === 0">
          No presets saved yet.
        </p>
        <div v-else class="preset-list">
          <div
            v-for="preset in sortedPresets"
            :key="preset.id"
            class="preset-item"
          >
            <div class="preset-info">
              <div class="preset-name">{{ preset.name }}</div>
              <div class="preset-date color-meta">
                {{ formatDate(preset.timestamp) }}
              </div>
            </div>
            <div class="preset-actions">
              <button
                type="button"
                class="button-icon"
                @click="onLoadPreset(preset)"
                title="Load preset"
              >
                <Upload :size="16" :stroke-width="1.5" />
              </button>
              <button
                type="button"
                class="button-icon button-icon-danger"
                @click="onDeletePreset(preset.id)"
                title="Delete preset"
              >
                <Trash2 :size="16" :stroke-width="1.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-content" v-if="presets.length > 0">
        <hr />
      </div>

      <!-- Export/Import Section -->
      <div class="dialog-content">
        <h3 class="mb-1">Export & Import</h3>
        <p class="color-meta mb-1">
          Export all presets to a JSON file or import presets from a file.
        </p>
        <div class="flex gap-1">
          <button
            type="button"
            class="button"
            @click="onExportPresets"
            :disabled="presets.length === 0"
          >
            <Download :size="16" :stroke-width="1.5" />
            Export All
          </button>
          <button type="button" class="button" @click="triggerFileInput">
            <Upload :size="16" :stroke-width="1.5" />
            Import
          </button>
          <input
            ref="fileInput"
            type="file"
            accept=".json"
            @change="onImportPresets"
            style="display: none"
          />
        </div>
      </div>

      <div class="dialog-buttons">
        <button class="button" type="button" @click="onClose">Close</button>
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { ref, computed } from "vue";
import {
  X,
  Save,
  Upload,
  Trash2,
  Download,
} from "lucide-vue-next";

const props = defineProps({
  presets: { type: Array, default: () => [] },
});

const emit = defineEmits([
  "close",
  "save-preset",
  "load-preset",
  "delete-preset",
  "export-presets",
  "import-presets",
]);

const dlg = ref(null);
const newPresetName = ref("");
const fileInput = ref(null);

const sortedPresets = computed(() => {
  return [...props.presets].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
});

function formatDate(timestamp) {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return timestamp;
  }
}

function onSavePreset() {
  const name = newPresetName.value.trim();
  if (!name) return;
  emit("save-preset", name);
  newPresetName.value = "";
}

function onLoadPreset(preset) {
  emit("load-preset", preset);
  close();
}

function onDeletePreset(id) {
  if (confirm("Are you sure you want to delete this preset?")) {
    emit("delete-preset", id);
  }
}

function onExportPresets() {
  emit("export-presets");
}

function triggerFileInput() {
  fileInput.value?.click();
}

function onImportPresets(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      emit("import-presets", data);
      // Reset file input
      event.target.value = "";
    } catch (error) {
      alert("Failed to import presets. Invalid JSON file.");
      console.error("Import error:", error);
    }
  };
  reader.readAsText(file);
}

function open() {
  dlg.value?.showModal();
}

function close() {
  dlg.value?.close();
}

function onClose() {
  emit("close");
  close();
}

defineExpose({ open, close, dlg });
</script>

<style scoped>
.preset-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.375rem;
  gap: 1rem;
}

.preset-info {
  flex: 1;
  min-width: 0;
}

.preset-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-date {
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.preset-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.button-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  color: inherit;
  transition: background 0.2s;
}

.button-icon:hover {
  background: rgba(255, 255, 255, 0.2);
}

.button-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button-icon-danger:hover {
  background: rgba(239, 68, 68, 0.2);
  color: rgb(239, 68, 68);
}

.input {
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  color: inherit;
  font-family: inherit;
  font-size: 1rem;
}

.input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
}

.flex {
  display: flex;
}

.flex-grow {
  flex-grow: 1;
}

.gap-1 {
  gap: 0.5rem;
}

.mb-1 {
  margin-bottom: 0.5rem;
}
</style>
