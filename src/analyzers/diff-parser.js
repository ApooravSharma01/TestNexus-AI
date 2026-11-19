const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: (.*))?$/;

export function parsePatch(patch) {
  if (!patch) {
    return [];
  }

  const hunks = [];
  let current = null;

  for (const line of patch.split("\n")) {
    const header = HUNK_HEADER.exec(line);

    if (header) {
      current = {
        oldStart: Number(header[1]),
        oldLines: header[2] === undefined ? 1 : Number(header[2]),
        newStart: Number(header[3]),
        newLines: header[4] === undefined ? 1 : Number(header[4]),
        heading: header[5] || "",
        addedLines: [],
        removedLines: []
      };
      hunks.push(current);
      continue;
    }

    if (!current || line.startsWith("\\")) {
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      current.addedLines.push(line.slice(1));
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      current.removedLines.push(line.slice(1));
    }
  }

  return hunks;
}
