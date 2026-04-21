/**
 * Shared interactive Q&A component for navigating and answering questions.
 *
 * Used by:
 * - `/answer` command (extracts questions from assistant messages)
 * - `ask_user` tool (batches concurrent agent questions)
 */

import {
  type Component,
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
  truncateToWidth,
  type TUI,
  visibleWidth,
  wrapTextWithAnsi,
} from "@mariozechner/pi-tui";

/** A question with optional context to display. */
export interface QnAQuestion {
  question: string;
  context?: string;
  /** If provided, show as multiple-choice options instead of free-text input. */
  options?: string[];
}

/** Result for a single answered question. */
export interface QnAAnswer {
  question: string;
  answer: string;
}

/**
 * Controls when the "Submit all answers?" confirmation is shown.
 * - `"always"` — always prompt before submitting
 * - `"multi"` — only when there are 2+ questions (default)
 * - `"never"` — submit immediately on the last Enter
 */
export type ConfirmMode = "always" | "multi" | "never";

/** Options for the QnA component. */
export interface QnAOptions {
  confirmMode?: ConfirmMode;
}

/**
 * Format Q&A answers into a human-readable string.
 */
export function formatAnswers(questions: QnAQuestion[], answers: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const a = answers[i]?.trim() || "(no answer)";
    parts.push(`Q: ${q.question}`);
    if (q.context) {
      parts.push(`> ${q.context}`);
    }
    parts.push(`A: ${a}`);
    parts.push("");
  }
  return parts.join("\n").trim();
}

/**
 * Interactive Q&A component for answering a list of questions.
 *
 * Renders a bordered box with progress dots, the current question, and an
 * editor for the answer. Supports Tab/Shift+Tab and Enter navigation.
 *
 * Calls `onDone` with an array of answer strings on submit, or `null` on cancel.
 */
export class QnAComponent implements Component {
  private questions: QnAQuestion[];
  private answers: string[];
  private currentIndex: number = 0;
  private editor: Editor;
  private tui: TUI;
  private onDone: (result: string[] | null) => void;
  private showingConfirmation: boolean = false;
  private selectedOption: number = 0;
  private confirmMode: ConfirmMode;
  /** Per-question override: when true, show free-text editor instead of options. */
  private freeTextOverride: boolean[];

  // Cache
  private cachedWidth?: number;
  private cachedLines?: string[];

  // Colors
  private dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
  private bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
  private cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
  private green = (s: string) => `\x1b[32m${s}\x1b[0m`;
  private yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
  private gray = (s: string) => `\x1b[90m${s}\x1b[0m`;

  constructor(
    questions: QnAQuestion[],
    tui: TUI,
    onDone: (result: string[] | null) => void,
    options?: QnAOptions,
  ) {
    this.questions = questions;
    this.answers = questions.map(() => "");
    this.freeTextOverride = questions.map(() => false);
    this.tui = tui;
    this.onDone = onDone;
    this.confirmMode = options?.confirmMode ?? "multi";

    const editorTheme: EditorTheme = {
      borderColor: this.dim,
      selectList: {
        selectedBg: (s: string) => `\x1b[44m${s}\x1b[0m`,
        matchHighlight: this.cyan,
        itemSecondary: this.gray,
      },
    };

    this.editor = new Editor(tui, editorTheme);
    this.editor.disableSubmit = true;
    this.editor.onChange = () => {
      this.invalidate();
      this.tui.requestRender();
    };
  }

  private isMultipleChoice(): boolean {
    if (this.freeTextOverride[this.currentIndex]) return false;
    const q = this.questions[this.currentIndex];
    return !!q.options && q.options.length > 0;
  }

  private saveCurrentAnswer(): void {
    if (this.isMultipleChoice()) {
      const opts = this.questions[this.currentIndex].options!;
      this.answers[this.currentIndex] = opts[this.selectedOption] ?? "";
    } else {
      this.answers[this.currentIndex] = this.editor.getText();
    }
  }

  private navigateTo(index: number): void {
    if (index < 0 || index >= this.questions.length) return;
    this.saveCurrentAnswer();
    this.currentIndex = index;
    this.selectedOption = 0;

    if (this.isMultipleChoice()) {
      // Pre-select previously chosen option
      const opts = this.questions[index].options!;
      const prev = this.answers[index];
      const prevIdx = opts.indexOf(prev);
      if (prevIdx >= 0) this.selectedOption = prevIdx;
      this.editor.setText("");
    } else {
      this.editor.setText(this.answers[index] || "");
    }
    this.invalidate();
  }

  private static readonly SOMETHING_ELSE = "Something else…";

  private submit(): void {
    this.saveCurrentAnswer();
    this.onDone([...this.answers]);
  }

  private cancel(): void {
    this.onDone(null);
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }

