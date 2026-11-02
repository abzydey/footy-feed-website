#!/usr/bin/env node
// Reads the live API's logs from Railway, for cloud sessions (needs RAILWAY_TOKEN,
// a project token). Uses curl because Node's fetch ignores the cloud's proxy.
//
//   node scripts/railway-logs.cjs                  last 200 lines
//   node scripts/railway-logs.cjs lateMail 500     lines containing "lateMail", newest 500
const { execFileSync } = require("child_process");

const PROJECT_ID = "1fa8c9ca-2ad8-484c-b958-c9e1ca91b8d8";
const SERVICE_ID = "ac31e72e-e5b6-4db9-868d-116bf806cb7f";

const token = process.env.RAILWAY_TOKEN;
if (!token) {
  console.error("RAILWAY_TOKEN is not set");
  process.exit(1);
}

function graphql(query, variables) {
  const output = execFileSync(
    "curl",
    ["-sS", "--max-time", "60", "-X", "POST", "-H", "Content-Type: application/json", "-H", `Project-Access-Token: ${token}`, "--data-binary", "@-", "https://backboard.railway.com/graphql/v2"],
    { input: JSON.stringify({ query, variables }), maxBuffer: 100 * 1024 * 1024 }
  ).toString();
  const body = JSON.parse(output);
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  return body.data;
}

const [filter, limit] = process.argv.slice(2);

const { deployments } = graphql(
  `query ($input: DeploymentListInput!) {
    deployments(first: 1, input: $input) { edges { node { id createdAt } } }
  }`,
  { input: { projectId: PROJECT_ID, serviceId: SERVICE_ID, status: { in: ["SUCCESS"] } } }
);
const deployment = deployments.edges[0]?.node;
if (!deployment) throw new Error("No running deployment found");

const { deploymentLogs } = graphql(
  `query ($deploymentId: String!, $limit: Int, $filter: String) {
    deploymentLogs(deploymentId: $deploymentId, limit: $limit, filter: $filter) { timestamp severity message }
  }`,
  { deploymentId: deployment.id, limit: Number(limit) || 200, filter: filter || undefined }
);

console.log(`Deployment ${deployment.id}, started ${deployment.createdAt}`);
for (const line of deploymentLogs) console.log(`${line.timestamp} ${line.severity} ${line.message}`);
