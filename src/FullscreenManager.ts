export class FullscreenManager {
  private isFullscreen = false;
  private containerEl: HTMLElement;
  private savedStyles: { overflow: string; position: string } | null = null;

  onToggle: ((fs: boolean) => void) | null = null;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }

  toggle(): void {
    if (this.isFullscreen) this.exit();
    else this.enter();
  }

  enter(): void {
    if (this.isFullscreen) return;
    this.isFullscreen = true;

    const workspace = document.querySelector('.workspace') as HTMLElement | null;
    if (workspace) {
      this.savedStyles = {
        overflow: workspace.style.overflow,
        position: workspace.style.position,
      };
    }

    document.body.querySelectorAll<HTMLElement>(
      '.workspace-split.mod-left-split, .workspace-split.mod-right-split, .workspace-tab-header-container'
    ).forEach(el => el.style.display = 'none');

    this.containerEl.classList.add('ib-fullscreen');
    this.onToggle?.(true);
  }

  exit(): void {
    if (!this.isFullscreen) return;
    this.isFullscreen = false;

    document.body.querySelectorAll<HTMLElement>(
      '.workspace-split.mod-left-split, .workspace-split.mod-right-split, .workspace-tab-header-container'
    ).forEach(el => el.style.display = '');

    this.containerEl.classList.remove('ib-fullscreen');
    this.onToggle?.(false);
  }

  getState(): boolean {
    return this.isFullscreen;
  }
}