  handleInput(data: string): void {
    if (this.handleConfirmationInput(data)) return;
    if (this.handleGlobalNavigation(data)) return;

    if (this.isMultipleChoice()) {
      this.handleMultipleChoiceInput(data);
    } else {
      this.handleFreeTextInput(data);
    }
  }

  private handleConfirmationInput(data: string): boolean {
    if (!this.showingConfirmation) return false;

    if (matchesKey(data, Key.enter) || data.toLowerCase() === "y") {
      this.submit();
      return true;
    }
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c")) || data.toLowerCase() === "n") {
      this.showingConfirmation = false;
      this.invalidate();
      this.tui.requestRender();
      return true;
    }
    return true; // Consume all input during confirmation
  }

  private handleGlobalNavigation(data: string): boolean {
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.cancel();
      return true;
    }

    if (matchesKey(data, Key.tab)) {
      if (this.currentIndex < this.questions.length - 1) {
        this.navigateTo(this.currentIndex + 1);
        this.tui.requestRender();
      }
      return true;
    }
    if (matchesKey(data, Key.shift("tab"))) {
      if (this.currentIndex > 0) {
        this.navigateTo(this.currentIndex - 1);
        this.tui.requestRender();
      }
      return true;
    }

    return false;
  }

  private handleMultipleChoiceInput(data: string): void {
    const opts = this.questions[this.currentIndex].options!;
    const totalOptions = opts.length + 1; // +1 for "Something else…"

    if (matchesKey(data, Key.up)) {
      this.selectedOption = Math.max(0, this.selectedOption - 1);
    } else if (matchesKey(data, Key.down)) {
      this.selectedOption = Math.min(totalOptions - 1, this.selectedOption + 1);
    } else if (matchesKey(data, Key.enter)) {
      // "Something else…" is the last option
      if (this.selectedOption === opts.length) {
        this.freeTextOverride[this.currentIndex] = true;
        this.editor.setText(this.answers[this.currentIndex] || "");
        this.invalidate();
        this.tui.requestRender();
        return;
      }
      this.advanceOrConfirm();
    } else {
      return;
    }

    this.invalidate();
    this.tui.requestRender();
  }

  private handleFreeTextInput(data: string): void {
    if (matchesKey(data, Key.up) && this.editor.getText() === "") {
      if (this.currentIndex > 0) {
        this.navigateTo(this.currentIndex - 1);
        this.tui.requestRender();
        return;
      }
    }
    if (matchesKey(data, Key.down) && this.editor.getText() === "") {
      if (this.currentIndex < this.questions.length - 1) {
        this.navigateTo(this.currentIndex + 1);
        this.tui.requestRender();
        return;
      }
    }

    if (matchesKey(data, Key.enter) && !matchesKey(data, Key.shift("enter"))) {
      this.saveCurrentAnswer();
      this.advanceOrConfirm();
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    this.editor.handleInput(data);
    this.invalidate();
    this.tui.requestRender();
  }

  private shouldConfirm(): boolean {
    if (this.confirmMode === "always") return true;
    if (this.confirmMode === "never") return false;
    return this.questions.length > 1;
  }

  private advanceOrConfirm(): void {
    this.saveCurrentAnswer();
    if (this.currentIndex < this.questions.length - 1) {
      this.navigateTo(this.currentIndex + 1);
    } else if (this.shouldConfirm()) {
      this.showingConfirmation = true;
    } else {
      this.submit();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines: string[] = [];
    const boxWidth = Math.min(width - 4, 120);
    const contentWidth = boxWidth - 4;

    const horizontalLine = (count: number) => "─".repeat(count);

    const boxLine = (content: string, leftPad: number = 2): string => {
      const paddedContent = " ".repeat(leftPad) + content;
      const contentLen = visibleWidth(paddedContent);
      const rightPad = Math.max(0, boxWidth - contentLen - 2);
      return this.dim("│") + paddedContent + " ".repeat(rightPad) + this.dim("│");
    };

    const emptyBoxLine = (): string => {
      return this.dim("│") + " ".repeat(boxWidth - 2) + this.dim("│");
    };

    const padToWidth = (line: string): string => {
      const len = visibleWidth(line);
      return line + " ".repeat(Math.max(0, width - len));
    };

    // Title
    lines.push(padToWidth(this.dim("╭" + horizontalLine(boxWidth - 2) + "╮")));
    const title = `${this.bold(this.cyan("Questions"))} ${this.dim(`(${this.currentIndex + 1}/${this.questions.length})`)}`;
    lines.push(padToWidth(boxLine(title)));
    lines.push(padToWidth(this.dim("├" + horizontalLine(boxWidth - 2) + "┤")));

    // Progress dots
    const progressParts: string[] = [];
    for (let i = 0; i < this.questions.length; i++) {
      const answered = (this.answers[i]?.trim() || "").length > 0;
      const current = i === this.currentIndex;
      if (current) progressParts.push(this.cyan("●"));
      else if (answered) progressParts.push(this.green("●"));
      else progressParts.push(this.dim("○"));
    }
    lines.push(padToWidth(boxLine(progressParts.join(" "))));
    lines.push(padToWidth(emptyBoxLine()));

    // Current question
    const q = this.questions[this.currentIndex];
    const questionText = `${this.bold("Q:")} ${q.question}`;
    for (const line of wrapTextWithAnsi(questionText, contentWidth)) {
      lines.push(padToWidth(boxLine(line)));
    }

    // Context
    if (q.context) {
      lines.push(padToWidth(emptyBoxLine()));
      for (const line of wrapTextWithAnsi(this.gray(`> ${q.context}`), contentWidth - 2)) {
        lines.push(padToWidth(boxLine(line)));
      }
    }

    lines.push(padToWidth(emptyBoxLine()));

    // Answer area: multiple-choice or free-text editor
    if (this.isMultipleChoice()) {
      this.renderMultipleChoice(lines, q.options!, contentWidth, boxLine, padToWidth);
    } else {
      this.renderFreeTextEditor(lines, contentWidth, boxLine, padToWidth);
    }

    lines.push(padToWidth(emptyBoxLine()));

    // Footer
    lines.push(padToWidth(this.dim("├" + horizontalLine(boxWidth - 2) + "┤")));
    if (this.showingConfirmation) {
      const confirmMsg = `${this.yellow("Submit all answers?")} ${this.dim("(Enter/y to confirm, Esc/n to cancel)")}`;
      lines.push(padToWidth(boxLine(truncateToWidth(confirmMsg, contentWidth))));
    } else if (this.isMultipleChoice()) {
      const controls = `${this.dim("↑/↓")} select · ${this.dim("Enter")} confirm · ${this.dim("Tab")} next · ${this.dim("Shift+Tab")} prev · ${this.dim("Esc")} cancel`;
      lines.push(padToWidth(boxLine(truncateToWidth(controls, contentWidth))));
    } else {
      const controls = `${this.dim("Tab/Enter")} next · ${this.dim("Shift+Tab")} prev · ${this.dim("Shift+Enter")} newline · ${this.dim("Esc")} cancel`;
      lines.push(padToWidth(boxLine(truncateToWidth(controls, contentWidth))));
    }
    lines.push(padToWidth(this.dim("╰" + horizontalLine(boxWidth - 2) + "╯")));

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  private renderMultipleChoice(
    lines: string[],
    options: string[],
    contentWidth: number,
    boxLine: (content: string, leftPad?: number) => string,
    padToWidth: (line: string) => string,
  ): void {
    for (let i = 0; i < options.length; i++) {
      const selected = i === this.selectedOption;
      const marker = selected ? this.cyan("❯ ") : "  ";
      const label = selected ? this.bold(options[i]) : options[i];
      this.renderWrappedOption(lines, marker, label, contentWidth, boxLine, padToWidth);
    }

    const seSelected = this.selectedOption === options.length;
    const seMarker = seSelected ? this.cyan("❯ ") : "  ";
    const seLabel = seSelected
      ? this.bold(this.dim(QnAComponent.SOMETHING_ELSE))
      : this.dim(QnAComponent.SOMETHING_ELSE);
    this.renderWrappedOption(lines, seMarker, seLabel, contentWidth, boxLine, padToWidth);
  }

  private renderWrappedOption(
    lines: string[],
    marker: string,
    label: string,
    contentWidth: number,
    boxLine: (content: string, leftPad?: number) => string,
    padToWidth: (line: string) => string,
  ): void {
    const markerWidth = visibleWidth(marker);
    const wrappedLabelLines = wrapTextWithAnsi(label, Math.max(1, contentWidth - markerWidth));

    for (let i = 0; i < wrappedLabelLines.length; i++) {
      const prefix = i === 0 ? marker : " ".repeat(markerWidth);
      lines.push(padToWidth(boxLine(prefix + wrappedLabelLines[i])));
    }
  }

  private renderFreeTextEditor(
    lines: string[],
    contentWidth: number,
    boxLine: (content: string, leftPad?: number) => string,
    padToWidth: (line: string) => string,
  ): void {
    const answerPrefix = this.bold("A: ");
    const editorWidth = contentWidth - 4 - 3;
    const editorLines = this.editor.render(editorWidth);
    for (let i = 1; i < editorLines.length - 1; i++) {
      if (i === 1) {
        lines.push(padToWidth(boxLine(answerPrefix + editorLines[i])));
      } else {
        lines.push(padToWidth(boxLine("   " + editorLines[i])));
      }
    }
  }
}
