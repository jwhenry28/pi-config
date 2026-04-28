import { registerStepCommand } from "./registry.js";
import { writeKey } from "../../memory/store.js";
import { getCwd } from "../../shared/cwd.js";
import { QnAComponent, type QnAQuestion } from "../../shared/qna/component.js";

registerStepCommand("ask-user", async (commandCtx, args) => {
	if (!args || Object.keys(args).length === 0) {
		throw new Error("ask-user: no questions provided in args");
	}

	const entries = Object.entries(args);
	const questions: QnAQuestion[] = entries.map(([_key, questionText]) => ({
		question: questionText,
	}));

	const answers = await commandCtx.ctx.ui.custom<string[] | null>(
		(tui, _theme, _kb, done) =>
			new QnAComponent(questions, tui, done, { confirmMode: "multi" }),
	);

	if (!answers) {
		throw new Error("ask-user: user dismissed the questions");
	}

	const cwd = getCwd(commandCtx);
	for (let i = 0; i < entries.length; i++) {
		const [key] = entries[i];
		writeKey(cwd, commandCtx.workflowId, key, answers[i] ?? "");
	}
});
