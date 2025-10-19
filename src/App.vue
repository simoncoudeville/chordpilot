<template>
    <div class="top">
        <div class="top-left">
            <div class="keyboard">
                <div class="key key-c white" :class="{ 'key-played': isKeyActive('c') }"></div>
                <div class="key key-d white" :class="{ 'key-played': isKeyActive('d') }"></div>
                <div class="key key-e white" :class="{ 'key-played': isKeyActive('e') }"></div>
                <div class="key key-f white" :class="{ 'key-played': isKeyActive('f') }"></div>
                <div class="key key-g white" :class="{ 'key-played': isKeyActive('g') }"></div>
                <div class="key key-a white" :class="{ 'key-played': isKeyActive('a') }"></div>
                <div class="key key-b white" :class="{ 'key-played': isKeyActive('b') }"></div>
                <div class="key key-db key-black" :class="{ 'key-played': isKeyActive('db') }"></div>
                <div class="key key-eb key-black" :class="{ 'key-played': isKeyActive('eb') }"></div>
                <div class="key key-gb key-black" :class="{ 'key-played': isKeyActive('gb') }"></div>
                <div class="key key-ab key-black" :class="{ 'key-played': isKeyActive('ab') }"></div>
                <div class="key key-bb key-black" :class="{ 'key-played': isKeyActive('bb') }"></div>
            </div>
            <p class="preserve-case" v-html="nowPlayingHtml"></p>
        </div>
        <div class="midi-status-container">
            <template v-if="!permissionAllowed && !permissionPrompt">
                <button @click="requestMidiPermission">Allow MIDI</button>
            </template>
            <template v-else-if="!midiEnabled">
                <button @click="connectMidi">Connect MIDI</button>
            </template>
            <template v-else>
                <button type="button" @click="openMidiDialog">MIDI Settings</button>
            </template>
        </div>
    </div>

    <div class="pads">
        <div class="pad" v-for="(pad, idx) in pads" :key="idx">            
            <button
            class="pad-play"
            :disabled="!permissionAllowed || !midiEnabled"
            @pointerdown.prevent.stop="startPad(idx, $event)"
            @pointerup.prevent.stop="stopPad(idx, $event)"
            @pointerleave.prevent.stop="stopPad(idx, $event)"
            @pointercancel.prevent.stop="stopPad(idx, $event)"
            @contextmenu.prevent
            ><span class="preserve-case" v-html="padButtonLabelHtml(pad)"></span></button>            
            <div class="pad-buttons">
                <button class="pad-edit" @click="openEdit(idx)" :disabled="!permissionAllowed || !midiEnabled">Edit</button>
            </div>
        </div>
    </div>

    <dialog ref="editDialog">
        <form class="dialog-body" method="dialog" @submit.prevent>
            <div class="dialog-top">
                <h2 class="dialog-title">Edit Pad {{ currentEditIndex + 1 }}</h2>
                <button type="button" class="dialog-close" @click="closeEdit" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                    <span class="sr-only">Close</span>
                </button>
            </div>
            
            <div class="toggle-buttons">
                <label class="toggle-button"><input class="toggle-button-input" type="radio" name="mode-chooser" v-model="editModel.mode" value="scale" /><span class="toggle-button-checked">[</span> Scale mode <span class="toggle-button-checked">]</span></label>
                <label class="toggle-button"><input class="toggle-button-input" type="radio" name="mode-chooser" v-model="editModel.mode" value="free" /><span class="toggle-button-checked">[</span> Free mode <span class="toggle-button-checked">]</span></label>
            </div>
        
            <div class="dialog-content edit-grid">
                <template v-if="editModel.mode === 'scale'">
                    <label>Scale
                        <select v-model="editModel.scale" class="preserve-case select-scale">
                            <option v-for="opt in MAJOR_KEY_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                        </select>
                    </label>
                </template>
                <template v-else>
                    <label>Root
                        <select v-model="editModel.freeRoot" class="preserve-case select-scale">
                            <option v-for="opt in MAJOR_KEY_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                        </select>
                    </label>
                </template>
                <label>Type
                    <select v-model="editScaleType">
                        <option value="major">major</option>
                        <option value="minor">minor</option>
                    </select>
                </label>
                <template v-if="editModel.mode === 'scale'">
                    <label>Chord
                        <select v-model="editModel.degree" class="preserve-case select-chord">
                            <option v-for="ch in editChordOptions" :key="ch.degree" :value="ch.degree">
                                {{ ch.degree }} — {{ ch.display }}
                            </option>
                        </select>
                    </label>
                </template>
                <label>Extensions
                    <select v-model="editVoicing">
                        <option v-for="v in allowedVoicingsForChord(editScaleType)" :key="v" :value="v">{{ v }}</option>
                    </select>
                </label>
                <label>Inversion
                    <select v-model="editInversion">
                        <option v-for="inv in editInversions" :key="inv" :value="inv">{{ inv }}</option>
                    </select>
                </label>
                <label>Octave
                    <select v-model.number="editOctave">
                        <option v-for="o in [2,3,4,5,6]" :key="o" :value="o">{{ o }}</option>
                    </select>
                </label>
            </div>
            <button
                type="button"
                class="preview"
                :disabled="!permissionAllowed || !midiEnabled"
                @pointerdown.prevent.stop="startPreview($event)"
                @pointerup.prevent.stop="stopPreview($event)"
                @pointerleave.prevent.stop="stopPreview($event)"
                @pointercancel.prevent.stop="stopPreview($event)"
            >♫ Preview</button>
            <div class="dialog-buttons">
                <button type="button" @click="closeEdit">Cancel</button>
                <button type="button" @click="saveEdit" :disabled="!isEditDirty">Save</button>
            </div>
        </form>
    </dialog>  
    
    <dialog ref="midiDialog">
        <form class="dialog-body" method="dialog" @submit.prevent>
            <div class="dialog-top">
                <h2 class="dialog-title">MIDI Settings</h2>
                <button type="button" class="dialog-close" @click="closeMidiDialog" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                    <span class="sr-only">Close</span>
                </button>
            </div>
            <div class="dialog-content edit-grid">
                <label>Output Port
                    <select v-model="midiModelOutputId">
                        <option v-for="output in outputs" :key="output.id" :value="output.id">{{ output.name }}</option>
                    </select>
                </label>
                <label>Channel
                    <select v-model.number="midiModelOutCh">
                        <option v-for="ch in 16" :key="ch" :value="ch">{{ ch }}</option>
                    </select>
                </label>
            </div>
            <div class="dialog-buttons">
                <button type="button" @click="closeMidiDialog">Close</button>
                <button type="button" @click="saveMidiDialog" :disabled="!isMidiDirty">Save</button>
            </div>
        </form>
    </dialog>

    
    
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { WebMidi } from 'webmidi'
import { Note, Chord, Key } from '@tonaljs/tonal'

