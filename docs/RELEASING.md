# Releasing

Releases are automated after a one-time setup. This file covers both: the routine that runs on its own, and the two manual steps only a human with the npm account can do.

## How a release works, once set up

1. Every PR that changes behavior includes a changeset file (created with `npx changeset`, committed with the PR). It says whether the change is a patch, minor, or major, in one sentence.
2. When changesets land on `main`, the Release workflow opens a PR called **Version Packages**. It bumps the version in `package.json` and updates `CHANGELOG.md`. Nothing is published yet.
3. Merging that PR publishes to npm with provenance and creates a git tag. No human touches a terminal.

There are no npm tokens anywhere in the repository or its CI secrets. Publishing works through npm "trusted publishing": npm trusts this exact repository's `release.yml` workflow, verified by GitHub, per release.

## One-time setup

Two manual steps, in this order. The first publish must be manual because npm only lets you configure trusted publishing for a package that already exists.

### Step 1: publish 0.1.0 by hand

You need: an npm account with two-factor authentication enabled, and this repository cloned locally with `main` checked out and up to date.

1. Open a terminal in the repository directory.
2. Run `npm ci`. This installs dependencies exactly as pinned in the lockfile.
3. Run `npx changeset version`. This consumes the pending changeset: the version in `package.json` becomes 0.1.0 and `CHANGELOG.md` appears. Commit the result: `git add -A && git commit -m "chore: version 0.1.0"`.
4. Run `npm login`. A browser window opens; sign in to npm there, then return to the terminal.
5. Run `npm whoami`. It must print your npm username. If it errors, repeat step 4.
6. Run `npm publish --dry-run`. This builds the package and prints every file that would be uploaded, without uploading anything. Read the list. It must contain only: `LICENSE`, `README.md`, `package.json`, files under `dist/`, and `rule.yaml` files under `rules/`. No fixtures, no tests, no dotfiles. If anything unexpected shows up, stop and investigate.
7. Run `npm publish`. It runs the full check suite first, then asks for your two-factor code. When it finishes, https://www.npmjs.com/package/plainsight is live.
8. Push the version commit: `git push`.

### Step 2: let CI publish future releases

1. Sign in at npmjs.com and open https://www.npmjs.com/package/plainsight/access.
2. Find **Trusted Publisher** and choose **GitHub Actions**.
3. Fill in exactly:
   - Organization or user: `VTL1618`
   - Repository: `plainsight`
   - Workflow filename: `release.yml`
   - Environment: leave empty
4. Save.

From this point, merging a Version Packages PR publishes on its own. As hardening, in the same package settings, set publishing access to disallow tokens, so trusted publishing (and your own 2FA login) are the only ways to publish.

## Checking a published release

Every CI-published version carries a provenance attestation. On the package page, npm shows a "Built and signed on GitHub Actions" panel linking the exact commit and workflow run. If that panel is missing on a version newer than 0.1.0, treat it as an incident: nothing but `release.yml` should be able to publish.
