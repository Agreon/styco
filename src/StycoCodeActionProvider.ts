import {
  CodeActionProvider,
  TextDocument,
  Range,
  Selection,
  ProviderResult,
  Command,
  CodeAction,
  workspace
} from "vscode";
import { COMMAND_NAME } from "./command";

export class StycoCodeActionProvider implements CodeActionProvider {
  provideCodeActions(
    document: TextDocument,
    range: Range | Selection
  ): ProviderResult<(Command | CodeAction)[]> {
    if (
      workspace.getConfiguration("styco").get("disableCodeAction") ||
      !document.lineAt(range.start.line).text.includes("style={")
    ) {
      return;
    }

    const cmd = new CodeAction("Extract to styled component");
    cmd.command = { command: COMMAND_NAME, title: "Styco" };

    return [cmd];
  }
}
