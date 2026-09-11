import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { AnthropicMessagesAdapter, OpenAIResponsesAdapter, createProviderAdapter, humanReviewProjection, runCli,
  validateJudgeCriteria } from "./bug-evaluation-runner.mjs";

const root = mkdtempSync(join(tmpdir(), "galy-bug-evaluation-"));
const source = join(root, "source"); const archive = join(root, "archive");
mkdirSync(join(source, ".git"), { recursive: true }); mkdirSync(join(source, ".bg"), { recursive: true });
mkdirSync(join(source, ".galy"), { recursive: true }); mkdirSync(join(source, "src"), { recursive: true });
writeFileSync(join(source, "main.txt"), "baseline\n");
writeFileSync(join(source, "secret.txt"), "must stay local\n");
writeFileSync(join(source, "AGENTS.md"), "instructions stay local\n");
writeFileSync(join(source, ".git", "config"), "history stays local\n");
writeFileSync(join(source, ".bg", "config.json"), '{"token":"must stay local"}\n');
writeFileSync(join(source, ".galy", "config.json"), '{"token":"must stay local"}\n');
writeFileSync(join(source, ".mcp.json"), '{"env":{"GALY_TOKEN":"must stay local"}}\n');
writeFileSync(join(source, "src", "app.js"), "export default 1;\n");
const runner = join(dirname(fileURLToPath(import.meta.url)), "bug-evaluation-runner.mjs");
function cli(...args) { return spawnSync(process.execPath, [runner, ...args], { encoding: "utf8" }); }
function result(...args) { const value = cli(...args); assert.equal(value.status, 0, value.stderr); return JSON.parse(value.stdout); }

const first = result("snapshot", "create", "--root", source, "--archive", archive);
const second = result("snapshot", "create", "--root", source, "--archive", archive);
assert.equal(first.snapshotHash, second.snapshotHash, "identical baselines must deduplicate");
const manifest = JSON.parse(readFileSync(join(archive, first.runId, "manifest.json"), "utf8"));
assert.deepEqual(manifest.files.map(file => file.path), ["main.txt", "src/app.js"]);
const limited = cli("snapshot", "create", "--root", source, "--archive", join(root, "limited"), "--archive-limit-bytes", "1");
assert.notEqual(limited.status, 0); assert.match(limited.stderr, /archive_limit_exceeded/);
const qualified = cli("can-run");
if (qualified.status === 0 && JSON.parse(qualified.stdout).qualified) {
  const selfTest = cli("run", "self-test", "--root", source, "--archive", join(root, "self-test"));
  assert.equal(selfTest.status, 0, selfTest.stderr);
  assert.match(selfTest.stdout, /"status": "accepted"/);
  assert.match(selfTest.stdout, /"judge"/);
  const reference = join(root, "reference"); const candidate = join(root, "candidate");
  mkdirSync(reference); mkdirSync(candidate); writeFileSync(join(reference, "main.txt"), "fixed\n"); writeFileSync(join(candidate, "main.txt"), "fixed\n");
  const oracleFile = join(root, "oracle.json");
  writeFileSync(oracleFile, JSON.stringify({ protocol: "bug-evaluation-oracle-v1",
    script: 'grep -qx fixed /input/main.txt',
    referenceRoot: reference }));
  const oracle = cli("oracle", "verify", "--oracle-file", oracleFile, "--snapshot-root", source, "--candidate-root", candidate);
  assert.equal(oracle.status, 0, oracle.stderr); assert.match(oracle.stdout, /"status": "passed"/);
  writeFileSync(join(candidate, "main.txt"), "baseline\n");
  const unchangedCandidate = cli("oracle", "verify", "--oracle-file", oracleFile, "--snapshot-root", source, "--candidate-root", candidate);
  assert.notEqual(unchangedCandidate.status, 0); assert.match(unchangedCandidate.stderr, /oracle_failed/);
  writeFileSync(join(candidate, "main.txt"), "fixed\n");
  const independentOracle = join(root, "independent-oracle.json");
  writeFileSync(independentOracle, JSON.stringify({ protocol: "bug-evaluation-oracle-v1",
    baseline: "exit 1", reference: "true", candidate: "true", referenceRoot: reference }));
  const rejectedOracle = cli("oracle", "verify", "--oracle-file", independentOracle, "--snapshot-root", source, "--candidate-root", candidate);
  assert.notEqual(rejectedOracle.status, 0); assert.match(rejectedOracle.stderr, /oracle_shared_script_required/);
}

