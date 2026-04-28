import { Key, matchesKey } from "@mariozechner/pi-tui";
import type { QnAMode, QnAModeHost, RenderOptions } from "./component.js";

const SOMETHING_ELSE = "Something else…";

export class SelectMode implements QnAMode {
  constructor(
    private host: QnAModeHost,
    private index: number,
  ) {}

  saveAnswer(): void {
    const options = this.host.questions[this.index].options!;
    this.host.answers[this.index] = options[this.host.selectedOption] ?? "";
  }

  prepareQuestion(): void {
    const options = this.host.questions[this.index].options!;
    const previousAnswer = this.host.answers[this.index];
    const previousIndex = options.indexOf(previousAnswer);
    if (previousIndex >= 0) this.host.selectedOption = previousIndex;
    this.host.editor.setText("");
  }

  handleInput(data: string): void {
    if (this.moveSelection(data)) {
      this.host.invalidateAndRender();
      return;
    }

    if (matchesKey(data, Key.enter)) {
      this.confirmSelection();
    }
  }

  renderAnswerArea(lines: string[], renderOptions: RenderOptions): void {
    const options = this.host.questions[this.index].options!;
    for (let i = 0; i < options.length; i++) {
      this.renderOption(lines, renderOptions, options[i], i);
    }
    this.renderSomethingElse(lines, renderOptions, options.length);
  }

  footerControls(): string {
    return `${this.host.dim("↑/↓")} select · ${this.host.dim("Enter")} confirm · ${this.host.dim("Tab")} next · ${this.host.dim("Shift+Tab")} prev · ${this.host.dim("Esc")} cancel`;
  }

  private moveSelection(data: string): boolean {
    const optionCount = this.host.questions[this.index].options!.length + 1;

    if (matchesKey(data, Key.up)) {
      this.host.selectedOption = Math.max(0, this.host.selectedOption - 1);
      return true;
    }
    if (matchesKey(data, Key.down)) {
      this.host.selectedOption = Math.min(optionCount - 1, this.host.selectedOption + 1);
      return true;
    }

    return false;
  }

  private confirmSelection(): void {
    const options = this.host.questions[this.index].options!;
    if (this.host.selectedOption === options.length) {
      this.switchToFreeText();
      return;
    }

    this.host.advanceOrConfirm();
    this.host.invalidateAndRender();
  }

  private switchToFreeText(): void {
    this.host.freeTextOverride[this.index] = true;
    this.host.editor.setText(this.host.answers[this.index] || "");
    this.host.invalidateAndRender();
  }

  private renderOption(lines: string[], renderOptions: RenderOptions, option: string, index: number): void {
    const isSelected = index === this.host.selectedOption;
    const marker = isSelected ? this.host.cyan("❯ ") : "  ";
    const label = isSelected ? this.host.bold(option) : option;
    this.host.renderWrappedOption(lines, marker, label, renderOptions);
  }

  private renderSomethingElse(lines: string[], renderOptions: RenderOptions, index: number): void {
    const isSelected = this.host.selectedOption === index;
    const marker = isSelected ? this.host.cyan("❯ ") : "  ";
    const label = isSelected
      ? this.host.bold(this.host.dim(SOMETHING_ELSE))
      : this.host.dim(SOMETHING_ELSE);
    this.host.renderWrappedOption(lines, marker, label, renderOptions);
  }
}