const midiEnabled = ref(false)
const status = ref('Midi not enabled')
const permission = ref('unknown')
const outputs = ref([])
const selectedOutputId = ref('')
const selectedOutCh = ref(1)
const log = ref([])
const nowPlaying = ref('')
const lastActiveIdx = ref(null)
const permissionAllowed = computed(() => permission.value === 'granted')
const permissionPrompt = computed(() => permission.value === 'prompt')
function requestMidiPermission() {
    connectMidi()
}
// Render-friendly nowPlaying with lowercase flats
const nowPlayingHtml = computed(() => decorateFlats(nowPlaying.value))
// Track which pads are currently playing so we can stop them cleanly
// { [idx: number]: { notes: string[], outputId: string, channel: number } }
const activePads = ref({})
// active pitch classes for keyboard highlighting (lowercase, flats)
const activeKeySet = ref(new Set())

// MIDI settings dialog state
const midiDialog = ref(null)
const midiModelOutputId = ref('')
const midiModelOutCh = ref(1)
const MIDI_SETTINGS_KEY = 'midi-test:midi-settings'
const isMidiDirty = computed(() => {
    return selectedOutputId.value !== midiModelOutputId.value || Number(selectedOutCh.value) !== Number(midiModelOutCh.value)
})

function openMidiDialog() {
    // Seed dialog model from current selection
    midiModelOutputId.value = selectedOutputId.value || (outputs.value[0]?.id || '')
    midiModelOutCh.value = Number(selectedOutCh.value) || 1
    midiDialog.value?.showModal()
}
function closeMidiDialog() {
    midiDialog.value?.close()
}
function saveMidiDialog() {
    selectedOutputId.value = midiModelOutputId.value
    selectedOutCh.value = Number(midiModelOutCh.value) || 1
    try {
        localStorage.setItem(MIDI_SETTINGS_KEY, JSON.stringify({ outputId: selectedOutputId.value, channel: selectedOutCh.value }))
    } catch {}
    closeMidiDialog()
}

// Map tonal pitch classes to our CSS key classes (prefer flats over sharps)
function pcToCssKey(pc) {
    if (!pc) return ''
    // Common enharmonics
    if (pc === 'B#') pc = 'C'
    if (pc === 'E#') pc = 'F'
    if (pc === 'Cb') pc = 'B'
    if (pc === 'Fb') pc = 'E'
    const sharpToFlat = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' }
    pc = sharpToFlat[pc] || pc
    return pc.toLowerCase()
}

function updateActiveKeys() {
    const next = new Set()
    const padsMap = activePads.value || {}
    for (const k of Object.keys(padsMap)) {
        const notes = padsMap[k]?.notes || []
        for (const n of notes) {
            const pc = Note.pitchClass(n)
            if (pc) next.add(pcToCssKey(pc))
        }
    }
    activeKeySet.value = next
}

function isKeyActive(name) {
    return activeKeySet.value.has(String(name).toLowerCase())
}

// --- Enharmonic display helpers ---
const SHARP_TO_FLAT = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb', 'E#': 'F', 'B#': 'C' }
const FLAT_TO_SHARP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B', 'Fb': 'E' }

function preferFlatsForKey(root, type) {
    // Prefer flats for flat keys or neutral keys (C) for friendlier display
    if (!root) return true
    if (root.includes('b')) return true
    if (root.includes('#')) return false
    const FLAT_KEYS_MAJOR = new Set(['F','Bb','Eb','Ab','Db','Gb','Cb','C'])
    const SHARP_KEYS_MAJOR = new Set(['G','D','A','E','B','F#','C#'])
    // For minor, use a simple heuristic based on root accidental if present; otherwise map by common relatives
    if (type === 'minor') {
        // Heuristic: treat A,E,B as sharp side; D,G,C,F,Bb,Eb,Ab as flat/neutral side
        const minorSharpRoots = new Set(['E','B','F#','C#','G#','D#','A#'])
        if (minorSharpRoots.has(root)) return false
        return true
    }
    if (FLAT_KEYS_MAJOR.has(root)) return true
    if (SHARP_KEYS_MAJOR.has(root)) return false
    return true
}

