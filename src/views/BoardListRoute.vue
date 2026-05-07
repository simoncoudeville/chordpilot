<template>
  <BoardListView
    :boards="boards"
    :midi-supported="midiSupported"
    @select-board="$emit('select-board', $event)"
    @create-board="$emit('create-board')"
    @duplicate-board="$emit('duplicate-board', $event)"
    @delete-board="$emit('delete-board', $event)"
    @rename-board="(...args) => $emit('rename-board', ...args)"
    @open-info="$emit('open-info')"
    @open-midi="$emit('open-midi')"
  />
</template>

<script setup>
import BoardListView from "../components/BoardListView.vue";

defineProps({
  boards: { type: Array, default: () => [] },
  midiSupported: { type: Boolean, default: true },
});

defineEmits([
  "select-board",
  "create-board",
  "duplicate-board",
  "delete-board",
  "rename-board",
  "open-info",
  "open-midi",
]);
</script>
