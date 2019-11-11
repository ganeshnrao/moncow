import * as vscode from "vscode";
import axios, { AxiosRequestConfig } from "axios";

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

async function runCommand(
  code: string = "",
  originEditor: vscode.TextEditor
): Promise<string> {
  const { sourceFile, ranAt } = getMetaData(originEditor);
  try {
    const requestConfig: AxiosRequestConfig = {
      method: "post",
      url: "/run",
      data: { code }
    };
    const {
      data: { environments, result, logs }
    } = await axios.request(requestConfig);
    const data = { sourceFile, ranAt, environments, result, logs };
    return JSON.stringify(data, null, "  ");
  } catch (error) {
    const {
      data: { errorMessage = "Failed to execute code", stack = [] } = {}
    } = error.response || {};
    return [
      `sourceFile: ${sourceFile}`,
      `ranAt: ${ranAt}\n`,
      errorMessage,
      ...stack
    ].join("\n");
  }
}

function truncateContent(content: string): string {
  if (content.length > maxContentLength) {
    const truncated = content.slice(0, maxContentLength);
    logger.log(
      `Result is ${content.length} characters, truncated to ${maxContentLength}`
    );
    return `// truncated to first ${maxContentLength} characters\n${truncated}`;
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
    const content = truncateContent(await runCommand(code, originEditor));
    await createNewEditor(content);
  } catch (error) {
    logger.log("Failed to run file", error.stack);
    vscode.window.showInformationMessage(
      `Failed to run file. ${error.message}`
    );
  }
}

function setAxiosBase(): void {
  axios.defaults.baseURL = vscode.workspace
    .getConfiguration()
    .get("moncow.apiUrl");
  logger.log(`Set base URL ${axios.defaults.baseURL}`);
}

export function activate({ subscriptions }: vscode.ExtensionContext): void {
  setAxiosBase();
  subscriptions.push(
    vscode.commands.registerTextEditorCommand("moncow.runFile", runFile)
  );
  subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(
      (event: vscode.ConfigurationChangeEvent) => {
        if (event.affectsConfiguration("moncow.apiUrl")) {
          setAxiosBase();
        }
      }
    )
  );
}

export function deactivate(): void {}
