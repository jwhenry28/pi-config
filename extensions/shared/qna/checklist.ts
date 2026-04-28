import { Key, matchesKey } from "@mariozechner/pi-tui";
import type { QnAMode, QnAModeHost, RenderOptions } from "./component.js";

export class ChecklistMode implements QnAMode {
  constructor(
    private host: QnAModeHost,
    private index: number,
  ) {}

  saveAnswer(): void {
    this.host.answers[this.index] = this.formatAnswer();
  }

  prepareQuestion(): void {
    this.host.editor.setText("");
  }

  handleInput(data: string): void {
    if (this.moveSelection(data)) {
      this.host.invalidateAndRender();
      return;
    }

    if (data === " ") {
      this.toggleSelection();
      this.host.invalidateAndRender();
      return;
    }

    if (matchesKey(data, Key.enter)) {
      this.host.advanceOrConfirm();
      this.host.invalidateAndRender();
    }
  }

  renderAnswerArea(lines: string[], renderOptions: RenderOptions): void {
    const options = this.host.questions[this.index].options!;
    for (let i = 0; i < options.length; i++) {
      this.renderOption(lines, renderOptions, options[i], i);
    }
  }

  footerControls(): string {
    return `${this.host.dim("↑/↓")} select · ${this.host.dim("Space")} toggle · ${this.host.dim("Enter")} confirm · ${this.host.dim("Tab")} next · ${this.host.dim("Shift+Tab")} prev · ${this.host.dim("Esc")} cancel`;
  }

  private moveSelection(data: string): boolean {
    const optionCount = this.host.questions[this.index].options!.length;

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

  private toggleSelection(): void {
    const selected = this.host.checklistSelections[this.index];
    if (selected.has(this.host.selectedOption)) {
      selected.delete(this.host.selectedOption);
    } else {
      selected.add(this.host.selectedOption);
    }
    this.saveAnswer();
  }

  private formatAnswer(): string {
    const selected = this.host.checklistSelections[this.index];
    if (!selected || selected.size === 0) {
      return "User did not select any options.";
    }

    const options = this.host.questions[this.index].options ?? [];
    const selectedLines = [...selected]
      .sort((a, b) => a - b)
      .map((i) => ` - ${options[i]}`);

    return ["User selections:", ...selectedLines].join("\n");
  }

  private renderOption(lines: string[], renderOptions: RenderOptions, option: string, index: number): void {
    const isHighlighted = index === this.host.selectedOption;
    const isChecked = this.host.checklistSelections[this.index].has(index);
    const marker = `${isHighlighted ? this.host.cyan("❯") : " "} ${isChecked ? "[x]" : "[ ]"} `;
    const label = isHighlighted ? this.host.bold(option) : option;
    this.host.renderWrappedOption(lines, marker, label, renderOptions);
  }
}
