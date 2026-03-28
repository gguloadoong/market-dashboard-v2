#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);
const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const REVIEW_MARKER = "<!-- codex-ai-pr-review -->";
const DEFAULT_MODEL = process.env.OPENAI_REVIEW_MODEL || "gpt-5";
const MAX_DIFF_CHARS = 120000;
const MAX_PATCH_CHARS_PER_FILE = 12000;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.mode || "local";

  if (args.help) {
    printHelp();
    return;
  }

  if (mode === "github") {
    await runGithubReview();
    return;
  }

  await runLocalReview(args.base || "origin/main");
}

function parseArgs(argv) {
  return argv.reduce((acc, arg) => {
    if (arg === "--help" || arg === "-h") {
      acc.help = true;
      return acc;
    }

    const [key, value] = arg.split("=");
    if (key === "--mode") acc.mode = value;
    if (key === "--base") acc.base = value;
    return acc;
  }, {});
}

function printHelp() {
  console.log(`Usage:
  node scripts/ai-pr-review.mjs --mode=local --base=origin/main
  node scripts/ai-pr-review.mjs --mode=github

Required env for both modes:
  OPENAI_API_KEY

Required env for github mode:
  GITHUB_TOKEN
  GITHUB_REPOSITORY
  GITHUB_EVENT_PATH`);
}

async function runLocalReview(baseRef) {
  ensureEnv("OPENAI_API_KEY");

  const mergeBase = await git(["merge-base", baseRef, "HEAD"]);
  const diff = await git([
    "diff",
    "--no-color",
    "--unified=1",
    `${mergeBase.trim()}...HEAD`,
  ]);

  if (!diff.trim()) {
    console.log("No changes found between the current branch and the base branch.");
    return;
  }

  const prompt = buildPrompt({
    reviewMode: "local-pre-pr",
    title: `Local review against ${baseRef}`,
    body: "Review the current branch before opening or updating a pull request.",
    filesText: truncateDiff(diff),
    metadata: [
      `Base branch: ${baseRef}`,
      `Merge base: ${mergeBase.trim()}`,
      "Focus on bugs, regressions, edge cases, data accuracy, performance, and missing tests.",
    ],
  });

  const review = await requestOpenAIReview(prompt);
  console.log(review);
}

async function runGithubReview() {
  ensureEnv("OPENAI_API_KEY");
  ensureEnv("GITHUB_TOKEN");
  ensureEnv("GITHUB_REPOSITORY");
  ensureEnv("GITHUB_EVENT_PATH");

  const event = JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  const pr = event.pull_request;

  if (!pr) {
    console.log("No pull_request payload found. Skipping.");
    return;
  }

  const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
  const files = await getPullRequestFiles(owner, repo, pr.number);
  const filesText = serializePullRequestFiles(files);

  if (!filesText.trim()) {
    console.log("No pull request diff content available. Skipping.");
    return;
  }

  const prompt = buildPrompt({
    reviewMode: "github-pr-review",
    title: `${pr.title} (#${pr.number})`,
    body: pr.body || "No PR description provided.",
    filesText,
    metadata: [
      `Repository: ${owner}/${repo}`,
      `Base: ${pr.base.ref}`,
      `Head: ${pr.head.ref}`,
      `Author: ${pr.user?.login || "unknown"}`,
      "Review only the provided diff. Do not assume hidden files changed.",
    ],
  });

  const review = await requestOpenAIReview(prompt);
  const body = `${REVIEW_MARKER}
## Codex PR Review

${review}`.trim();

  await upsertIssueComment(owner, repo, pr.number, body);
  console.log(`Posted review comment to PR #${pr.number}.`);
}

function buildPrompt({ reviewMode, title, body, filesText, metadata }) {
  return `
You are Codex reviewing a pull request for a real-time market dashboard.

Review mode: ${reviewMode}
Title: ${title}
Description:
${body}

Context:
${metadata.map((line) => `- ${line}`).join("\n")}

Diff:
${filesText}

Instructions:
- Prioritize real bugs, behavioral regressions, edge cases, data accuracy risks, performance concerns, and missing tests.
- Be concrete and skeptical. Avoid generic praise.
- If there are no meaningful issues, say that explicitly.
- Keep the response concise and in Korean.
- Use this exact structure:
## Verdict
<1-3 sentences>

## Findings
- <finding with file path when possible>
- <finding>

## Suggested Checks
- <test or manual verification>
- <test or manual verification>

- If there are no findings, write "- 없음".
`.trim();
}

async function requestOpenAIReview(prompt) {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: prompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API request failed (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const text = extractResponseText(json).trim();

  if (!text) {
    throw new Error("OpenAI API returned an empty review response.");
  }

  return text;
}

function extractResponseText(json) {
  if (typeof json.output_text === "string") {
    return json.output_text;
  }

  const parts = [];
  for (const item of json.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n");
}

async function getPullRequestFiles(owner, repo, pullNumber) {
  const files = [];
  let page = 1;

  while (true) {
    const batch = await githubRequest(
      `/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100&page=${page}`
    );

    files.push(...batch);

    if (batch.length < 100) {
      return files;
    }

    page += 1;
  }
}

function serializePullRequestFiles(files) {
  let totalChars = 0;
  const chunks = [];

  for (const file of files) {
    const patch = truncatePatch(file.patch || "");
    const section = [
      `diff --git a/${file.filename} b/${file.filename}`,
      `status: ${file.status}`,
      `changes: +${file.additions} -${file.deletions}`,
      patch || "(No textual patch available for this file.)",
    ].join("\n");

    if (totalChars + section.length > MAX_DIFF_CHARS) {
      chunks.push("\n[Diff truncated due to size limit.]");
      break;
    }

    chunks.push(section);
    totalChars += section.length;
  }

  return chunks.join("\n\n");
}

function truncatePatch(patch) {
  if (!patch) return "";
  if (patch.length <= MAX_PATCH_CHARS_PER_FILE) return patch;
  return `${patch.slice(0, MAX_PATCH_CHARS_PER_FILE)}\n[Patch truncated for this file.]`;
}

function truncateDiff(diff) {
  if (diff.length <= MAX_DIFF_CHARS) return diff;
  return `${diff.slice(0, MAX_DIFF_CHARS)}\n[Diff truncated due to size limit.]`;
}

async function upsertIssueComment(owner, repo, issueNumber, body) {
  const comments = await githubRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`
  );
  const existing = comments.find((comment) => comment.body?.includes(REVIEW_MARKER));

  if (existing) {
    await githubRequest(`/repos/${owner}/${repo}/issues/comments/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    });
    return;
  }

  await githubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

async function githubRequest(endpoint, options = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "codex-ai-pr-review",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: options.body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${errorText}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function git(args) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: process.cwd(),
    maxBuffer: 20 * 1024 * 1024,
  });

  return stdout;
}

function ensureEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