function normalizePcForKey(pc, pad) {
    if (!pc) return pc
    const type = pad.mode === 'free' ? pad.scaleTypeFree : pad.scaleTypeScale
    const root = (pad.mode === 'free' ? pad.freeRoot : pad.scale)
    const preferFlats = preferFlatsForKey(root, type)
    if (preferFlats) {
        // Convert sharps to flats when appropriate
        return SHARP_TO_FLAT[pc] || pc
    } else {
        // Convert flats to sharps when appropriate
        return FLAT_TO_SHARP[pc] || pc
    }
}

// Given pitched notes like ["F#4","A4"], return display-normalized notes per pad's key, preserving octave
function formatNotesForDisplay(notesWithOctave, pad) {
    return notesWithOctave.map(n => {
        const m = String(n).match(/^(.*?)(-?\d+)$/)
        const pc = Note.pitchClass(n)
        if (!pc) return n
        const oct = m ? m[2] : ''
        const norm = normalizePcForKey(pc, pad)
        return `${norm}${oct}`
    })
}

// Normalize a chord symbol (e.g., "Ebbm", "Bbbdim") for display by simplifying root and applying key preference
function normalizeChordSymbolForKey(sym, scaleRoot, scaleType) {
    if (!sym || typeof sym !== 'string') return sym
    const m = sym.match(/^([A-G](?:#{1,2}|b{1,2})?)(.*)$/)
    if (!m) return sym
    let root = m[1]
    const suffix = m[2] || ''
    // Try to simplify double accidentals and awkward spellings
    let simple = Note.enharmonic(root)
    if (!simple || simple === root) {
        // @ts-ignore: simplify may not exist in older typings
        simple = (Note.simplify ? Note.simplify(root) : root) || root
    }
    // Apply accidental preference for the current key context (single accidentals only)
    const preferFlats = preferFlatsForKey(scaleRoot, scaleType)
    const mapped = preferFlats ? (SHARP_TO_FLAT[simple] || simple) : (FLAT_TO_SHARP[simple] || simple)
    return `${mapped}${suffix}`
}

function samePitchClass(a, b) {
    if (a === b) return true
    if (!a || !b) return false
    const ma = Note.midi(`${a}4`)
    const mb = Note.midi(`${b}4`)
    if (ma == null || mb == null) return false
    return (ma % 12) === (mb % 12)
}

// Stop all active pads and clear keyboard highlights
function stopAllActive() {
    Object.keys(activePads.value).forEach(idx => {
        const active = activePads.value[idx]
        const output = WebMidi.outputs.find(o => o.id === active?.outputId)
        if (output) {
            const ch = output.channels[active.channel]
            for (const n of active.notes) ch.sendNoteOff(n)
        }
        delete activePads.value[idx]
    })
    activeKeySet.value = new Set()
    lastActiveIdx.value = null
    nowPlaying.value = ''
}

// Per-pad chord state and editor
const MAJOR_KEYS = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
// Ableton-style enharmonic labels for scale select (value stays as our internal key spelling)
const MAJOR_KEY_OPTIONS = [
    { value: 'C',  label: 'C' },
    { value: 'Db', label: 'C#/Db' },
    { value: 'D',  label: 'D' },
    { value: 'Eb', label: 'D#/Eb' },
    { value: 'E',  label: 'E' },
    { value: 'F',  label: 'F' },
    { value: 'Gb', label: 'F#/Gb' },
    { value: 'G',  label: 'G' },
    { value: 'Ab', label: 'G#/Ab' },
    { value: 'A',  label: 'A' },
    { value: 'Bb', label: 'A#/Bb' },
    { value: 'B',  label: 'B' }
]
const MAJOR_DEGREES = ['I','ii','iii','IV','V','vi','vii°']
const MINOR_DEGREES = ['i','ii°','III','iv','v','VI','VII'] // natural minor
// Subset of voicings currently implemented in playback; used to filter UI options
const SUPPORTED_VOICINGS = ['triad','add2','6','7','add9','9','11','13','sus2','sus4']

// Valid voicings per chord family; filtered to those implemented in SUPPORTED_VOICINGS
function allowedVoicingsForChord(chordType) {
    const t = String(chordType || '').toLowerCase()
    let list = ['triad']
    if (t === 'major' || t === 'minor') {
        list = ['triad','add2','add9','6','7','9','11','13','sus2','sus4']
    } else if (t === 'dominant') {
        list = ['7','9','11','13','7sus4','7alt']
    } else if (t === 'diminished') {
        list = ['triad','7']
    } else if (t === 'augmented') {
        list = ['triad','add9','maj7']
    } else {
        list = ['triad']
    }
    return list.filter(v => SUPPORTED_VOICINGS.includes(v))
}

function defaultChord() {
    return {
        mode: 'scale',
        // Scale-mode fields
        scale: 'C',
        scaleTypeScale: 'major',
        voicingScale: 'triad',
        inversionScale: 'root',
        octaveScale: 4,
        degree: 'I',
        // Free-mode fields
        freeRoot: 'C',
        scaleTypeFree: 'major',
        voicingFree: 'triad',
        inversionFree: 'root',
        octaveFree: 4
    }
}
const STORAGE_KEY = 'midi-test:pads'

function sanitizePad(p) {
    const d = defaultChord()
    // constrain octave to 2..6 to avoid weird values
    const oSF = Math.min(6, Math.max(2, Number(p?.octaveScale ?? d.octaveScale)))
    const oFF = Math.min(6, Math.max(2, Number(p?.octaveFree ?? d.octaveFree)))
    return {
        mode: p?.mode === 'free' ? 'free' : 'scale',
        // scale-mode
        scale: typeof p?.scale === 'string' ? p.scale : d.scale,
        scaleTypeScale: p?.scaleTypeScale === 'minor' ? 'minor' : 'major',
        voicingScale: typeof p?.voicingScale === 'string' ? p.voicingScale : d.voicingScale,
        inversionScale: typeof p?.inversionScale === 'string' ? p.inversionScale : d.inversionScale,
        octaveScale: isFinite(oSF) ? oSF : d.octaveScale,
        degree: typeof p?.degree === 'string' ? p.degree : d.degree,
        // free-mode
        freeRoot: typeof p?.freeRoot === 'string' ? p.freeRoot : d.freeRoot,
        scaleTypeFree: p?.scaleTypeFree === 'minor' ? 'minor' : 'major',
        voicingFree: typeof p?.voicingFree === 'string' ? p.voicingFree : d.voicingFree,
        inversionFree: typeof p?.inversionFree === 'string' ? p.inversionFree : d.inversionFree,
        octaveFree: isFinite(oFF) ? oFF : d.octaveFree
    }
}

const PAD_COUNT = 10
function loadPadsFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const arr = JSON.parse(raw)
        if (!Array.isArray(arr)) return null
        // Always return PAD_COUNT pads, filling with defaults if needed
        return Array.from({ length: PAD_COUNT }, (_, i) => arr[i] ? sanitizePad(arr[i]) : defaultChord())
    } catch {
        return null
    }
}


const pads = ref(Array.from({ length: PAD_COUNT }, () => defaultChord()))

// On mount, always rehydrate pads from storage if available
onMounted(() => {
    const stored = loadPadsFromStorage()
    if (stored) {
        pads.value.splice(0, PAD_COUNT, ...stored)
    }
    // persist pads when they change (do NOT use immediate:true)
    watch(pads, (val) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
        } catch {}
    }, { deep: true })

    // Always refresh MIDI permission state on load
    updatePermissionStatus()

    window.addEventListener('blur', stopAllActive)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', stopAllActive)
})

