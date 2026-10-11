const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
// Compile the dependency-free validation module without creating build artifacts.
const code = ts.transpileModule(fs.readFileSync("src/lib/proposals.ts", "utf8"), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;
const exportsObject = {};
vm.runInNewContext(code, {exports: exportsObject, Date, Array, Error});
const {proposalError, parseAnalysis, validDate, apiError, localToday} = exportsObject;
const proposal = {title: "Entrega", description: "", due_date: "2026-11-20", review_required: false};
const document_id = "00000000-0000-0000-0000-000000000001";

test("calendar dates reject rollover dates, timestamps, and invalid years", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2026-11-20T00:00:00"), false);
  assert.equal(validDate("0000-01-01"), false);
  assert.equal(validDate("2024-02-29"), true);
});
test("confirmation allows empty descriptions and rejects blank titles and null descriptions", () => {
  assert.equal(proposalError([proposal]), "");
  assert.ok(proposalError([{...proposal, title: "  "}]));
  assert.ok(proposalError([{...proposal, description: null}]));
  assert.ok(proposalError([{...proposal, due_date: "2026-02-30"}]));
  assert.ok(proposalError([]));
});
test("analysis accepts empty results and flags undated proposals", () => {
  assert.equal(parseAnalysis({document_id, proposals: []}).proposals.length, 0);
  const result = parseAnalysis({document_id, proposals: [{...proposal, title: " Entrega ", due_date: null}]});
  assert.equal(result.proposals[0].review_required, true);
  assert.equal(result.proposals[0].title, "Entrega");
});
test("malformed analysis never reaches the review list", () => {
  for (const body of [null, {}, {document_id, proposals: null},
    {document_id, proposals: [null]}, {document_id, proposals: [{}]},
    {document_id, proposals: [{...proposal, review_required: "false"}]}]) {
    assert.throws(() => parseAnalysis(body));
  }
});
test("API validation arrays produce useful text", () => {
  assert.equal(apiError({detail: [{msg: "Invalid title"}]}, "fallback"), "Invalid title");
  assert.equal(apiError({detail: {secret: "hidden"}}, "fallback"), "fallback");
});
test("today uses the browser calendar rather than the UTC calendar", () => {
  assert.equal(localToday(new Date(2026, 9, 10, 23, 30)), "2026-10-10");
});
