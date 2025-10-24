import { ref, computed } from "vue";
import { WebMidi } from "webmidi";

export function useMidi() {
  const midiEnabled = ref(false);
  const status = ref("MIDI not connected");
  const permission = ref("unknown");
  const outputs = ref([]);
  const selectedOutputId = ref("");
  const selectedOutCh = ref(1);

  const permissionAllowed = computed(() => permission.value === "granted");
  const permissionPrompt = computed(() => permission.value === "prompt");

  const MIDI_SETTINGS_KEY = "midi-test:midi-settings";

  function logMsg(msg) {
    // noop placeholder; caller can override by passing custom logger if needed
    console.debug(msg);
  }

  function renderDevices() {
    outputs.value = WebMidi.outputs;
    if (!selectedOutputId.value && outputs.value.length)
      selectedOutputId.value = outputs.value[0].id;
  }

  function applySavedMidiSettings() {
    try {
      const raw = localStorage.getItem(MIDI_SETTINGS_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        const exists = outputs.value.find((o) => o.id === obj.outputId);
        if (exists) selectedOutputId.value = obj.outputId;
        selectedOutCh.value = Number(obj.channel) || 1;
      }
    } catch {}
  }

  function hasValidSavedMidiSettings() {
    try {
      const raw = localStorage.getItem(MIDI_SETTINGS_KEY);
      if (!raw) return false;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return false;
      const ch = Number(obj.channel);
      if (!obj.outputId || !(ch >= 1 && ch <= 16)) return false;
      const exists = outputs.value.find((o) => o.id === obj.outputId);
      return !!exists;
    } catch {
      return false;
    }
  }

  function saveMidiSettings() {
    try {
      localStorage.setItem(
        MIDI_SETTINGS_KEY,
        JSON.stringify({
          outputId: selectedOutputId.value,
          channel: selectedOutCh.value,
        })
      );
    } catch {}
  }

  function getSelectedChannel() {
    const output = WebMidi.outputs.find((o) => o.id === selectedOutputId.value);
    if (!output) return null;
    const chNum = Number(selectedOutCh.value);
    const ch = output.channels[chNum];
    return { ch, output, chNum };
  }

  async function connectMidi({ onPermissionUpdate } = {}) {
    try {
  status.value = "Requesting MIDI access…";
      // Explicitly disable SysEx to avoid elevated permission prompts and
      // suppress WebMidi's advisory warning about unspecified MIDIOptions.
      // Note: Browsers may still show a generic MIDI permission prompt.
      await WebMidi.enable({ sysex: false, software: false });
  midiEnabled.value = true;
  status.value = "MIDI connected.";
  logMsg("MIDI connected");
      await updatePermissionStatus(onPermissionUpdate);
      WebMidi.addListener("connected", (e) => {
        logMsg(`Connected: ${e.port.type} – ${e.port.name}`);
        renderDevices();
        applySavedMidiSettings();
      });
      WebMidi.addListener("disconnected", (e) => {
        logMsg(`Disconnected: ${e.port.type} – ${e.port.name}`);
        renderDevices();
      });
      renderDevices();
      applySavedMidiSettings();
    } catch (err) {
  status.value = "MIDI connection failed. See console.";
      logMsg(`Error enabling MIDI: ${err?.message || err}`);
    }
  }

  async function disconnectMidi() {
    try {
      if (WebMidi?.enabled) {
        WebMidi.disable();
      }
    } catch (err) {
      logMsg(`Error disconnecting MIDI: ${err?.message || err}`);
    } finally {
      midiEnabled.value = false;
  status.value = "MIDI disconnected.";
      outputs.value = [];
      selectedOutputId.value = "";
    }
  }

  async function updatePermissionStatus(onUpdate) {
    try {
      if (!("permissions" in navigator)) {
        permission.value = "unsupported (Permissions API)";
        return;
      }
      // @ts-ignore
      const statusObj = await navigator.permissions.query({
        name: "midi",
        sysex: false,
      });
      permission.value = statusObj.state;
      statusObj.onchange = () => {
        permission.value = statusObj.state;
        onUpdate?.(permission.value);
      };
      onUpdate?.(permission.value);
    } catch (e) {
      permission.value = "unknown";
      onUpdate?.(permission.value);
    }
  }

  return {
    // state
    midiEnabled,
    status,
    permission,
    outputs,
    selectedOutputId,
    selectedOutCh,
    permissionAllowed,
    permissionPrompt,
    // fns
    connectMidi,
    disconnectMidi,
    updatePermissionStatus,
    renderDevices,
    getSelectedChannel,
    applySavedMidiSettings,
    hasValidSavedMidiSettings,
    saveMidiSettings,
  };
}
