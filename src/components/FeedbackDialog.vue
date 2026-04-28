<template>
  <dialog ref="dlg" @click.self="onClose" @cancel.prevent="onClose">
    <form class="dialog-body" method="dialog" @submit.prevent>
      <div class="dialog-top">
        <h2 class="dialog-title">Share your Feedback</h2>
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

      <div class="dialog-content">
        <p class="color-meta">
          Help me improve Chordboard. Share your feedback by filling out
          <a :href="feedbackUrl" target="_blank" rel="noopener noreferrer">
            this form</a
          >. It only takes a few minutes and will help me make Chordboard
          better.
        </p>
      </div>
      <div class="dialog-content">
        <p class="color-meta">
          If you don't like forms you can also share your thoughts by opening an
          issue on
          <a
            href="https://github.com/simoncoudeville/chordboard/issues"
            target="_blank"
            rel="noopener noreferrer"
            >GitHub</a
          >.
        </p>
      </div>

      <div class="dialog-buttons">
        <button class="button" type="button" @click="onDismiss">
          Don't show again
        </button>
        <button class="button primary" type="button" @click="onClose">
          Later
        </button>
      </div>
    </form>
  </dialog>
</template>

<script setup>
import { ref } from "vue";
import { X } from "lucide-vue-next";

const props = defineProps({
  feedbackUrl: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["close", "dismiss"]);

const dlg = ref(null);

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

function onDismiss() {
  emit("dismiss");
  close();
}

defineExpose({ open, close, dlg });
</script>