const editDialog = ref(null)
const currentEditIndex = ref(0)
const editModel = ref(defaultChord())

// Mode-specific edit bindings so switching modes doesn't copy values between them
const editScaleType = computed({
    get: () => editModel.value.mode === 'free' ? editModel.value.scaleTypeFree : editModel.value.scaleTypeScale,
    set: (val) => {
        if (editModel.value.mode === 'free') editModel.value.scaleTypeFree = val
        else editModel.value.scaleTypeScale = val
    }
})
const editVoicing = computed({
    get: () => editModel.value.mode === 'free' ? editModel.value.voicingFree : editModel.value.voicingScale,
    set: (val) => {
        if (editModel.value.mode === 'free') editModel.value.voicingFree = val
        else editModel.value.voicingScale = val
    }
})
const editInversion = computed({
    get: () => editModel.value.mode === 'free' ? editModel.value.inversionFree : editModel.value.inversionScale,
    set: (val) => {
        if (editModel.value.mode === 'free') editModel.value.inversionFree = val
        else editModel.value.inversionScale = val
    }
})
const editOctave = computed({
    get: () => editModel.value.mode === 'free' ? editModel.value.octaveFree : editModel.value.octaveScale,
    set: (val) => {
        const v = Math.min(6, Math.max(2, Number(val) || 4))
        if (editModel.value.mode === 'free') editModel.value.octaveFree = v
        else editModel.value.octaveScale = v
    }
})
const isEditDirty = computed(() => {
    const pad = pads.value[currentEditIndex.value] || defaultChord()
    const m = editModel.value
    return (
        pad.mode !== m.mode ||
        pad.scale !== m.scale ||
        pad.freeRoot !== m.freeRoot ||
        pad.scaleTypeScale !== m.scaleTypeScale ||
        pad.scaleTypeFree !== m.scaleTypeFree ||
        pad.degree !== m.degree ||
        pad.voicingScale !== m.voicingScale ||
        pad.voicingFree !== m.voicingFree ||
        pad.inversionScale !== m.inversionScale ||
        pad.inversionFree !== m.inversionFree ||
        Number(pad.octaveScale) !== Number(m.octaveScale) ||
        Number(pad.octaveFree) !== Number(m.octaveFree)
    )
})

const editChordOptions = computed(() => {
    const scale = editModel.value.scale
    const type = editScaleType.value
    if (type === 'major') {
        const k = Key.majorKey(scale)
        return MAJOR_DEGREES.map((deg, i) => {
            const name = k.triads[i]
            const display = normalizeChordSymbolForKey(name, scale, type)
            return { degree: deg, name, display }
        })
    } else {
        const k = Key.minorKey(scale).natural
        return MINOR_DEGREES.map((deg, i) => {
            const name = k.triads[i]
            const display = normalizeChordSymbolForKey(name, scale, type)
            return { degree: deg, name, display }
        })
    }
})
const editInversions = computed(() => {
    const padLike = {
        ...editModel.value,
        voicingFree: editVoicing.value,
        voicingScale: editVoicing.value,
        scaleTypeFree: editScaleType.value,
        scaleTypeScale: editScaleType.value
    }
    const len = computeChordNotesFor(padLike).length
    return Array.from({ length: len }, (_, i) => i === 0 ? 'root' : ordinal(i))
})