// Provider adapters are tested against controlled responses in-process. This verifies the
// named provider wire formats and identity/usage facts without making a paid request.
const oldFetch = globalThis.fetch;
const oldOpenAiKey = process.env.OPENAI_API_KEY;
const oldAnthropicKey = process.env.ANTHROPIC_API_KEY;
process.env.OPENAI_API_KEY = "synthetic-openai-key";
process.env.ANTHROPIC_API_KEY = "synthetic-anthropic-key";
let captured;
globalThis.fetch = async (_url, options) => {
  captured = { url: _url, options };
  const body = JSON.parse(options.body);
  assert.equal(body.tools, undefined, "providers must not receive candidate tools");
  return { ok: true, status: 200, text: async () => JSON.stringify({ id: "resp_test", model: "gpt-controlled",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ changes: [{ path: "main.txt", content: "fixed\n" }] }) }] }],
    usage: { input_tokens: 7, output_tokens: 3 } }) };
};
const openai = new OpenAIResponsesAdapter();
const model = { provider: "openai", modelId: "gpt-controlled", harness: "openai-responses-v1", harnessVersion: "v1",
  effort: "high", parameters: {}, limits: { maxOutputTokens: 200 } };
const openaiResult = await openai.solve({ model, contract: {}, context: { snapshot: { files: [] } } }, { idempotencyKey: "synthetic-key" });
assert.equal(openaiResult.effectiveModel.provider, "openai");
assert.equal(openaiResult.effectiveModel.modelId, "gpt-controlled");
assert.equal(openaiResult.usage.inputTokens, 7);
assert.equal(captured.options.headers["idempotency-key"], "synthetic-key");
assert.equal(JSON.parse(captured.options.body).text.format.type, "json_schema");
assert.equal(JSON.parse(captured.options.body).reasoning.effort, "high");

globalThis.fetch = async (_url, options) => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: "resp_luna", model: "gpt-5.6-luna",
  output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ changes: [{ path: "main.txt", content: "fixed\n" }] }) }] }],
  usage: { input_tokens: 2, output_tokens: 1 } }) });
const luna = { provider: "openai", modelId: "gpt-5.6-luna", harness: "openai-responses-v1", harnessVersion: "v1",
  effort: "xhigh", parameters: {}, limits: { maxOutputTokens: 200 } };
const lunaResult = await openai.solve({ model: luna, contract: {}, context: {} }, { idempotencyKey: "synthetic-luna-key" });
assert.equal(lunaResult.effectiveModel.effort, "xhigh");
await assert.rejects(() => openai.solve({ model: { ...model, effort: "xhigh" }, contract: {}, context: {} }), /unsupported_model_effort/);

globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: "resp_wrong", model: "gpt-other",
  output_text: JSON.stringify({ changes: [{ path: "main.txt", content: "fixed\n" }] }) }) });
await assert.rejects(() => openai.solve({ model, contract: {}, context: {} }, { idempotencyKey: "unexpected-model" }), /effective_model_mismatch/);
globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ id: "resp_incomplete", model: "gpt-controlled",
  status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }) });
await assert.rejects(() => openai.solve({ model, contract: {}, context: {} }, { idempotencyKey: "incomplete" }), /provider_response_incomplete/);

