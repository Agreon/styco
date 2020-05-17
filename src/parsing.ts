import { parse, ParserOptions } from "@babel/parser";
import traverse from "@babel/traverse";
import {
  JSXElement,
  File,
  JSXIdentifier,
  JSXAttribute,
  ObjectProperty,
  StringLiteral,
} from "@babel/types";

const babelOptions: ParserOptions = {
  sourceType: "module",
  plugins: [
    "jsx",
    "typescript",
    ["decorators", { decoratorsBeforeExport: true }],
    "classProperties",
    "optionalChaining",
    "nullishCoalescingOperator",
  ],
};

export type Property = { key: string; value: string };

export interface IStyleAttribute {
  start: number;
  end: number;
  properties: Property[];
}

const findTagAndInsertPosition = (file: File, offset: number) => {
  let selectedElement: JSXElement | undefined;
  let insertPosition: number = 0;
  traverse(file, {
    JSXElement: enter => {
      if (enter.node.start === null || enter.node.start > offset) {
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
    },
  });

  return { selectedElement, insertPosition };
};

const supportedValueTypes = [
  "StringLiteral" || "NumericLiteral",
  "TemplateLiteral",
];

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

  // Filter and transform properties
  const properties = (styleAttr.value.expression.properties.filter(
    p =>
      p.type === "ObjectProperty" && supportedValueTypes.includes(p.value.type)
  ) as ObjectProperty[]).map(p => ({
    key: p.key.name as string,
    value:
      p.value.type === "TemplateLiteral"
        ? p.value.quasis.map(el => el.value.raw).join("")
        : (p.value as StringLiteral).value,
  }));

  return {
    start: styleAttr.start!,
    end: styleAttr.end!,
    properties,
  };
};

export const parseDocument = (text: string, currentOffset: number) => {
  const file = parse(text, babelOptions);

  const { selectedElement, insertPosition } = findTagAndInsertPosition(
    file,
    currentOffset
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
    styleAttr,
  };
};
