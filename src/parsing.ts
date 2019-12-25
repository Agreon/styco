import { TextEditor } from "vscode";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import {
  JSXElement,
  File,
  JSXIdentifier,
  JSXAttribute,
  ObjectProperty,
  StringLiteral
} from "@babel/types";

export type Property = { key: string; value: string };

export interface IStyleAttribute {
  start: number;
  end: number;
  properties: Property[];
}

const findTagAndInsertPosition = (editor: TextEditor, file: File) => {
  const pos = editor.document.offsetAt(editor.selection.active);

  let selectedElement: JSXElement | undefined;
  let insertPosition: number = 0;

  traverse(file, {
    JSXElement: enter => {
      if (enter.node.start === null || enter.node.start > pos) {
        return;
      }
      if (
        selectedElement === undefined ||
        enter.node.start > selectedElement.start!
      ) {
        selectedElement = enter.node;
      }
    },
    // Just find last Import Statement
    ImportDeclaration: enter => {
      if (enter.node.end !== null) {
        insertPosition = enter.node.end;
      }
    }
  });

  return { selectedElement, insertPosition };
};

const getStyleAttribute = (element: JSXElement): IStyleAttribute | null => {
  const styleAttr = element.openingElement.attributes.find(
    a => a.type === "JSXAttribute" && a.name.name === "style"
  ) as JSXAttribute | undefined;

  if (
    !styleAttr ||
    !styleAttr.value ||
    styleAttr.value.type !== "JSXExpressionContainer" ||
    styleAttr.value.expression.type !== "ObjectExpression"
  ) {
    return null;
  }

  // Transform properties
  const properties = (styleAttr.value.expression.properties.filter(
    p => p.type === "ObjectProperty" && p.value.type === "StringLiteral"
  ) as ObjectProperty[]).map(p => ({
    key: p.key.name as string,
    value: (p.value as StringLiteral).value
  }));

  return {
    start: styleAttr.start!,
    end: styleAttr.end!,
    properties
  };
};

export const parseDocument = (editor: TextEditor) => {
  try {
    const file = parse(editor.document.getText(), {
      sourceType: "module",
      plugins: ["jsx", "typescript"]
    });

    const { selectedElement, insertPosition } = findTagAndInsertPosition(
      editor,
      file
    );

    if (selectedElement === undefined) {
      throw new Error("Could not find element");
    }

    const elementName = (selectedElement.openingElement.name as JSXIdentifier)
      .name;

    const styleAttr = getStyleAttribute(selectedElement);

    return {
      selectedElement,
      elementName,
      insertPosition,
      styleAttr
    };
  } catch (e) {
    return null;
  }
};
