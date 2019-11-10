import * as vscode from "vscode";
import axios from "axios";

const editorMap: Map<vscode.TextEditor, vscode.TextEditor> = new Map();
const apiUrl: string = "http://localhost:2020/api";
const loading: string = JSON.stringify({ message: "Loading" }, null, "  ");

async function createNewEditor(
  content: string = "",
  language: string = "json"
): Promise<vscode.TextEditor> {
  const document = await vscode.workspace.openTextDocument({
    content,
    language
  });
  const editor = await vscode.window.showTextDocument(
    document,
    vscode.ViewColumn.Beside,
    true
  );
  return editor;
}

async function getLinkedEditor(
  originEditor: vscode.TextEditor
): Promise<vscode.TextEditor> {
  const editor: vscode.TextEditor | undefined = editorMap.get(originEditor);
  if (editor && vscode.window.visibleTextEditors.includes(editor)) {
    return editor;
  }
  const newEditor = await createNewEditor();
  editorMap.set(originEditor, newEditor);
  return newEditor;
}

async function replaceText(
  editor: vscode.TextEditor,
  content: string = ""
): Promise<vscode.TextEditor> {
  const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
  const firstLine = editor.document.lineAt(0);
  await editor.edit((editBuilder: vscode.TextEditorEdit) => {
    const range = new vscode.Range(firstLine.range.start, lastLine.range.end);
    editBuilder.replace(range, content);
  });
  return editor;
}

async function showResult(
  originEditor: vscode.TextEditor,
  content: string = ""
): Promise<vscode.TextEditor> {
  const linkedEditor = await getLinkedEditor(originEditor);
  await replaceText(linkedEditor, content);
  return linkedEditor;
}

async function runCommand(code: string = ""): Promise<string> {
  const { data } = await axios.request({
    method: "post",
    url: `${apiUrl}/run`,
    data: { code }
  });
  return JSON.stringify(data, null, "  ");
}

async function runFile(originEditor: vscode.TextEditor): Promise<void> {
  try {
    const code = originEditor.document.getText();
    if (code.indexOf("// moncow") !== 0) {
      vscode.window.showInformationMessage(
        "File will not be executed unless it starts with `// moncow`"
      );
      return;
    }
    await showResult(originEditor, loading);
    const result = await runCommand(code);
    await showResult(originEditor, result);
  } catch (error) {
    vscode.window.showInformationMessage(
      `Failed to execute file ${JSON.stringify(error.stack)}`
    );
  }
}

export function activate(): void {
  vscode.commands.registerTextEditorCommand("moncow.runFile", runFile);
}

export function deactivate(): void {
  console.log("MonCow deactivated");
}
