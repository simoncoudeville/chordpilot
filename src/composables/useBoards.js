/**
 * Vue 3 Composable for managing Chordboard boards
 */

import { ref, computed } from "vue";
import { migrateToBoards, createDefaultPad } from "../utils/migration";
import { useToast } from "./useToast";

const { showToast } = useToast();

const BOARDS_KEY = "chordboard:boards";
const ACTIVE_BOARD_KEY = "chordboard:active-board-id";

function generateBoardId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `board-${crypto.randomUUID()}`;
  }
  return `board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deepClone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

// Reactive state
const boards = ref([]);
const activeBoardId = ref(null);

/**
 * Initializes the boards system
 * Handles migration from legacy format if needed
 */
export function useBoards() {
  const loadBoards = () => {
    try {
      const stored = localStorage.getItem(BOARDS_KEY);

      if (stored) {
        boards.value = JSON.parse(stored);
        // Restore which board was active
        const storedActiveId = localStorage.getItem(ACTIVE_BOARD_KEY);
        if (
          storedActiveId &&
          boards.value.some((b) => b.id === storedActiveId)
        ) {
          activeBoardId.value = storedActiveId;
        } else if (boards.value.length > 0) {
          activeBoardId.value = boards.value[0].id;
        }
      } else {
        // No stored boards — run migration (handles legacy data and fresh install)
        const { boards: migratedBoards, activeBoardId: initialBoardId } =
          migrateToBoards();
        boards.value = migratedBoards;
        activeBoardId.value = initialBoardId;
        saveBoards();
        saveActiveBoardId();
      }
    } catch (error) {
      console.warn("Failed to load boards:", error);
      // Fallback to default
      const { boards: migratedBoards, activeBoardId: initialBoardId } =
        migrateToBoards();
      boards.value = migratedBoards;
      activeBoardId.value = initialBoardId;
    }
  };

  const saveBoards = () => {
    try {
      localStorage.setItem(BOARDS_KEY, JSON.stringify(boards.value));
    } catch (error) {
      console.error("Failed to save boards:", error);
      showToast("Could not save boards — storage may be full.");
    }
  };

  const saveActiveBoardId = () => {
    try {
      if (activeBoardId.value) {
        localStorage.setItem(ACTIVE_BOARD_KEY, activeBoardId.value);
      } else {
        localStorage.removeItem(ACTIVE_BOARD_KEY);
      }
    } catch (error) {
      console.error("Failed to save active board ID:", error);
      showToast("Could not save boards — storage may be full.");
    }
  };

  const activeBoard = computed(() => {
    return boards.value.find((b) => b.id === activeBoardId.value) || null;
  });

  const loadActiveBoard = () => {
    loadBoards();
    return activeBoard.value;
  };

  const setActiveBoard = (boardId) => {
    if (boards.value.some((b) => b.id === boardId)) {
      activeBoardId.value = boardId;
      saveActiveBoardId();
    }
  };

  const createBoard = (name = "New Board") => {
    const now = Date.now();
    const newBoard = {
      id: generateBoardId(),
      name,
      pads: Array.from({ length: 12 }, () => createDefaultPad()),
      scale: {
        root: "C",
        type: "major",
        enabled: true,
      },
      createdAt: now,
      updatedAt: now,
    };
    boards.value.push(newBoard);
    saveBoards();
    return newBoard;
  };

  const deleteBoard = (boardId) => {
    const index = boards.value.findIndex((b) => b.id === boardId);
    if (index !== -1) {
      boards.value.splice(index, 1);
      saveBoards();

      // If deleted board was active, switch to first remaining board
      if (activeBoardId.value === boardId && boards.value.length > 0) {
        setActiveBoard(boards.value[0].id);
      } else if (boards.value.length === 0) {
        activeBoardId.value = null;
        saveActiveBoardId();
      }
    }
  };

  const renameBoard = (boardId, newName) => {
    const board = boards.value.find((b) => b.id === boardId);
    if (board) {
      board.name = newName;
      board.updatedAt = Date.now();
      saveBoards();
    }
  };

  const duplicateBoard = (boardId) => {
    const original = boards.value.find((b) => b.id === boardId);
    if (!original) return null;

    const now = Date.now();
    const duplicated = {
      id: generateBoardId(),
      name: `${original.name} (copy)`,
      pads: deepClone(original.pads),
      scale: deepClone(original.scale),
      createdAt: now,
      updatedAt: now,
    };
    boards.value.push(duplicated);
    saveBoards();
    return duplicated;
  };

  const updateActiveBoardPads = (newPads) => {
    if (activeBoard.value) {
      activeBoard.value.pads = newPads;
      activeBoard.value.updatedAt = Date.now();
      saveBoards();
    }
  };

  const updateActiveBoardScale = (scale) => {
    if (activeBoard.value) {
      activeBoard.value.scale = scale;
      activeBoard.value.updatedAt = Date.now();
      saveBoards();
    }
  };

  return {
    boards: computed(() => boards.value),
    activeBoardId: computed(() => activeBoardId.value),
    activeBoard,
    loadBoards,
    loadActiveBoard,
    saveBoards,
    setActiveBoard,
    createBoard,
    deleteBoard,
    renameBoard,
    duplicateBoard,
    updateActiveBoardPads,
    updateActiveBoardScale,
  };
}