// Dynamic classes for the MIDI status badge
const statusClass = computed(() => {
    const classes = ['midi-status']
    if (midiEnabled.value) {
        classes.push('enabled')
    } else if (/failed|error/i.test(status.value) || permission.value === 'denied') {
        classes.push('error')
    } else if (/request|enable|pending|wait/i.test(status.value) || permission.value === 'prompt') {
        classes.push('pending')
    } else {
        classes.push('disabled')
    }
    return classes
})

// Human-friendly status message for the badge
const statusDisplay = computed(() => {
    if (midiEnabled.value) return 'MIDI connected'
    if (permission.value === 'granted') return 'MIDI allowed — not connected'
    if (permission.value === 'prompt') return 'MIDI permission required'
    if (permission.value === 'denied') return 'MIDI denied'
    return status.value || 'MIDI not enabled'
})

function openEdit(idx) {
    currentEditIndex.value = idx
    const pad = pads.value[idx]
    // Step 1: set scale or root and mode-specific fields directly without copying between modes
    editModel.value.mode = pad.mode || 'free'
    editModel.value.scale = pad.scale
    editModel.value.freeRoot = pad.freeRoot || 'C'
    editModel.value.scaleTypeScale = pad.scaleTypeScale
    editModel.value.scaleTypeFree = pad.scaleTypeFree
    editModel.value.voicingScale = pad.voicingScale
    editModel.value.voicingFree = pad.voicingFree
    editModel.value.octaveScale = pad.octaveScale
    editModel.value.octaveFree = pad.octaveFree
    // Wait for computed options to update, then set degree and inversion
    nextTick(() => {
        editModel.value.degree = pad.degree
        editModel.value.inversionScale = pad.inversionScale
        editModel.value.inversionFree = pad.inversionFree
        // Force recompute of dependent computed properties by updating editModel
        editModel.value = { ...editModel.value }
        editDialog.value?.showModal()
    })
}
function closeEdit() {
    // Ensure any preview notes are stopped when closing the dialog
    try { stopPreview() } catch {}
    editDialog.value?.close()
}
function saveEdit() {
    pads.value[currentEditIndex.value] = { ...editModel.value }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pads.value))
    } catch {}
    closeEdit()
}


// Remove unused padLabel and chordSymbol

// Chord display with voicing (e.g., Dm7, Cadd9, G9)
function chordDisplay(pad) {
    const v = (pad.mode === 'free' ? pad.voicingFree : pad.voicingScale)
    let triadSymbol = ''
        if (pad?.mode === 'free') {
            const st = pad.scaleTypeFree
            triadSymbol = st === 'minor' ? `${pad.freeRoot}m` : `${pad.freeRoot}`
    } else {
        const type = pad.scaleTypeScale
        const degrees = type === 'major' ? MAJOR_DEGREES : MINOR_DEGREES
        const idx = degrees.indexOf(pad.degree)
        const keyInfo = type === 'major' ? Key.majorKey(pad.scale) : Key.minorKey(pad.scale).natural
        triadSymbol = keyInfo?.triads?.[idx] || pad.degree
    }
    // For sus chords, ignore m/maj quality in display and show e.g. Dsus2
    if (v === 'sus2' || v === 'sus4') {
        const info = Chord.get(triadSymbol)
        const rootPc = info.tonic || (info.notes?.[0] ? Note.pitchClass(info.notes[0]) : '') || ''
        return `${rootPc}${v}`
    }
    if (v === 'triad') return triadSymbol
    let suffix = ''
    if (v === '7') suffix = '7'
    else if (v === 'add9') suffix = 'add9'
    else if (v === 'add2') suffix = 'add2'
    else if (v === '6') suffix = '6'
    else if (v === '9' || v === '11' || v === '13') suffix = v
    return `${triadSymbol}${suffix}`
}

// Button label: e.g., Em 7 Inv 2 Oct 1
function padButtonLabel(pad) {
    // Compute notes as played
    const raw = computeChordNotesFor(pad)
    const invIdx = inversionIndex(pad.mode === 'free' ? pad.inversionFree : pad.inversionScale)
    const ordered = rotate(raw, invIdx)
    const baseOct = Number((pad.mode === 'free' ? pad.octaveFree : pad.octaveScale) ?? 4)
    const notesWithOctave = toAscendingWithOctave(ordered, baseOct)
    // Bass note is first note played (strip octave)
    const bass = Note.pitchClass(notesWithOctave[0])
    // Chord symbol with voicing
    const symbol = chordDisplay(pad)
    // Root note for this chord (from unrotated chord notes)
    const root = Note.pitchClass(raw[0])
    // Normalized bass for display according to key
    const bassDisplay = normalizePcForKey(bass, pad)
    // Show as e.g. Dm7 or Dm7/A with normalized enharmonics
    return samePitchClass(bass, root) ? symbol : `${symbol}/${bassDisplay}`
}

// Render-friendly label that keeps flats in lowercase (e.g., Bb)
function padButtonLabelHtml(pad) {
    const plain = padButtonLabel(pad)
    return decorateFlats(plain)
}

function decorateFlats(text) {
    if (!text) return ''
    // Replace note flats like Ab, Bb, Cb, Db, Eb, Fb, Gb including before suffixes (e.g., Dbm7)
    return text.replace(/([A-G])b/g, '$1<span class="acc-flat">b</span>')
}

function logMsg(msg) {
    log.value.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
    if (log.value.length > 100) log.value.shift()
}

function renderDevices() {
    outputs.value = WebMidi.outputs
    if (!selectedOutputId.value && outputs.value.length) selectedOutputId.value = outputs.value[0].id
}