globalThis.fetch = async (_url, options) => {
  captured = { url: _url, options };
  const body = JSON.parse(options.body);
  assert.equal(body.tools, undefined, "anthropic adapter must not receive candidate tools");
  assert.deepEqual(body.thinking, { type: "enabled", budget_tokens: 1024 });
  return { ok: true, status: 200, text: async () => JSON.stringify({ id: "msg_test", model: "claude-controlled",
    content: [{ type: "text", text: JSON.stringify({ diagnosis: "controlled diagnosis" }) }], usage: { input_tokens: 5, output_tokens: 4 } }) };
};
const anthropic = new AnthropicMessagesAdapter();
const anthropicResult = await anthropic.analyze({ model: { provider: "anthropic", modelId: "claude-controlled",
  harness: "anthropic-messages-v1", harnessVersion: "v1", effort: "high", parameters: { thinkingBudgetTokens: 1024 }, limits: {} }, context: {} },
  { idempotencyKey: "synthetic-anthropic-key" });
assert.equal(anthropicResult.effectiveModel.provider, "anthropic");
assert.equal(anthropicResult.effectiveModel.modelId, "claude-controlled");
assert.equal(anthropicResult.usage.outputTokens, 4);
await assert.rejects(() => anthropic.analyze({ model: { provider: "anthropic", modelId: "claude-controlled",
  harness: "anthropic-messages-v1", harnessVersion: "v1", effort: "high", parameters: {}, limits: {} }, context: {} }),
  /anthropic_effort_budget_required/);
await assert.rejects(() => anthropic.analyze({ model: { provider: "anthropic", modelId: "claude-controlled",
  harness: "anthropic-messages-v1", harnessVersion: "v1", effort: "high", parameters: { unknown: true }, limits: {} }, context: {} }),
  /unsupported_model_parameter/);
assert.throws(() => createProviderAdapter("unknown-provider"), /unsupported_provider_adapter/);
const criteria = [{ Code: "behavior" }, { Code: "regression" }];
const invalidJudge = validateJudgeCriteria({ oracleStatus: "passed", criteria: { behavior: true, regression: true, unknown: true }, extra: "reject" }, criteria);
assert.equal(invalidJudge.complete, false); assert.equal(invalidJudge.schemaError, "judge_unknown_property");
const projection = humanReviewProjection(root, { finalArtifactHash: "a".repeat(64),
  preSolutionNeed: { description: "need" }, analysis: { diagnosis: "ANALYST_TRAJECTORY_MODEL_CANARY" }, oracle: { status: "passed" } });
assert.equal(projection.protocol, "bug-evaluation-human-review-v1");
assert.equal(Object.hasOwn(projection, "runId"), false); assert.equal(Object.hasOwn(projection, "judge"), false);
assert.equal(Object.hasOwn(projection, "configurationId"), false);
assert.equal(projection.preSolutionNeed.description, "need");
assert.doesNotMatch(JSON.stringify(projection), /ANALYST_TRAJECTORY_MODEL_CANARY/);
await assert.rejects(() => runCli(["run", "execute", "--adapter", "fixture"]), /fixture_adapter_only_for_controlled_self_test/);

const mcpMethods = [];
globalThis.fetch = async (_url, options) => {
  const request = JSON.parse(options.body); mcpMethods.push(request.method === "tools/call" ? request.params.name : request.method);
  if (request.method === "initialize") return { ok: true, status: 200, text: async () => JSON.stringify({ result: {} }) };
  const value = request.params.name === "bug_evaluation_run_get" ? { RunId: 7, TenantSlug: "fixture" }
    : request.params.name === "bug_evaluation_rejudge_approve" ? { ProtocolRevision: 2 }
      : { Protocol: { Revision: 2, RunId: 7, ProtocolVersion: "v2", PromptVersion: "p2", GridVersion: "g2", FinalArtifactHash: "a".repeat(64), JudgeModelConfigId: 9 }, Judge: { ModelId: "judge" }, Criteria: [{ Id: 1, Code: "behavior" }] };
  return { ok: true, status: 200, text: async () => JSON.stringify({ result: { content: [{ type: "text", text: JSON.stringify(value) }] } }) };
};
process.env.GALY_TOKEN = "synthetic-mcp-token";
process.env.GALY_ENDPOINT = "https://fixture.invalid";
await runCli(["rejudge", "--run-id", "7", "--judge-model-config-id", "9", "--protocol-version", "v2",
  "--prompt-version", "p2", "--approved-budget", "1.25", "--budget-currency", "EUR", "--token-budget", "100", "--approve-only"]);
