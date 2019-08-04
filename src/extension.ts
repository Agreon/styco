import * as vscode from "vscode";

const findClosingTag = (textToCheck: string, pos: number, tagName: string) => {
  let depth: number = 0;

  let regex = new RegExp(
    "<(/?)(" + tagName + ")(?:\\s[^\\s>]*?[^\\s\\/>]+?)*?>",
    "g"
  );

  const text = textToCheck.substring(pos);

  let result = null;
  while ((result = regex.exec(text)) !== null) {
    // If is Opening-Tag
    if (result[1] === "") {
      depth++;
    } else {
      if (depth === 0) {
        return result.index + pos;
      }
      depth--;
    }
  }

  return null;
};

const hasTagChildren = (textToCheck: string, offset: number) => {
  const t = textToCheck.substring(offset);
  const matches = t.match(/(}([^{])*)>/g);

  if (!matches || !matches.length) {
    throw Error("Did not find the end of the current tag");
  }

  for (let i = 0; i < matches[0].length; i++) {
    if (matches[0][i] === ">" && i > 0) {
      if (matches[0][i - 1] === "/") {
        return false;
      } else {
        // Break as we already found the end of the tag
        return true;
      }
    }
  }

  return true;
};

const replaceTags = async (
  editor: vscode.TextEditor,
  cursorPositon: vscode.Position,
  oldTag: {
    name: string;
    position: number;
  },
  newTag: string
) => {
  const document = editor.document;

  let hasChildren = hasTagChildren(
    document.getText(),
    document.offsetAt(cursorPositon)
  );

  let pairedTagPos: number | null = null;

  if (hasChildren) {
    pairedTagPos = findClosingTag(
      document.getText(),
      document.offsetAt(cursorPositon),
      oldTag.name
    );

    if (!pairedTagPos) {
      throw Error("Did not find a matching closing tag");
    }
  }

  await editor.edit(
    editBuilder => {
      // Replace start-tag
      editBuilder.replace(
        new vscode.Range(
          document.positionAt(oldTag.position + 1), // + <
          document.positionAt(oldTag.position + oldTag.name.length + 1)
        ),
        newTag
      );
      if (hasChildren) {
        // Replace closing-tag
        editBuilder.replace(
          new vscode.Range(
            document.positionAt(pairedTagPos! + 1), // + <
            document.positionAt(pairedTagPos! + oldTag.name.length + 2) // + < + /
          ),
          "/" + newTag
        );
      }
    },
    { undoStopBefore: false, undoStopAfter: false }
  );
};

const camelCaseToKebabCase = (input: string) => {
  let output = "";
  for (let i = 0; i < input.length; i++) {
    if (input[i] === input[i].toUpperCase()) {
      output += "-" + input[i].toLowerCase();
      continue;
    }
    output += input[i];
  }

  return output;
};

// TODO: Only works for tsx
const findInsertPlace = (editor: vscode.TextEditor) => {
  const importRegex = /(import (.|\n)* from (.)*)/g;
  const text = editor.document.getText();
  let result = null;
  let matches = null;
  while ((result = importRegex.exec(text)) !== null) {
    matches = result;
  }
  if (!matches || !matches.length) {
    throw Error("Did not find a position to insert the component");
  }

  return editor.document.positionAt(matches.index + matches[0].length + 1);
};

const createStyco = async (
  editor: vscode.TextEditor,
  position: vscode.Position,
  oldTag: string,
  stycoName: string
) => {
  const regexStyleProp = /((\n)*( )*style=\{\{(.|\n)*?\}\})(\n)*( )*/g;
  const { document } = editor;
  const textAfterCursor = document
    .getText()
    .substring(document.offsetAt(position));

  const match = regexStyleProp.exec(textAfterCursor);

  if (!match || !match.length) {
    throw Error("Could not find style-prop");
  }

  const content = match[0];
  const styles = content
    .replace("style={{", "")
    .replace("}}", "")
    // Split at Last , (Also, if Only number is set it is recognized in first part)
    .split(/((: ([0-9]+),)|(('|"),))/g)
    .filter(s => s && s.trim().length > 2);

  if (!styles) {
    throw new Error("No styles found");
  }

  const transformedStyles = styles
    // Remove ',",\n
    .map(style => style.replace(/("|'|\n)/g, "").trim())
    // Transform camel-case
    .map(row => {
      const parts = row.trim().split(":");
      return `  ${camelCaseToKebabCase(parts[0])}:${parts[1]}`;
    })
    .join(";\n");

  const isStandardTag = oldTag[0] === oldTag[0].toLowerCase();

  const component = isStandardTag
    ? `\nconst ${stycoName} = styled.${oldTag}\`\n${transformedStyles};\n\`;\n`
    : `\nconst ${stycoName} = styled(${oldTag})\`\n${transformedStyles};\n\`;\n`;

  const insertPosition = findInsertPlace(editor);

  await editor.edit(
    editBuilder => {
      editBuilder.insert(insertPosition, component);

      // Remove old prop
      editBuilder.delete(
        new vscode.Range(
          document.positionAt(match.index + document.offsetAt(position)),
          document.positionAt(
            match.index + document.offsetAt(position) + match[0].length
          )
        )
      );
    },
    { undoStopBefore: false, undoStopAfter: false }
  );
};

const findTagNameAndPosition = (
  document: vscode.TextDocument,
  position: vscode.Position
) => {
  const regex = /[<]([^\s]*)/g;
  const matches = regex.exec(document.lineAt(position).text);

  if (!matches || matches.length !== 2) {
    return null;
  }
  return {
    name: matches[1],
    position: document.offsetAt(position) - (position.character - matches.index)
  };
};

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.styco",
    async () => {
      const inputOptions: vscode.InputBoxOptions = {
        prompt: "Name: ",
        placeHolder: "Name of the Styco"
      };

      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        return;
      }

      const cursorPosition = editor.selection.active;
      // Current tag
      const selectedTag = findTagNameAndPosition(
        editor.document,
        cursorPosition
      );

      if (!selectedTag || !selectedTag.name.length) {
        vscode.window.showInformationMessage("No tag to replace found");
        return;
      }

      const stycoName = await vscode.window.showInputBox(inputOptions);

      if (!stycoName) {
        return;
      }

      try {
        await replaceTags(editor, cursorPosition, selectedTag, stycoName);
        await createStyco(editor, cursorPosition, selectedTag.name, stycoName);

        await editor.document.save();
      } catch (error) {
        vscode.window.showInformationMessage(error.message);
      }
    }
  );

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