function applySavedMidiSettings() {
    try {
        const raw = localStorage.getItem(MIDI_SETTINGS_KEY)
        if (!raw) return
        const obj = JSON.parse(raw)
        if (obj && typeof obj === 'object') {
            const exists = outputs.value.find(o => o.id === obj.outputId)
            if (exists) selectedOutputId.value = obj.outputId
            selectedOutCh.value = Number(obj.channel) || 1
        }
    } catch {}
}

function hasValidSavedMidiSettings() {
    try {
        const raw = localStorage.getItem(MIDI_SETTINGS_KEY)
        if (!raw) return false
        const obj = JSON.parse(raw)
        if (!obj || typeof obj !== 'object') return false
        const ch = Number(obj.channel)
        if (!obj.outputId || !(ch >= 1 && ch <= 16)) return false
        const exists = outputs.value.find(o => o.id === obj.outputId)
        return !!exists
    } catch {
        return false
    }
}

async function connectMidi() {
    try {
        status.value = 'Requesting MIDI access…'
        await WebMidi.enable()
        midiEnabled.value = true
        status.value = 'MIDI connected.'
        logMsg('MIDI access enabled')
        updatePermissionStatus()
        WebMidi.addListener('connected', (e) => {
            logMsg(`Connected: ${e.port.type} – ${e.port.name}`)
            renderDevices()
            applySavedMidiSettings()
        })
        WebMidi.addListener('disconnected', (e) => {
            logMsg(`Disconnected: ${e.port.type} – ${e.port.name}`)
            renderDevices()
        })
        renderDevices()
        applySavedMidiSettings()
        // Open settings dialog only if nothing valid was previously chosen
        if (!hasValidSavedMidiSettings()) {
            openMidiDialog()
        }
    } catch (err) {
        status.value = 'MIDI enable failed. See console.'
        logMsg(`Error enabling MIDI: ${err?.message || err}`)
    }
}

async function disconnectMidi() {
    try {
        // Stop any sustained notes first for safety
        stopAllActive()
        if (WebMidi?.enabled) {
            WebMidi.disable()
        }
    } catch (err) {
        logMsg(`Error disconnecting MIDI: ${err?.message || err}`)
    } finally {
        midiEnabled.value = false
        status.value = 'MIDI disconnected.'
        outputs.value = []
        selectedOutputId.value = ''
        activeKeySet.value = new Set()
    }
}

function getSelectedChannel() {
    const output = WebMidi.outputs.find(o => o.id === selectedOutputId.value)
    if (!output) return null
    const chNum = Number(selectedOutCh.value)
    const ch = output.channels[chNum]
    return { ch, output, chNum }
}

function startPad(idx, e) {
    if (activePads.value[idx]) return // already playing
    const pad = pads.value[idx]
    const raw = computeChordNotesFor(pad)
    const invIdx = inversionIndex(pad.mode === 'free' ? pad.inversionFree : pad.inversionScale)
    const ordered = rotate(raw, invIdx)
    const baseOct = Number((pad.mode === 'free' ? pad.octaveFree : pad.octaveScale) ?? 4)
    const notesWithOctave = toAscendingWithOctave(ordered, baseOct)
    const sel = getSelectedChannel()
    if (!sel) return
    // Ensure we capture this pointer so release is detected even if cursor leaves
    try { e?.target?.setPointerCapture?.(e.pointerId) } catch {}
    for (const n of notesWithOctave) sel.ch.sendNoteOn(n)
    activePads.value[idx] = { notes: notesWithOctave, outputId: sel.output.id, channel: sel.chNum }
    lastActiveIdx.value = idx
    nowPlaying.value = `${formatNotesForDisplay(notesWithOctave, pad).join(' ')}`
    updateActiveKeys()
    if (pad.mode === 'free') {
        logMsg(`Start ${idx+1}: [Free] ${pad.freeRoot} ${pad.scaleTypeFree} ${pad.voicingFree} ${pad.inversionFree} -> (${notesWithOctave.join(', ')}) on ${sel.output.name} ch${sel.chNum}`)
    } else {
        logMsg(`Start ${idx+1}: ${pad.scale} ${pad.scaleTypeScale} ${pad.degree} ${pad.voicingScale} ${pad.inversionScale} -> (${notesWithOctave.join(', ')}) on ${sel.output.name} ch${sel.chNum}`)
    }
}

function stopPad(idx, e) {
    const active = activePads.value[idx]
    if (!active) return
    // Release pointer capture if we have it
    try { e?.target?.releasePointerCapture?.(e.pointerId) } catch {}
    // Stop using the original output/channel used to start the pad (in case user switched outputs mid-hold)
    const output = WebMidi.outputs.find(o => o.id === active.outputId)
    if (output) {
        const ch = output.channels[active.channel]
        for (const n of active.notes) ch.sendNoteOff(n)
        logMsg(`Stop  ${idx+1}: (${active.notes.join(', ')}) on ${output.name} ch${active.channel}`)
    }
    delete activePads.value[idx]
    updateActiveKeys()
    if (lastActiveIdx.value === idx) {
        const remaining = Object.keys(activePads.value).map(n => Number(n)).sort((a,b)=>a-b)
        if (remaining.length) {
            const nextIdx = remaining[remaining.length - 1]
            lastActiveIdx.value = nextIdx
            const nextPad = pads.value[nextIdx]
            const nextNotes = activePads.value[nextIdx]?.notes || []
            nowPlaying.value = `${formatNotesForDisplay(nextNotes, nextPad).join(' ')}`
        } else {
            lastActiveIdx.value = null
            nowPlaying.value = ''
        }
    }
}