assert.deepEqual(mcpMethods, ["initialize", "bug_evaluation_run_get", "bug_evaluation_rejudge_approve", "bug_evaluation_rejudge_contract_get"]);

// A previously completed run can be judged again only against its immutable final archive.
// The runner must call exactly one judge role, append a protocol-revision attempt/evaluation,
// and never rerun analyst/solver or overwrite the original report.
const rejudgeArchive = join(root, "rejudge-archive");
const rejudgeNamespace = createHash("sha256").update("https://fixture.invalid\nfixture", "utf8").digest("hex").slice(0, 24);
const rejudgePath = join(rejudgeArchive, rejudgeNamespace, "7");
const rejudgeWorkspace = join(rejudgePath, "workspace");
mkdirSync(rejudgeWorkspace, { recursive: true });
writeFileSync(join(rejudgeWorkspace, "fixed.txt"), "fixed\n");
const rejudgeManifest = { protocol: "bug-evaluation-final-v1", files: [{ path: "fixed.txt", size: 6,
  sha256: createHash("sha256").update("fixed\n", "utf8").digest("hex") }] };
writeFileSync(join(rejudgePath, "final-manifest.json"), JSON.stringify(rejudgeManifest, null, 2) + "\n");
const rejudgeHash = createHash("sha256").update(JSON.stringify(rejudgeManifest), "utf8").digest("hex");
writeFileSync(join(rejudgePath, "report.json"), JSON.stringify({ oracle: { status: "passed" }, finalArtifactHash: rejudgeHash }) + "\n");
const rejudgeMethods = [];
let providerCalls = [];
process.env.OPENAI_API_KEY = "synthetic-openai-key";
globalThis.fetch = async (url, options) => {
  if (String(url).endsWith("/mcp")) {
    const request = JSON.parse(options.body);
    rejudgeMethods.push(request.method === "tools/call" ? request.params.name : request.method);
    if (request.method === "initialize") return { ok: true, status: 200, text: async () => JSON.stringify({ result: {} }) };
    const name = request.params.name;
    if (name === "bug_evaluation_run_get") return { ok: true, status: 200, text: async () => JSON.stringify({ result: { content: [{ type: "text", text: JSON.stringify({ RunId: 7, TenantSlug: "fixture" }) }] } }) };
    if (name === "bug_evaluation_rejudge_approve") return { ok: true, status: 200, text: async () => JSON.stringify({ result: { content: [{ type: "text", text: JSON.stringify({ ProtocolRevision: 2 }) }] } }) };
    if (name === "bug_evaluation_rejudge_contract_get") return { ok: true, status: 200, text: async () => JSON.stringify({ result: { content: [{ type: "text", text: JSON.stringify({
      Protocol: { Revision: 2, RunId: 7, ProtocolVersion: "v2", PromptVersion: "p2", GridVersion: "g2", FinalArtifactHash: rejudgeHash, JudgeModelConfigId: 9 },
      Judge: { Id: 9, Provider: "openai", ModelId: "gpt-5.6-luna", Harness: "openai-responses-v1", HarnessVersion: "v1", Effort: "xhigh", ParametersJson: "{}", LimitsJson: JSON.stringify({ maxOutputTokens: 100 }) },
      Criteria: [{ Id: 1, Code: "behavior" }], RemainingBudget: 1, RemainingTokens: 100
    }) }] } }) };
    return { ok: true, status: 200, text: async () => JSON.stringify({ result: { content: [{ type: "text", text: JSON.stringify({ Id: 1 }) }] } }) };
  }
  providerCalls.push(JSON.parse(options.body));
  return { ok: true, status: 200, text: async () => JSON.stringify({ id: "rejudge-response", model: "gpt-5.6-luna",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ oracleStatus: "passed", criteria: { behavior: true } }) }] }],
    usage: { input_tokens: 4, output_tokens: 2 } }) };
};
const rejudged = await runCli(["rejudge", "--run-id", "7", "--archive", rejudgeArchive,
  "--endpoint", "https://fixture.invalid", "--worker-id", "3", "--lease-generation", "4", "--judge-adapter", "openai",
  "--judge-model-config-id", "9", "--protocol-version", "v2", "--prompt-version", "p2",
  "--approved-budget", "1.25", "--budget-currency", "EUR", "--token-budget", "100"]);
