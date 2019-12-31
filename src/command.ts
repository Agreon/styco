import { window, workspace, TextEditor, Range } from "vscode";
import { JSXElement, JSXIdentifier } from "@babel/types";
import { parseDocument, IStyleAttribute } from "./parsing";
import { generateStyledComponent } from "./generation";

export const COMMAND_NAME = "extension.styco";

export const stycoCommand = async () => {
  const editor = window.activeTextEditor;

  if (!editor) {
    window.showInformationMessage(
      "Please only execute the command with an active file"
    );
    return;
  }

  const documentInformation = parseDocument(editor);
  if (!documentInformation) {
    window.showInformationMessage("Could not find element or style attribute");
    return;
  }

  const {
    selectedElement,
    elementName,
    insertPosition,
    styleAttr
  } = documentInformation;

  const stycoName = await window.showInputBox({
    prompt: "Name: ",
    placeHolder: "Name of the component"
  });

  if (!stycoName) {
    window.showInformationMessage("Please enter a name");
    return;
  }

  const component = generateStyledComponent(elementName, stycoName, styleAttr);

  try {
    await modifyDocument(
      editor,
      component,
      insertPosition,
      selectedElement,
      styleAttr,
      stycoName
    );
  } catch (e) {
    window.showInformationMessage("Could not update document");
    return;
  }

  if (workspace.getConfiguration("styco").get("saveAfterExecute")) {
    await editor.document.save();
  }
};

const modifyDocument = async (
  editor: TextEditor,
  styledComponent: string,
  insertPosition: number,
  oldElement: JSXElement,
  styleAttr: IStyleAttribute | null,
  stycoName: string
) => {
  const { document } = editor;
  const openName = oldElement.openingElement.name as JSXIdentifier;
  const closeName =
    oldElement.closingElement !== null
      ? (oldElement.closingElement.name as JSXIdentifier)
      : null;

  await editor.edit(
    editBuilder => {
      // Insert StyCo
      editBuilder.insert(
        editor.document.positionAt(insertPosition),
        `\n\n${styledComponent}`
      );

      // Remove style-attribute
      if (styleAttr !== null) {
        editBuilder.delete(
          new Range(
            document.positionAt(styleAttr.start!),
            document.positionAt(styleAttr.end!)
          )
        );
      }

      // Rename Opening Tag
      editBuilder.replace(
        new Range(
          document.positionAt(openName.start!),
          document.positionAt(openName.end!)
        ),
        stycoName
      );

      // Rename Closing Tag
      if (closeName !== null) {
        editBuilder.replace(
          new Range(
            document.positionAt(closeName.start!),
            document.positionAt(closeName.end!)
          ),
          stycoName
        );
      }
    },
    { undoStopBefore: false, undoStopAfter: false }
  );
};