//

// --- Tonal helpers ---
function degreeIndex(deg, type) {
    return (type === 'major' ? MAJOR_DEGREES : MINOR_DEGREES).indexOf(deg)
}

function computeChordNotes(keyRoot, degree, voicing, scaleType) {
    const idx = degreeIndex(degree, scaleType)
    if (idx < 0) return []
    const keyInfo = scaleType === 'major' ? Key.majorKey(keyRoot) : Key.minorKey(keyRoot).natural
    const triadSymbol = keyInfo.triads[idx]
    const seventhSymbol = (keyInfo.chords && keyInfo.chords[idx]) || triadSymbol
    let baseSymbol = triadSymbol
    let baseNotes = []
    if (voicing === 'triad' || voicing === 'add9') {
        baseSymbol = triadSymbol
        baseNotes = Chord.get(triadSymbol).notes
    } else {
        baseSymbol = seventhSymbol
        baseNotes = Chord.get(seventhSymbol).notes
    }
    const root = Chord.get(baseSymbol).tonic || baseNotes[0]
    const tensions = []
    if (voicing === 'add9') tensions.push('9M')
    if (voicing === '9') tensions.push('9M')
    if (voicing === '11') tensions.push('9M','11P')
    if (voicing === '13') tensions.push('9M','11P','13M')
    const extra = root ? tensions.map(ivl => Note.transpose(root, ivl)) : []
    const all = [...baseNotes, ...extra]
    const seen = new Set()
    const unique = []
    for (const n of all) {
        const pc = Note.pitchClass(n)
        if (!seen.has(pc)) { seen.add(pc); unique.push(pc) }
    }
    return unique
}

// Respect pad.mode (scale vs free) when building chord notes
function computeChordNotesFor(pad) {
    const voicing = (pad.mode === 'free' ? pad.voicingFree : pad.voicingScale)
    let baseSymbol = ''
    if (pad?.mode === 'free') {
        const root = pad.freeRoot
        const st = pad.scaleTypeFree
        const triadSymbol = st === 'minor' ? `${root}m` : `${root}`
        const seventhSymbol = st === 'minor' ? `${root}m7` : `${root}maj7`
        baseSymbol = (['triad','add2','add9','6','sus2','sus4'].includes(voicing)) ? triadSymbol : seventhSymbol
    } else {
        const st = pad.scaleTypeScale
        const idx = degreeIndex(pad.degree, st)
        if (idx < 0) return []
        const keyInfo = st === 'major' ? Key.majorKey(pad.scale) : Key.minorKey(pad.scale).natural
        const triadSymbol = keyInfo.triads[idx]
        const seventhSymbol = (keyInfo.chords && keyInfo.chords[idx]) || triadSymbol
        baseSymbol = (['triad','add2','add9','6','sus2','sus4'].includes(voicing)) ? triadSymbol : seventhSymbol
    }
    let baseNotes = Chord.get(baseSymbol).notes
    const root = Chord.get(baseSymbol).tonic || baseNotes[0]
    // Handle sus chords by replacing the 3rd with 2 or 4
    if (voicing === 'sus2' || voicing === 'sus4') {
        const tonic = root
        if (tonic) {
            const second = Note.transpose(tonic, '2M') // major 2nd from root
            const fourth = Note.transpose(tonic, '4P') // perfect 4th from root
            // Build triad tones explicitly to reliably replace the third
            const fifth = Note.transpose(tonic, '5P')
            baseNotes = voicing === 'sus2' ? [tonic, second, fifth] : [tonic, fourth, fifth]
        }
    }
    // For add2, place the 2nd right above the root (not as a top add9)
    if (voicing === 'add2' && root) {
        const second = Note.transpose(root, '2M')
        const rootPc = Note.pitchClass(root)
        const secondPc = Note.pitchClass(second)
        const pcs = baseNotes.map(n => Note.pitchClass(n))
        const rest = pcs.filter(pc => pc !== rootPc && pc !== secondPc)
        baseNotes = [rootPc, secondPc, ...rest]
    }
    const tensions = []
    if (voicing === 'add9') tensions.push('9M')
    // add2 is handled by reordering baseNotes above; do not also append as a top tension
    if (voicing === '6') tensions.push('6M')
    if (voicing === '9') tensions.push('9M')
    if (voicing === '11') tensions.push('9M','11P')
    if (voicing === '13') tensions.push('9M','11P','13M')
    const extra = root ? tensions.map(ivl => Note.transpose(root, ivl)) : []
    const all = [...baseNotes, ...extra]
    const seen = new Set()
    const unique = []
    for (const n of all) {
        const pc = Note.pitchClass(n)
        if (!seen.has(pc)) { seen.add(pc); unique.push(pc) }
    }
    return unique
}

function inversionIndex(label) {
    if (label === 'root') return 0
    const m = label.match(/(\d+)/)
    return m ? Number(m[1]) : 0
}

function rotate(arr, k) {
    const n = arr.length
    if (!n) return []
    const r = ((k % n) + n) % n
    return arr.slice(r).concat(arr.slice(0, r))
}

function ordinal(n) {
    if (n === 1) return '1st'
    if (n === 2) return '2nd'
    if (n === 3) return '3rd'
    return `${n}th`
}

