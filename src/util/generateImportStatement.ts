import { posix } from "path";
import { TextDecoder } from "util";
import { Uri, workspace, FileType } from "vscode";
import generate from "@babel/generator";
import {
  importDeclaration,
  identifier,
  stringLiteral,
  importDefaultSpecifier,
  importSpecifier,
} from "@babel/types";

interface IStyleLibrary {
  packageName: string;
  importPath?: string;
  defaultImport?: boolean;
}

const supportedLibraries: IStyleLibrary[] = [
  {
    packageName: "styled-components",
    defaultImport: true,
  },
  {
    packageName: "@emotion/styled",
    defaultImport: true,
  },
  {
    packageName: "linaria",
    importPath: "linaria/react",
  },
];

/**
 * Searches the file tree recursive for the nearest package.json
 */
const findPackageJSONPath = async (folderUri: Uri): Promise<Uri | null> => {
  for (const [name, type] of await workspace.fs.readDirectory(folderUri)) {
    if (type === FileType.File && name === "package.json") {
      const filePath = posix.join(folderUri.path, name);
      return Uri.parse(filePath);
    }
  }

  const parentFolderPath = posix.dirname(folderUri.path);

  // We came to the top "/"
  if (parentFolderPath.length < 2) {
    return null;
  }

  const parentFolderUri = Uri.parse(parentFolderPath);

  return findPackageJSONPath(parentFolderUri);
};

const extractUsedStyleLibrary = async (
  fileUri: Uri
): Promise<IStyleLibrary | undefined> => {
  const content = await workspace.fs.readFile(fileUri);
  const jsonContent = JSON.parse(new TextDecoder("utf-8").decode(content));

  return supportedLibraries.find(lib =>
    Object.keys(jsonContent.dependencies).includes(lib.packageName)
  );
};

export const generateImportStatement = async (
  fileUri: Uri
): Promise<string | null> => {
  const folderPath = posix.dirname(fileUri.path);
  const folderUri = Uri.parse(folderPath);

  const packageJsonPath = await findPackageJSONPath(folderUri);

  if (packageJsonPath === null) {
    return null;
  }

  const usedStyleLibrary = await extractUsedStyleLibrary(packageJsonPath);

  if (usedStyleLibrary === undefined) {
    return null;
  }

  return generate(
    importDeclaration(
      [
        usedStyleLibrary.defaultImport
          ? importDefaultSpecifier(identifier("styled"))
          : importSpecifier(identifier("styled"), identifier("styled")),
      ],
      stringLiteral(usedStyleLibrary.importPath || usedStyleLibrary.packageName)
    )
  ).code;
};
