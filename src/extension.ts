import * as vscode from "vscode";
import run from "./run";

const maxContentLength = 1000000;

const logger = {
  log(...args: any): void {
    console.log("{ MonCow }", ...args);
  }
};

async function createNewEditor(
  content: string = "",
  language: string = "jsonc"
): Promise<vscode.TextEditor> {
  const document = await vscode.workspace.openTextDocument({
    content,
    language
  });
  logger.log("Document created");
  const editor = await vscode.window.showTextDocument(
    document,
    vscode.ViewColumn.Beside,
    true
  );
  logger.log("Editor created");
  return editor;
}

function getMetaData(originEditor: vscode.TextEditor) {
  return {
    sourceFile: originEditor.document.uri.path,
    ranAt: new Date().toISOString()
  };
}

function truncateContent(content: string): string {
  if (content.length > maxContentLength) {
    const truncated = content.slice(0, maxContentLength);
    logger.log(
      `Result is ${content.length} characters, truncated to ${maxContentLength}`
    );
    return `// truncated to ${maxContentLength} characters\n${truncated}`;
  }
  return content;
}

async function runFile(originEditor: vscode.TextEditor): Promise<void> {
  try {
    const code = originEditor.document.getText().trim();
    if (!code.startsWith("// moncow")) {
      vscode.window.showInformationMessage(
        "File will not be executed unless it starts with `// moncow`"
      );
      return;
    }
    logger.log(`Run file ${originEditor.document.uri.path}`);
    const { sourceFile, ranAt } = getMetaData(originEditor);
    const { environments, result } = await run(code);
    const data = { sourceFile, ranAt, environments, result };
    await createNewEditor(truncateContent(JSON.stringify(data, null, "  ")));
  } catch (error) {
    logger.log("Failed to run file", error.stack);
    vscode.window.showInformationMessage(
      `Failed to run file. ${error.message}`
    );
  }
}

export async function activate({
  subscriptions
}: vscode.ExtensionContext): Promise<void> {
  subscriptions.push(
    vscode.commands.registerTextEditorCommand("moncow.runFile", runFile)
  );
}

export function deactivate(): void {}
