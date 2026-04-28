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
import { ChecklistMode } from "./checklist.js";
import { FreeTextMode } from "./freetext.js";
import { SelectMode } from "./select.js";

export type QnAQuestionType = "text" | "select" | "checklist";

/** A question with optional context to display. */
export interface QnAQuestion {
  question: string;
  context?: string;
  /**
   * Optional explicit question type.
   *
   * Backwards compatibility:
   * - omitted + options => single-select
   * - omitted + no options => free text
   */
  type?: QnAQuestionType;
  /** Options for select and checklist questions. */
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

export interface QnAMode {
  saveAnswer(): void;
  prepareQuestion(): void;
  handleInput(data: string): void;
  renderAnswerArea(
    lines: string[],
    options: RenderOptions,
  ): void;
  footerControls(): string;
}

export interface RenderOptions {
  contentWidth: number;
  boxLine: (content: string, leftPad?: number) => string;
  padToWidth: (line: string) => string;
}

export interface QnAModeHost {
  questions: QnAQuestion[];
  answers: string[];
  currentIndex: number;
  selectedOption: number;
  freeTextOverride: boolean[];
  checklistSelections: Set<number>[];
  editor: Editor;
  tui: TUI;
  dim: (s: string) => string;
  bold: (s: string) => string;
  cyan: (s: string) => string;
  renderWrappedOption(lines: string[], marker: string, label: string, options: RenderOptions): void;
  navigateTo(index: number): void;
  advanceOrConfirm(): void;
  invalidateAndRender(): void;
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
export class QnAComponent implements Component, QnAModeHost {
  questions: QnAQuestion[];
  answers: string[];
  currentIndex: number = 0;
  editor: Editor;
  tui: TUI;
  selectedOption: number = 0;
  freeTextOverride: boolean[];
  checklistSelections: Set<number>[];

  private onDone: (result: string[] | null) => void;
  private showingConfirmation: boolean = false;
  private confirmMode: ConfirmMode;

  // Cache
  private cachedWidth?: number;
  private cachedLines?: string[];

  // Colors
  dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
  bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
  cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
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
    this.checklistSelections = questions.map(() => new Set<number>());
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
    this.editor.onChange = () => this.invalidateAndRender();
  }

  private getQuestionType(index: number = this.currentIndex): QnAQuestionType {
    const q = this.questions[index];

    if (q.type === "text") return "text";

    const hasOptions = !!q.options && q.options.length > 0;
    if (q.type === "checklist" && hasOptions) return "checklist";
    if (q.type === "select" && hasOptions) return "select";
    if (!q.type && hasOptions) return "select";

    return "text";
  }

  private getMode(index: number = this.currentIndex): QnAMode {
    if (this.freeTextOverride[index]) return new FreeTextMode(this, index);

    const questionType = this.getQuestionType(index);
    if (questionType === "select") return new SelectMode(this, index);
    if (questionType === "checklist") return new ChecklistMode(this, index);
    return new FreeTextMode(this, index);
  }

  private saveCurrentAnswer(): void {
    this.getMode().saveAnswer();
  }

  navigateTo(index: number): void {
    if (index < 0 || index >= this.questions.length) return;

    this.saveCurrentAnswer();
    this.currentIndex = index;
    this.selectedOption = 0;
    this.getMode(index).prepareQuestion();
    this.invalidate();
  }

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

  invalidateAndRender(): void {
    this.invalidate();
    this.tui.requestRender();
  }

  handleInput(data: string): void {
    if (this.handleConfirmationInput(data)) return;
    if (this.handleGlobalNavigation(data)) return;

    this.getMode().handleInput(data);
  }

  private handleConfirmationInput(data: string): boolean {
    if (!this.showingConfirmation) return false;

    if (matchesKey(data, Key.enter) || data.toLowerCase() === "y") {
      this.submit();
      return true;
    }
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c")) || data.toLowerCase() === "n") {
      this.showingConfirmation = false;
      this.invalidateAndRender();
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
      this.navigateForward();
      return true;
    }
    if (matchesKey(data, Key.shift("tab"))) {
      this.navigateBackward();
      return true;
    }

    return false;
  }

  private navigateForward(): void {
    if (this.currentIndex >= this.questions.length - 1) return;

    this.navigateTo(this.currentIndex + 1);
    this.tui.requestRender();
  }

  private navigateBackward(): void {
    if (this.currentIndex <= 0) return;

    this.navigateTo(this.currentIndex - 1);
    this.tui.requestRender();
  }

  private shouldConfirm(): boolean {
    if (this.confirmMode === "always") return true;
    if (this.confirmMode === "never") return false;
    return this.questions.length > 1;
  }

