import { App, Editor, FuzzySuggestModal, MarkdownView, Plugin } from 'obsidian';

let LANGUAGES: string[] = [];

type SelectLanguageFunction = (language: string) => void;
export class SelectLanguageModel extends FuzzySuggestModal<string> {
	callback: SelectLanguageFunction;

	constructor(app: App, callback: SelectLanguageFunction) {
		super(app);
		this.callback = callback;
	}
	getItems(): string[] {
		return LANGUAGES;
	}

	getItemText(item: string): string {
		return item;
	}

	onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
		this.callback(item);

	}
}

export default class AddCodeLanguagePlugin extends Plugin {
	async load_languages()
	{
		const lines = await this.app.vault.adapter.read(".obsidian/plugins/obsidian-add-code-language/languages.txt");
		LANGUAGES = lines.split("\n").map((value) => value.trim());
	}

	async onload() {
		const CODE_BLOCK_RE = /```(\w*)\n(.*?)```/gs;
		this.load_languages();

		this.addCommand({
			id: 'add-language-for-current-block',
			name: 'Add Language for Current Block',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const content = editor.getValue();
				const cur_pos = editor.posToOffset(editor.getCursor());
				console.log(`cur_pos: ${cur_pos}`);
				for (const match of content.matchAll(CODE_BLOCK_RE)) {
					const full_block = match[0];
					// const current_language = match[1];
					const code = match[2];
					const start_pos = match.index;
					const end_pos = match.index + full_block.length;
					console.log(`start_pos: ${start_pos}, end_pos: ${end_pos}`);
					if (start_pos <= cur_pos && end_pos >= cur_pos && LANGUAGES.length != 0) {
						new SelectLanguageModel(this.app, (language) => {
							const new_full_block = "```" + language + "\n" + code + "```";
							editor.replaceRange(new_full_block, editor.offsetToPos(start_pos),
								editor.offsetToPos(end_pos));

						}).open();
					}
				}
			}
		});
		console.log("AddCodeLanguagePlugin load successfully.")
	}

	onunload() {

	}

}
