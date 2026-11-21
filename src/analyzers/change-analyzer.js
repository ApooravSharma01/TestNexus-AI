import { parsePatch } from "./diff-parser.js";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".go", ".sql"]);
const CONFIG_FILE_NAMES = new Set([
  "package.json",
  "package-lock.json",
  "go.mod",
  "go.sum",
  ".gitignore",
  ".env.example",
  "Dockerfile"
]);

function fileNameOf(filePath) {
  return filePath.split("/").pop();
}

function directoryOf(filePath) {
  const parts = filePath.split("/");
  parts.pop();
  return parts.join("/");
}

function extensionOf(fileName) {
  const dot = fileName.lastIndexOf(".");

  if (dot <= 0) {
    return "";
  }

  return fileName.slice(dot);
}

function isTestPath(filePath, fileName) {
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(fileName) || fileName.endsWith("_test.go")) {
    return true;
  }

  return filePath.split("/").slice(0, -1).some((segment) => {
    return segment === "test" || segment === "tests" || segment === "__tests__";
  });
}

function isConfiguration(filePath, fileName, extension) {
  if (CONFIG_FILE_NAMES.has(fileName)) {
    return true;
  }

  const segments = filePath.split("/");

  if (segments.includes(".github")) {
    return true;
  }

  return extension === ".yml" || extension === ".yaml";
}

function isDocumentation(filePath, extension) {
  if (extension === ".md") {
    return true;
  }

  return filePath.split("/").includes("docs");
}

export function classifyPath(filePath) {
  const fileName = fileNameOf(filePath);
  const extension = extensionOf(fileName);

  if (isTestPath(filePath, fileName)) {
    return "test";
  }

  if (isConfiguration(filePath, fileName, extension)) {
    return "configuration";
  }

  if (isDocumentation(filePath, extension)) {
    return "documentation";
  }

  if (SOURCE_EXTENSIONS.has(extension)) {
    return "source";
  }

  return "other";
}

function lineCount(hunks, key) {
  return hunks.reduce((total, hunk) => total + hunk[key].length, 0);
}

export function analyzeFile(file) {
  const hunks = parsePatch(file.patch);
  const additions = Number.isInteger(file.additions)
    ? file.additions
    : lineCount(hunks, "addedLines");
  const deletions = Number.isInteger(file.deletions)
    ? file.deletions
    : lineCount(hunks, "removedLines");

  return {
    path: file.path,
    previousPath: file.previousPath || null,
    status: file.status,
    category: classifyPath(file.path),
    directory: directoryOf(file.path),
    extension: extensionOf(fileNameOf(file.path)),
    additions,
    deletions,
    churn: additions + deletions,
    hunks
  };
}

export function analyzePullRequest(summary) {
  const files = summary.changedFiles.map(analyzeFile);
  const categories = {
    source: 0,
    test: 0,
    configuration: 0,
    documentation: 0,
    other: 0
  };

  for (const file of files) {
    categories[file.category] += 1;
  }

  return {
    number: summary.number,
    title: summary.title,
    state: summary.state,
    files,
    totals: {
      files: files.length,
      additions: files.reduce((total, file) => total + file.additions, 0),
      deletions: files.reduce((total, file) => total + file.deletions, 0),
      churn: files.reduce((total, file) => total + file.churn, 0)
    },
    categories,
    signals: {
      sourceChanged: categories.source > 0,
      testsChanged: categories.test > 0,
      configurationChanged: categories.configuration > 0,
      documentationOnly: files.length > 0 && categories.documentation === files.length
    }
  };
}
