#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import semver from "semver";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");

const args = process.argv.slice(2);
function getArg(name) {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
}

const release = getArg("release");
const type = getArg("type") ?? "dev";

const ALLOWED_RELEASES = ["major", "minor", "patch", "prerelease"];
const ALLOWED_TYPES = ["dev", "alpha", "beta", "rc"];

if (!release || !ALLOWED_RELEASES.includes(release)) {
    console.error(
        `--release must be one of: ${ALLOWED_RELEASES.join(", ")}`,
    );
    process.exit(1);
}
if (release === "prerelease" && !ALLOWED_TYPES.includes(type)) {
    console.error(`--type must be one of: ${ALLOWED_TYPES.join(", ")}`);
    process.exit(1);
}

const pkgPath = path.join(repoRoot, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const oldVersion = pkg.version;

const newVersion =
    release === "prerelease"
        ? semver.inc(oldVersion, "prerelease", type)
        : semver.inc(oldVersion, release);

if (!newVersion) {
    console.error(`Failed to compute new version from ${oldVersion}`);
    process.exit(1);
}

pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

console.log(`Publishing '${pkg.name}' v${oldVersion} -> v${newVersion}...`);

execFileSync("npm", ["publish"], { stdio: "inherit", cwd: repoRoot });
