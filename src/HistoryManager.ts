import { HistoryAction } from './types';

// undo/redo. каждое действие кидаю в стек парой {undo, redo}
// ctrl+z — достаю верхнее и откатываю, ctrl+y — наоборот
export class HistoryManager {
  private undoStack: HistoryAction[] = [];   // что можно отменить
  private redoStack: HistoryAction[] = [];   // что можно вернуть
  private maxSize = 200;                       // чтоб не росло бесконечно

  // новое действие сбрасывает redo (пошла новая ветка)
  push(action: HistoryAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  // откат последнего, кидаю его в redo
  undo(): void {
    const action = this.undoStack.pop();
    if (!action) return;
    action.undo();
    this.redoStack.push(action);
  }

  // вернуть отменённое обратно
  redo(): void {
    const action = this.redoStack.pop();
    if (!action) return;
    action.redo();
    this.undoStack.push(action);
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
