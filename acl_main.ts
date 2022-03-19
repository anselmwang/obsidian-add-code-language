import { App, Editor, FuzzySuggestModal, Notice, Plugin } from 'obsidian';

let LANGUAGES: string[] = [];

const GUESS_LANG_2_CODE_BLOCK_LANG_MAPPING: {[key: string]: string} = {
	"JavaScript": "javascript",
	"TypeScript": "typescript",
	"Python": "python",
	"Batchfile": "bash",
	"Shell": "bash",
	"YAML": "yaml",
	"JSON": "json",
}

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

// const CODE_BLOCK_RE = /```(\w*)\n(.*?)```/gs;
const CODE_BLOCK_RE = /(^\s*```)(\w*)\n(.*?)(^\s*```)/gms;
export default class AddCodeLanguagePlugin extends Plugin {
	async load_languages() {
		const lines = await this.app.vault.adapter.read(".obsidian/plugins/obsidian-add-code-language/languages.txt");
		LANGUAGES = lines.split("\n").map((value) => value.trim());
	}

	async onload() {
		this.load_languages();

		this.addCommand({
			id: 'add-language-for-current-block-manual',
			name: 'Add Language for Current Block (Manual)',
			editorCallback: (editor: Editor) => {
				const current_code_block = this.get_current_code_block(editor);
				if (current_code_block == null) {
					return ;
				}
				const { editor_start_pos, editor_end_pos, code } = current_code_block;
				new SelectLanguageModel(this.app, (language) => {
					const new_full_block = "```" + language + "\n" + code + "```";
					editor.replaceRange(new_full_block, editor_start_pos,
						editor_end_pos);
				}).open();
			}
		});

		this.addCommand({
			id: 'add-language-for-current-block-auto',
			name: 'Add Language for Current Block (Auto)',
			editorCallback: async (editor: Editor) => {
				const current_code_block = this.get_current_code_block(editor);
				if (current_code_block == null) {
					return ;
				}
				const { editor_start_pos, editor_end_pos, code } = current_code_block;
				const scores = (await this.doPost("http://localhost:5000/prob", { "code": code }))["scores"];
				console.log("guesslang scores:");
				console.log(scores);
				const filtered_scores = [];
				for (const score_entry of scores) {
					const language = score_entry[0];
					if (language in GUESS_LANG_2_CODE_BLOCK_LANG_MAPPING) {
						filtered_scores.push(score_entry);
					}
				}
				console.log("guesslang filtered_scores:");
				console.log(filtered_scores);

				if(filtered_scores.length == 0)
				{
					new Notice("filtered_scores is empty")
				}

				const language_from_guesslang = filtered_scores[0][0] as string;
				const language = GUESS_LANG_2_CODE_BLOCK_LANG_MAPPING[language_from_guesslang];
				const new_full_block = current_code_block.start_tag + language + "\n" + code + current_code_block.end_tag;
				editor.replaceRange(new_full_block, editor_start_pos,
					editor_end_pos);
			}
		});

		console.log("AddCodeLanguagePlugin load successfully.")
	}

	onunload() {

	}

	private get_current_code_block(editor: Editor) {
		const content = editor.getValue();
		const cur_pos = editor.posToOffset(editor.getCursor());
		console.log(`cur_pos: ${cur_pos}`);
		for (const match of content.matchAll(CODE_BLOCK_RE)) {
			const full_block = match[0];
			const code = match[3];
			const start_pos = match.index;
			const end_pos = match.index + full_block.length;
			console.log(`start_pos: ${start_pos}, end_pos: ${end_pos}`);
			console.log(`code: ${code}`)
			if (start_pos <= cur_pos && end_pos >= cur_pos && LANGUAGES.length != 0) {
				return {
					editor_start_pos: editor.offsetToPos(start_pos),
					editor_end_pos: editor.offsetToPos(end_pos),
					start_tag: match[1],
					end_tag: match[4],
					code
				}
			}
		}
		return null;
	}


	private async doPost(command_url: string, parameters: any) {
		const requestBody = JSON.stringify(parameters);

		const response = await fetch(command_url, {
			method: 'POST',
			body: requestBody,
			headers: {
				'content-type': 'application/json',
			},
		});
		const data = await response.json();
		console.info('response data', data);
		if (data.errors) {
			console.error(data);
			new Notification(data.message);
		}
		return data;
	}

}
