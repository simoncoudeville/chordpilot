import { ref, watch } from "vue";

const STORAGE_KEY = "midi-test:pads";
const PAD_COUNT = 10;

function defaultPad() {
  return {
    mode: "unassigned",
    assigned: false,
    // scale-mode
    scale: "C",
    scaleTypeScale: "major",
    voicingScale: "triad",
    inversionScale: "root",
    octaveScale: 4,
    degree: "I",
    // free-mode
    freeRoot: "C",
    scaleTypeFree: "major",
    voicingFree: "triad",
    inversionFree: "root",
    octaveFree: 4,
  };
}

function sanitizePad(p) {
  const d = defaultPad();
  const oSF = Math.min(6, Math.max(2, Number(p?.octaveScale ?? d.octaveScale)));
  const oFF = Math.min(6, Math.max(2, Number(p?.octaveFree ?? d.octaveFree)));
  return {
    mode:
      p?.mode === "free"
        ? "free"
        : p?.mode === "unassigned"
        ? "unassigned"
        : "scale",
    assigned:
      typeof p?.assigned === "boolean"
        ? p.assigned
        : p?.mode === "unassigned"
        ? false
        : true,
    // scale-mode
    scale: typeof p?.scale === "string" ? p.scale : d.scale,
    scaleTypeScale: p?.scaleTypeScale === "minor" ? "minor" : "major",
    voicingScale:
      typeof p?.voicingScale === "string" ? p.voicingScale : d.voicingScale,
    inversionScale:
      typeof p?.inversionScale === "string"
        ? p.inversionScale
        : d.inversionScale,
    octaveScale: Number.isFinite(oSF) ? oSF : d.octaveScale,
    degree: typeof p?.degree === "string" ? p.degree : d.degree,
    // free-mode
    freeRoot: typeof p?.freeRoot === "string" ? p.freeRoot : d.freeRoot,
    scaleTypeFree: p?.scaleTypeFree === "minor" ? "minor" : "major",
    voicingFree:
      typeof p?.voicingFree === "string" ? p.voicingFree : d.voicingFree,
    inversionFree:
      typeof p?.inversionFree === "string" ? p.inversionFree : d.inversionFree,
    octaveFree: Number.isFinite(oFF) ? oFF : d.octaveFree,
  };
}

function loadPadsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return Array.from({ length: PAD_COUNT }, (_, i) =>
      arr[i] ? sanitizePad(arr[i]) : defaultPad()
    );
  } catch {
    return null;
  }
}

export function usePads() {
  const pads = ref(Array.from({ length: PAD_COUNT }, () => defaultPad()));

  function setPad(index, value) {
    pads.value[index] = sanitizePad(value);
  }

  function resetPad(index) {
    // Reset a single pad to the default unassigned state
    pads.value[index] = sanitizePad({
      ...defaultPad(),
      mode: "unassigned",
      assigned: false,
    });
  }

  function rehydrate() {
    const stored = loadPadsFromStorage();
    if (stored) pads.value.splice(0, PAD_COUNT, ...stored);
  }

  function persistOnChange() {
    watch(
      pads,
      (val) => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
        } catch {}
      },
      { deep: true }
    );
  }

  return { pads, setPad, resetPad, rehydrate, persistOnChange, PAD_COUNT };
}
