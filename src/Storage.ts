import { TFile, Vault } from 'obsidian';
import { BoardData, DEFAULT_SETTINGS } from './types';

export const BOARD_EXTENSION = 'board.json';

export function createEmptyBoard(): BoardData {
  return {
    version: 1,
    nodes: [],
    connectors: [],
    strokes: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    laserParams: { ...DEFAULT_SETTINGS.laserParams },
  };
}

export async function saveBoard(vault: Vault, path: string, data: BoardData): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const existing = vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await vault.modify(existing, json);
  } else {
    await vault.create(path, json);
  }
}

export async function loadBoard(vault: Vault, path: string): Promise<BoardData> {
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    return createEmptyBoard();
  }
  const content = await vault.read(file);
  try {
    const data = JSON.parse(content) as BoardData;
    return data;
  } catch {
    return createEmptyBoard();
  }
}
