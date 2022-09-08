import { workspace } from "vscode";
import { Property, IStyleAttribute } from "./parseDocument";
import generate from "@babel/generator";
import {
  variableDeclaration,
  variableDeclarator,
  identifier,
  taggedTemplateExpression,
  memberExpression,
  callExpression,
  templateLiteral,
  templateElement,
  objectExpression,
  objectProperty,
  stringLiteral,
} from "@babel/types";

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

const generateStyleBlock = (properties: Property[]) => {
  let stringifiedStyles = properties.map(prop => {
    return `  ${camelCaseToKebabCase(prop.key)}: ${prop.value}`;
  });

  if (workspace.getConfiguration("styco").get("orderStyleByName")) {
    stringifiedStyles = stringifiedStyles.sort();
  }

  return `\n${stringifiedStyles.join(";\n")};\n`;
};

export const generateStyledComponentWithObjectSyntax = (
  elementName: string,
  stycoName: string,
  styleAttr: IStyleAttribute | null
) =>
  generate(
    variableDeclaration("const", [
      variableDeclarator(
        identifier(stycoName),
        callExpression(
          // Is default tag? just concat with a '.', otherwise wrap with '()'
          elementName[0] === elementName[0].toLowerCase()
          ? memberExpression(identifier("styled"), identifier(elementName))
          : callExpression(identifier("styled"), [identifier(elementName)]),
          [
            objectExpression(styleAttr?.properties?.map(
              ({key, value}) =>  objectProperty(identifier(key), stringLiteral(value))
            ) ?? [])
          ]
        )
      ),
    ])
  ).code;



export const generateDefaultStyledComponent = (
  elementName: string,
  stycoName: string,
  styleAttr: IStyleAttribute | null
) => {
  const styleString =
    styleAttr !== null ? generateStyleBlock(styleAttr.properties) : "";

  return generate(
    variableDeclaration("const", [
      variableDeclarator(
        identifier(stycoName),
        taggedTemplateExpression(
          // Is default tag? just concat with a '.', otherwise wrap with '()'
          elementName[0] === elementName[0].toLowerCase()
            ? memberExpression(identifier("styled"), identifier(elementName))
            : callExpression(identifier("styled"), [identifier(elementName)]),
          templateLiteral([templateElement({ raw: styleString })], [])
        )
      ),
    ])
  ).code;
};

export const generateStyledComponent = (
  elementName: string,
  stycoName: string,
  styleAttr: IStyleAttribute | null
) => {
  if(workspace.getConfiguration("styco").get("objectSyntax")){
    return generateStyledComponentWithObjectSyntax(elementName, stycoName, styleAttr);
  }

  return generateDefaultStyledComponent(elementName, stycoName, styleAttr);
};
