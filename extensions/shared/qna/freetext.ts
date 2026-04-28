import { Key, matchesKey } from "@mariozechner/pi-tui";
import type { QnAMode, QnAModeHost, RenderOptions } from "./component.js";

export class FreeTextMode implements QnAMode {
  constructor(
    private host: QnAModeHost,
    private index: number,
  ) {}

  saveAnswer(): void {
    this.host.answers[this.index] = this.host.editor.getText();
  }

  prepareQuestion(): void {
    this.host.editor.setText(this.host.answers[this.index] || "");
  }

  handleInput(data: string): void {
    if (this.navigateWithEmptyAnswer(data)) return;

    if (matchesKey(data, Key.enter) && !matchesKey(data, Key.shift("enter"))) {
      this.saveAnswer();
      this.host.advanceOrConfirm();
      this.host.invalidateAndRender();
      return;
    }

    this.host.editor.handleInput(data);
    this.host.invalidateAndRender();
  }

  renderAnswerArea(lines: string[], renderOptions: RenderOptions): void {
    const answerPrefix = this.host.bold("A: ");
    const editorWidth = renderOptions.contentWidth - 4 - 3;
    const editorLines = this.host.editor.render(editorWidth);
    for (let i = 1; i < editorLines.length - 1; i++) {
      const prefix = i === 1 ? answerPrefix : "   ";
      lines.push(renderOptions.padToWidth(renderOptions.boxLine(prefix + editorLines[i])));
    }
  }

  footerControls(): string {
    return `${this.host.dim("Tab/Enter")} next · ${this.host.dim("Shift+Tab")} prev · ${this.host.dim("Shift+Enter")} newline · ${this.host.dim("Esc")} cancel`;
  }

  private navigateWithEmptyAnswer(data: string): boolean {
    if (this.host.editor.getText() !== "") return false;

    if (matchesKey(data, Key.up) && this.index > 0) {
      this.host.navigateTo(this.index - 1);
      this.host.tui.requestRender();
      return true;
    }

    if (matchesKey(data, Key.down) && this.index < this.host.questions.length - 1) {
      this.host.navigateTo(this.index + 1);
      this.host.tui.requestRender();
      return true;
    }

    return false;
  }
}
