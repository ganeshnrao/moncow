import * as vscode from "vscode";
import * as moncow from "./moncow";
import boilerplate from "./boilerplate";

const maxContentLength: number = 1000000;
const mustStartWith: string = "// moncow";

async function createNewEditor(
  content: string = "",
  language: string = "jsonc",
  position: number = vscode.ViewColumn.Beside
): Promise<vscode.TextEditor> {
  const document: vscode.TextDocument = await vscode.workspace.openTextDocument({
    content,
    language
  });
  const editor: vscode.TextEditor = await vscode.window.showTextDocument(document, position, true);
  return editor;
}

function getMetaData(originEditor: vscode.TextEditor): { sourceFile: string; ranAt: string } {
  return {
    sourceFile: originEditor.document.uri.path,
    ranAt: new Date().toISOString()
  };
}

function truncate(content: string): string {
  if (content.length > maxContentLength) {
    const truncated: string = content.slice(0, maxContentLength);
    return [
      `// File was truncated to ${maxContentLength} from ${content.length} characters.`,
      "// Please consider tightening your query.",
      truncated
    ].join("\n");
  }
  return content;
}

async function runFile(originEditor: vscode.TextEditor): Promise<void> {
  try {
    const code: string = originEditor.document.getText().trim();
    if (!code.startsWith(mustStartWith)) {
      vscode.window.showInformationMessage(
        `File will not be executed unless it starts with ${mustStartWith}`
      );
      return;
    }
    const { sourceFile, ranAt } = getMetaData(originEditor);
    const { environments, result } = await moncow.run(code);
    const data = { sourceFile, ranAt, environments, result };
    await createNewEditor(truncate(JSON.stringify(data, null, "  ")));
  } catch (error) {
    vscode.window.showInformationMessage(`Failed to run file. ${error.message}`);
  }
}

async function updateSettings(event: vscode.ConfigurationChangeEvent): Promise<void> {
  if (event.affectsConfiguration("moncow")) {
    await moncow.initialize();
  }
}

async function showList(): Promise<void> {
  const connected = await moncow.showConnected();
  await createNewEditor(JSON.stringify({ connected }, null, "  "));
}

async function createFile(): Promise<void> {
  await createNewEditor(boilerplate, "javascript", vscode.ViewColumn.Active);
}

async function end(): Promise<void> {
  const result: string[] = await moncow.disconnectAll();
  vscode.window.showInformationMessage(
    `Ended ${result.length} connection(s).\n${result.join("\n")}`
  );
}

export async function activate({ subscriptions }: vscode.ExtensionContext): Promise<void> {
  await moncow.initialize();
  subscriptions.push(vscode.commands.registerTextEditorCommand("moncow.createFile", createFile));
  subscriptions.push(vscode.commands.registerTextEditorCommand("moncow.runFile", runFile));
  subscriptions.push(vscode.commands.registerTextEditorCommand("moncow.list", showList));
  subscriptions.push(vscode.commands.registerTextEditorCommand("moncow.end", end));
  subscriptions.push(vscode.workspace.onDidChangeConfiguration(updateSettings));
}

export function deactivate(): void {}
