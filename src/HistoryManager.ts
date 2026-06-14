import { HistoryAction } from './types';

// ОТМЕНА/ПОВТОР (undo/redo).
// Идея: каждое действие на доске (создать фигуру, подвинуть, нарисовать...) кладётся
// в стек как пара функций { undo, redo }. Ctrl+Z берёт верхнее и вызывает undo,
// Ctrl+Y — redo. Два стека: что можно отменить и что можно повторить.
export class HistoryManager {
  private undoStack: HistoryAction[] = [];   // выполненные действия (можно отменить)
  private redoStack: HistoryAction[] = [];   // отменённые действия (можно повторить)
  private maxSize = 200;                       // лимит истории, чтобы не росла бесконечно

  // записать новое действие; новое действие очищает стек redo (ветка истории сбрасывается)
  push(action: HistoryAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  // отменить последнее действие и переложить его в redo
  undo(): void {
    const action = this.undoStack.pop();
    if (!action) return;
    action.undo();
    this.redoStack.push(action);
  }

  // повторить последнее отменённое и вернуть его в undo
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