  advanceOrConfirm(): void {
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

    const lines = this.renderFresh(width);
    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  private renderFresh(width: number): string[] {
    const lines: string[] = [];
    const boxWidth = Math.min(width - 4, 120);
    const contentWidth = boxWidth - 4;
    const renderOptions = this.createRenderOptions(width, boxWidth, contentWidth);

    this.renderHeader(lines, boxWidth, renderOptions);
    this.renderProgress(lines, renderOptions);
    this.renderQuestion(lines, contentWidth, renderOptions);
    this.renderAnswer(lines, renderOptions);
    this.renderFooter(lines, boxWidth, contentWidth, renderOptions);

    return lines;
  }

  private createRenderOptions(width: number, boxWidth: number, contentWidth: number): RenderOptions {
    const boxLine = (content: string, leftPad: number = 2): string => {
      const paddedContent = " ".repeat(leftPad) + content;
      const contentLen = visibleWidth(paddedContent);
      const rightPad = Math.max(0, boxWidth - contentLen - 2);
      return this.dim("│") + paddedContent + " ".repeat(rightPad) + this.dim("│");
    };

    return {
      contentWidth,
      boxLine,
      padToWidth: (line: string) => line + " ".repeat(Math.max(0, width - visibleWidth(line))),
    };
  }

  private renderHeader(lines: string[], boxWidth: number, options: RenderOptions): void {
    lines.push(options.padToWidth(this.dim("╭" + this.horizontalLine(boxWidth) + "╮")));
    const title = `${this.bold(this.cyan("Questions"))} ${this.dim(`(${this.currentIndex + 1}/${this.questions.length})`)}`;
    lines.push(options.padToWidth(options.boxLine(title)));
    lines.push(options.padToWidth(this.dim("├" + this.horizontalLine(boxWidth) + "┤")));
  }

  private renderProgress(lines: string[], options: RenderOptions): void {
    const progressParts = this.questions.map((_question, index) => this.getProgressDot(index));
    lines.push(options.padToWidth(options.boxLine(progressParts.join(" "))));
    this.renderEmptyLine(lines, options);
  }

  private getProgressDot(index: number): string {
    const isAnswered = (this.answers[index]?.trim() || "").length > 0;
    if (index === this.currentIndex) return this.cyan("●");
    if (isAnswered) return this.green("●");
    return this.dim("○");
  }

  private renderQuestion(lines: string[], contentWidth: number, options: RenderOptions): void {
    const q = this.questions[this.currentIndex];
    const questionText = `${this.bold("Q:")} ${q.question}`;
    for (const line of wrapTextWithAnsi(questionText, contentWidth)) {
      lines.push(options.padToWidth(options.boxLine(line)));
    }

    if (q.context) {
      this.renderEmptyLine(lines, options);
      for (const line of wrapTextWithAnsi(this.gray(`> ${q.context}`), contentWidth - 2)) {
        lines.push(options.padToWidth(options.boxLine(line)));
      }
    }
  }

  private renderAnswer(lines: string[], options: RenderOptions): void {
    this.renderEmptyLine(lines, options);
    this.getMode().renderAnswerArea(lines, options);
    this.renderEmptyLine(lines, options);
  }

  private renderFooter(lines: string[], boxWidth: number, contentWidth: number, options: RenderOptions): void {
    lines.push(options.padToWidth(this.dim("├" + this.horizontalLine(boxWidth) + "┤")));
    const footer = this.getFooterText();
    lines.push(options.padToWidth(options.boxLine(truncateToWidth(footer, contentWidth))));
    lines.push(options.padToWidth(this.dim("╰" + this.horizontalLine(boxWidth) + "╯")));
  }

  private getFooterText(): string {
    if (this.showingConfirmation) {
      return `${this.yellow("Submit all answers?")} ${this.dim("(Enter/y to confirm, Esc/n to cancel)")}`;
    }

    return this.getMode().footerControls();
  }

  renderWrappedOption(lines: string[], marker: string, label: string, options: RenderOptions): void {
    const markerWidth = visibleWidth(marker);
    const wrappedLabelLines = wrapTextWithAnsi(label, Math.max(1, options.contentWidth - markerWidth));

    for (let i = 0; i < wrappedLabelLines.length; i++) {
      const prefix = i === 0 ? marker : " ".repeat(markerWidth);
      lines.push(options.padToWidth(options.boxLine(prefix + wrappedLabelLines[i])));
    }
  }

  private renderEmptyLine(lines: string[], options: RenderOptions): void {
    lines.push(options.padToWidth(options.boxLine("", 0)));
  }

  private horizontalLine(boxWidth: number): string {
    return "─".repeat(boxWidth - 2);
  }
}