// Helper: ensure notes are strictly ascending by raising octaves as needed
function toAscendingWithOctave(pcs, baseOct = 4) {
    let lastMidi = -Infinity
    let currentOct = baseOct
    const result = []
    for (const pc of pcs) {
        const hasOct = /[0-9]$/.test(pc)
        let candidate = hasOct ? pc : `${pc}${currentOct}`
        let midi = Note.midi(candidate)
        if (midi == null) {
            // Try normalizing unicode accidentals if any
            const norm = pc.replace('♭', 'b').replace('♯', '#')
            candidate = hasOct ? pc : `${norm}${currentOct}`
            midi = Note.midi(candidate)
        }
        while (midi != null && midi <= lastMidi) {
            const m = candidate.match(/^(.*?)(-?\d+)$/)
            if (m) {
                const nextOct = Number(m[2]) + 1
                candidate = `${m[1]}${nextOct}`
            } else if (!hasOct) {
                currentOct += 1
                candidate = `${pc}${currentOct}`
            } else {
                break
            }
            midi = Note.midi(candidate)
        }
        const m2 = candidate.match(/^(.*?)(-?\d+)$/)
        if (m2 && !hasOct) currentOct = Number(m2[2])
        if (midi != null) lastMidi = midi
        result.push(candidate)
    }
    return result
}

async function updatePermissionStatus() {
    try {
        if (!('permissions' in navigator)) {
            permission.value = 'unsupported (Permissions API)'
            return
        }
        // @ts-ignore
        const statusObj = await navigator.permissions.query({ name: 'midi', sysex: false })
        permission.value = statusObj.state
        statusObj.onchange = () => {
            permission.value = statusObj.state
        }
    } catch (e) {
        permission.value = 'unknown'
    }
}

// --- Preview playback for chord dialog ---
function startPreview(e) {
    if (activePads.value['preview']) return
    const pad = editModel.value
    const padLike = {
        ...pad,
        voicingFree: editVoicing.value,
        voicingScale: editVoicing.value,
        scaleTypeFree: editScaleType.value,
        scaleTypeScale: editScaleType.value,
        inversionFree: editInversion.value,
        inversionScale: editInversion.value,
        octaveFree: editOctave.value,
        octaveScale: editOctave.value
    }
    const raw = computeChordNotesFor(padLike)
    const invIdx = inversionIndex(padLike.mode === 'free' ? padLike.inversionFree : padLike.inversionScale)
    const ordered = rotate(raw, invIdx)
    const baseOct = Number((padLike.mode === 'free' ? padLike.octaveFree : padLike.octaveScale) ?? 4)
    const notesWithOctave = toAscendingWithOctave(ordered, baseOct)
    const sel = getSelectedChannel()
    if (!sel) return
    try { e?.target?.setPointerCapture?.(e.pointerId) } catch {}
    for (const n of notesWithOctave) sel.ch.sendNoteOn(n)
    activePads.value['preview'] = { notes: notesWithOctave, outputId: sel.output.id, channel: sel.chNum }
    // Reflect preview notes in the background now-playing display
    nowPlaying.value = `${formatNotesForDisplay(notesWithOctave, padLike).join(' ')}`
    updateActiveKeys()
    if (padLike.mode === 'free') {
        logMsg(`Preview [Free]: ${padLike.freeRoot} ${padLike.scaleTypeFree} ${padLike.voicingFree} ${padLike.inversionFree} -> (${notesWithOctave.join(', ')}) on ${sel.output.name} ch${sel.chNum}`)
    } else {
        logMsg(`Preview: ${padLike.scale} ${padLike.scaleTypeScale} ${padLike.degree} ${padLike.voicingScale} ${padLike.inversionScale} -> (${notesWithOctave.join(', ')}) on ${sel.output.name} ch${sel.chNum}`)
    }
}

function stopPreview(e) {
    const active = activePads.value['preview']
    if (!active) return
    try { e?.target?.releasePointerCapture?.(e.pointerId) } catch {}
    const output = WebMidi.outputs.find(o => o.id === active.outputId)
    if (output) {
        const ch = output.channels[active.channel]
        for (const n of active.notes) ch.sendNoteOff(n)
        logMsg(`Stop preview: (${active.notes.join(', ')}) on ${output.name} ch${active.channel}`)
    }
    delete activePads.value['preview']
    updateActiveKeys()
    // Restore now-playing to last active pad (if any), otherwise clear
    if (lastActiveIdx.value != null && activePads.value[lastActiveIdx.value]) {
        const idx = lastActiveIdx.value
        const nextPad = pads.value[idx]
        const nextNotes = activePads.value[idx]?.notes || []
        nowPlaying.value = `${formatNotesForDisplay(nextNotes, nextPad).join(' ')}`
    } else {
        const remaining = Object.keys(activePads.value)
            .filter(k => k !== 'preview')
            .map(n => Number(n))
            .filter(n => Number.isInteger(n))
            .sort((a,b)=>a-b)
        if (remaining.length) {
            const nextIdx = remaining[remaining.length - 1]
            lastActiveIdx.value = nextIdx
            const nextPad = pads.value[nextIdx]
            const nextNotes = activePads.value[nextIdx]?.notes || []
            nowPlaying.value = `${formatNotesForDisplay(nextNotes, nextPad).join(' ')}`
        } else {
            lastActiveIdx.value = null
            nowPlaying.value = ''
        }
    }
}

// Safety: stop any sustained notes if the page loses focus or is closed
onBeforeUnmount(() => {
    stopAllActive()
    window.removeEventListener('blur', stopAllActive)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('beforeunload', stopAllActive)
})

function onVisibilityChange() {
    if (document.hidden) stopAllActive()
}
</script>
