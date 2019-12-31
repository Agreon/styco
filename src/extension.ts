import { commands, ExtensionContext, languages } from "vscode";
import { StycoCodeActionProvider } from "./StycoCodeActionProvider";
import { stycoCommand, COMMAND_NAME } from "./command";

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(COMMAND_NAME, stycoCommand),
    languages.registerCodeActionsProvider(
      ["javascriptreact", "typescriptreact"],
      new StycoCodeActionProvider()
    )
  );
}
