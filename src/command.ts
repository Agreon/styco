import { window, workspace, TextEditor, Range } from "vscode";
import { JSXElement } from "@babel/types";
import { parseDocument, IStyleAttribute } from "./util/parseDocument";
import { generateStyledComponent } from "./util/generateStyledComponent";
import { generateImportStatement } from "./util/generateImportStatement";

export const COMMAND_NAME = "extension.styco";

export const stycoCommand = async () => {
  const editor = window.activeTextEditor;

  if (!editor) {
    window.showInformationMessage(
      "Please only execute the command with an active file"
    );
    return;
  }

  const documentInformation = parseDocument(
    editor.document.getText(),
    editor.document.offsetAt(editor.selection.active)
  );

  const {
    selectedElement,
    elementName,
    insertPosition,
    styleAttr,
    importStatementExisting,
  } = documentInformation;

  const stycoName = await window.showInputBox({
    prompt: "Name: ",
    placeHolder: "Name of the component",
  });

  if (!stycoName) {
    window.showInformationMessage("Please enter a name");
    return;
  }
  const component = generateStyledComponent(elementName, stycoName, styleAttr);

  const importStatement =
    importStatementExisting ||
    workspace.getConfiguration("styco").get("insertImportStatement") === false
      ? null
      : await generateImportStatement(editor.document.uri);

  try {
    await modifyDocument(
      editor,
      component,
      importStatement,
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
  importStatement: string | null,
  insertPosition: number,
  oldElement: JSXElement,
  styleAttr: IStyleAttribute | null,
  stycoName: string
) => {
  const { document } = editor;
  const openName = oldElement.openingElement.name;
  const closeName = oldElement.closingElement?.name;

  await editor.edit(
    editBuilder => {
      // Insert import statement
      if (importStatement !== null) {
        editBuilder.insert(
          document.positionAt(insertPosition),
          `\n${importStatement}`
        );

        // Insert StyCo below
        editBuilder.insert(
          document.positionAt(insertPosition + 1),
          `\n${styledComponent}\n`
        );
      } else {
        // Insert StyCo
        editBuilder.insert(
          document.positionAt(insertPosition),
          `\n\n${styledComponent}\n`
        );
      }

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
      if (closeName !== undefined) {
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
