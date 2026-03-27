import { ref } from "vue";

const message = ref(null);
let timer = null;

export function useToast() {
  function showToast(msg, duration = 5000) {
    message.value = msg;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      message.value = null;
    }, duration);
  }

  function clearToast() {
    if (timer) clearTimeout(timer);
    message.value = null;
  }

  return { toastMessage: message, showToast, clearToast };
}
