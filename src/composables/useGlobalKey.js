import { ref, watch } from "vue";

const STORAGE_KEY = "midi-test:global-key";

export function useGlobalKey() {
  const globalScale = ref("C");
  const globalScaleType = ref("major"); // 'major' | 'minor'

  function rehydrateGlobalKey() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        if (typeof obj.scale === "string") globalScale.value = obj.scale;
        if (obj.type === "major" || obj.type === "minor")
          globalScaleType.value = obj.type;
      }
    } catch {}
  }

  function persistOnChange() {
    watch(
      [globalScale, globalScaleType],
      ([s, t]) => {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ scale: s, type: t })
          );
        } catch {}
      },
      { immediate: true }
    );
  }

  return { globalScale, globalScaleType, rehydrateGlobalKey, persistOnChange };
}
