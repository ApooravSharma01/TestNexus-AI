import { inflateRawSync } from "node:zlib";

// GitHub hands artifacts back as a zip file. Node has no zip reader built in,
// so this reads just enough of the format to pull one file out.
const END_OF_DIRECTORY = 0x06054b50;
const CENTRAL_ENTRY = 0x02014b50;
const LOCAL_ENTRY = 0x04034b50;

export function readZipEntry(buffer, wantedName) {
  let end = -1;

  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === END_OF_DIRECTORY) {
      end = index;
      break;
    }
  }

  if (end === -1) {
    throw new Error("Not a zip file");
  }

  const entryCount = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);

  for (let entry = 0; entry < entryCount; entry += 1) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL_ENTRY) {
      throw new Error("Zip directory is damaged");
    }

    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);

    if (name === wantedName) {
      if (buffer.readUInt32LE(localOffset) !== LOCAL_ENTRY) {
        throw new Error("Zip entry is damaged");
      }

      const dataStart = localOffset + 30
        + buffer.readUInt16LE(localOffset + 26)
        + buffer.readUInt16LE(localOffset + 28);
      const data = buffer.subarray(dataStart, dataStart + compressedSize);

      if (method === 0) {
        return data;
      }

      if (method === 8) {
        return inflateRawSync(data);
      }

      throw new Error(`Unsupported zip compression ${method}`);
    }

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`${wantedName} is not in the zip file`);
}

// Turns a Playwright JSON report into counts plus one row per test.
// The login setup step is not a real test, so it is left out of the counts.
export function summarizePlaywrightResults(report) {
  const tests = [];

  function walk(suite) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        if (test.projectName === "setup") {
          continue;
        }

        const lastResult = test.results?.[test.results.length - 1];
        tests.push({
          title: spec.title,
          file: spec.file,
          status: test.status === "expected" ? "passed"
            : test.status === "skipped" ? "skipped"
              : test.status === "flaky" ? "flaky" : "failed",
          durationMs: lastResult?.duration || 0
        });
      }
    }

    for (const child of suite.suites || []) {
      walk(child);
    }
  }

  for (const suite of report.suites || []) {
    walk(suite);
  }

  const count = (status) => tests.filter((test) => test.status === status).length;

  return {
    total: tests.length,
    passed: count("passed"),
    failed: count("failed"),
    flaky: count("flaky"),
    skipped: count("skipped"),
    tests
  };
}
