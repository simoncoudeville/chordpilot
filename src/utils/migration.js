/**
 * Migration utilities for upgrading Chordboard data structures
 */

import { DEFAULT_EXTENSION } from "./chordSystem";

const LEGACY_PADS_KEY = "chordboard:pads";
const LEGACY_GLOBAL_SCALE_KEY = "chordboard:global-scale";

/**
 * Generates a simple unique ID based on timestamp
 * @returns {string} ID string
 */
function generateBoardId() {
  return `board-${Date.now()}`;
}

/**
 * Creates a default empty pad
 * @returns {object} Default pad object
 */
export function createDefaultPad() {
  return {
    mode: "unassigned",
    assigned: false,
    scale: {
      degree: "1",
      octave: 4,
      extension: DEFAULT_EXTENSION,
      inversion: "root",
      voicing: "close",
    },
    free: {
      root: "C",
      type: "major",
      accidental: null,
      octave: 4,
      extension: DEFAULT_EXTENSION,
      inversion: "root",
      voicing: "close",
    },
    settings: {
      x: "none",
      y: "none",
    },
  };
}

/**
 * Creates a default board object
 * @param {string} name - Board name
 * @returns {object} Board object
 */
function createDefaultBoard(name = "Board 1") {
  return {
    id: generateBoardId(),
    name,
    pads: Array.from({ length: 12 }, createDefaultPad),
    scale: {
      root: "C",
      type: "major",
      enabled: true,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Migrates old localStorage format to new board-based format
 * @returns {object} Migration result { boards, activeBoardId, migrated }
 */
export function migrateToBoards() {
  try {
    const legacyPads = localStorage.getItem(LEGACY_PADS_KEY);
    const legacyScale = localStorage.getItem(LEGACY_GLOBAL_SCALE_KEY);

    // If no legacy data, return empty boards
    if (!legacyPads && !legacyScale) {
      const initialBoards = [createDefaultBoard("Board 1")];
      return {
        boards: initialBoards,
        activeBoardId: initialBoards[0].id,
        migrated: false,
      };
    }

    // Parse legacy data
    const parsedPads = legacyPads ? JSON.parse(legacyPads) : [];
    const parsedScale = legacyScale ? JSON.parse(legacyScale) : null;

    // Create a board from legacy data
    const migratedBoard = createDefaultBoard("Default Board");

    if (Array.isArray(parsedPads)) {
      // Merge legacy pads with defaults
      migratedBoard.pads = migratedBoard.pads.map((defaultPad, i) => {
        if (i < parsedPads.length && parsedPads[i]) {
          return { ...defaultPad, ...parsedPads[i] };
        }
        return defaultPad;
      });
    }

    if (parsedScale && typeof parsedScale === "object") {
      migratedBoard.scale = {
        root: parsedScale.scale || "C",
        type: parsedScale.type || "major",
        enabled: parsedScale.enabled !== false,
      };
    }

    const boards = [migratedBoard];

    return {
      boards,
      activeBoardId: boards[0].id,
      migrated: true,
    };
  } catch (error) {
    console.warn("Migration failed, creating fresh board set:", error);
    const initialBoards = [createDefaultBoard("Board 1")];
    return {
      boards: initialBoards,
      activeBoardId: initialBoards[0].id,
      migrated: false,
    };
  }
}