assert.equal(rejudged.status, "rejudged");
assert.equal(providerCalls.length, 1, "rejudge invokes only the judge provider");
assert.match(providerCalls[0].input[1].content[0].text, /gpt-5\.6-luna/);
assert.doesNotMatch(providerCalls[0].input[1].content[0].text, /analyst|solver/);
assert.deepEqual(rejudgeMethods, ["initialize", "bug_evaluation_run_get", "bug_evaluation_rejudge_approve", "bug_evaluation_rejudge_contract_get",
  "bug_evaluation_attempt_record", "bug_evaluation_evaluation_record"]);
assert.equal(JSON.parse(readFileSync(join(rejudgePath, "report.json"), "utf8")).finalArtifactHash, rejudgeHash,
  "original report remains unchanged");
assert.equal(JSON.parse(readFileSync(join(rejudgePath, "rejudge-2.json"), "utf8")).protocolRevision, 2);
const settled = await runCli(["run", "settle", "--run-id", "7", "--role", "judge", "--attempt-number", "3",
  "--protocol-revision", "2", "--archive", rejudgeArchive, "--endpoint", "https://fixture.invalid",
  "--worker-id", "3", "--lease-generation", "4", "--billed-cost", "0.25", "--currency", "EUR",
  "--cost-source", "billed", "--pricing-version", "fixture-v1"]);
assert.equal(settled.Id, 1);
assert.equal(providerCalls.length, 1, "settling a receipt never calls the provider");
assert.equal(JSON.parse(readFileSync(join(rejudgePath, "attempts", "judge-3.json"), "utf8")).result.cost.amount, 0.25);
writeFileSync(join(rejudgePath, "attempts", "judge-4.json"), JSON.stringify({ protocol: "bug-evaluation-runner-v1",
  runId: 7, role: "judge", attemptNumber: 4, idempotencyKey: `bg-bug-evaluation-${rejudgeNamespace}-7-judge-4`,
  requestHash: "synthetic", status: "unknown" }));
await runCli(["run", "settle", "--run-id", "7", "--role", "judge", "--attempt-number", "4",
  "--protocol-revision", "2", "--archive", rejudgeArchive, "--endpoint", "https://fixture.invalid",
  "--worker-id", "3", "--lease-generation", "4", "--billed-cost", "0.10", "--currency", "EUR",
  "--cost-source", "estimated", "--pricing-version", "fixture-v1"]);
assert.equal(JSON.parse(readFileSync(join(rejudgePath, "attempts", "judge-4.json"), "utf8")).settledCost.basis, "estimated");
globalThis.fetch = oldFetch;
if (oldOpenAiKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldOpenAiKey;
if (oldAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = oldAnthropicKey;
console.log("bug-evaluation runner contract tests passed");
