# Production Repository Sync

This document describes how the source development repository (`elva-tech/Grocery-Delivery-Application`) stays synchronized with the production repository (`elvatech-apnacart/apnacart`).

## Branch mapping

| Source (Development) | Target (Production) |
|----------------------|---------------------|
| `master`             | `master`            |
| `feature/develop`    | `develop`           |

All other branches (`feature/*`, `bugfix/*`, `poc/*`, `experimental/*`) remain in the source repository only and are never pushed to production.

## Workflow

- **File:** `.github/workflows/sync-production.yml`
- **Trigger:** Push to `master` or `feature/develop`
- **Authentication:** Repository secret `PROD_REPO_TOKEN`
- **Push mode:** Normal `git push` (no force push)

---

## Setup instructions

### 1. Create the production deploy token

Use a GitHub Personal Access Token (classic) or fine-grained token with **Contents: Read and write** on `elvatech-apnacart/apnacart`.

Recommended: create a dedicated machine/bot account or use a fine-grained PAT scoped only to the production repository.

### 2. Add the secret to the source repository

1. Open **elva-tech/Grocery-Delivery-Application** on GitHub.
2. Go to **Settings → Secrets and variables → Actions**.
3. Click **New repository secret**.
4. Name: `PROD_REPO_TOKEN`
5. Value: paste the token from step 1.
6. Save.

### 3. Commit and push the workflow

Ensure `.github/workflows/sync-production.yml` exists on the default branch in the source repository:

```bash
git add .github/workflows/sync-production.yml .github/PRODUCTION_SYNC.md
git commit -m "Add GitHub Actions workflow to sync production repository"
git push origin master
```

### 4. Verify production repository branch policy

In **elvatech-apnacart/apnacart**, confirm only these branches exist:

- `master`
- `develop`

Enable branch protection on both branches if required by your release process.

### 5. Confirm Actions are enabled

In the source repository: **Settings → Actions → General → Allow all actions**.

---

## Testing instructions

### Test 1: Sync `feature/develop` → production `develop`

1. Create a harmless commit on `feature/develop` in the source repo (for example, update a comment or README).
2. Push to `origin feature/develop`.
3. Open **Actions → Sync to Production** in the source repository.
4. Confirm the run succeeds and logs show:

   ```
   Source branch     : feature/develop
   Target branch     : develop
   Sync status: SUCCESS
   ```

5. In **elvatech-apnacart/apnacart**, verify `develop` contains the same commit SHA.

### Test 2: Sync `master` → production `master`

1. Merge or push a commit to `master` in the source repository.
2. Confirm the workflow run maps `master` → `master`.
3. Verify the commit SHA on production `master`.

### Test 3: Confirm other branches are ignored

1. Push to a branch such as `feature/my-feature` or `bugfix/fix-login`.
2. Confirm **Sync to Production** does **not** run.
3. Confirm no new branches appear in the production repository.

### Test 4: Missing secret (optional dry run)

Temporarily rename the secret in a fork (not production) and push to `feature/develop`. The workflow should fail with:

```
PROD_REPO_TOKEN secret is not configured.
```

---

## Rollback instructions

Rollback is performed on the **production repository** by resetting the target branch to a known-good commit, then aligning the source branch if needed.

### Roll back production `develop`

```bash
# Clone production repository
git clone https://github.com/elvatech-apnacart/apnacart.git
cd apnacart

# Find the last good commit on develop
git log develop --oneline

# Reset develop to that commit (local only first)
git checkout develop
git reset --hard <GOOD_COMMIT_SHA>

# Push rollback — requires appropriate permissions on production repo
git push origin develop
```

Then, if the source `feature/develop` should match production again, reset or revert it in the source repository and push. The sync workflow will push the corrected history on the next push to `feature/develop`.

### Roll back production `master`

Use the same steps on the `master` branch in the production repository.

### Important notes

- The sync workflow uses a **normal push**, not force push. If production has diverged from source (for example, after a manual hotfix on production), the next sync may fail until histories are reconciled.
- After a production rollback, update the corresponding source branch (`feature/develop` or `master`) so future syncs do not re-introduce the bad commit.

---

## Troubleshooting guide

### Workflow does not run

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| No workflow run after push | Branch not in trigger list | Only `master` and `feature/develop` trigger sync |
| Actions tab empty | Actions disabled | Enable Actions in repository settings |
| Workflow file missing | Not merged to pushed branch | Ensure `sync-production.yml` exists on the branch you pushed |

### `PROD_REPO_TOKEN secret is not configured`

The secret is missing or misspelled in **Settings → Secrets and variables → Actions**. Name must be exactly `PROD_REPO_TOKEN`.

### Push rejected (non-fast-forward)

```
! [rejected] HEAD -> refs/heads/develop (non-fast-forward)
```

**Cause:** Production branch has commits not present in the source branch (manual edit, hotfix, or diverged history).

**Fix:**

1. Inspect both histories:

   ```bash
   git fetch origin
   git fetch production
   git log origin/feature/develop..production/develop --oneline
   git log production/develop..origin/feature/develop --oneline
   ```

2. Reconcile in the **source** repository (preferred): merge or cherry-pick production changes into `feature/develop` or `master`, then push again.

3. Avoid force push from the workflow unless explicitly approved for your release process.

### `remote: Repository not found` or `403 Forbidden`

**Cause:** Token lacks write access to `elvatech-apnacart/apnacart`, or token expired.

**Fix:**

1. Regenerate the PAT with **Contents: Read and write** on the production repo.
2. Update `PROD_REPO_TOKEN` in source repository secrets.
3. Re-run the failed workflow from the Actions tab.

### Unsupported branch error

```
Unsupported source branch 'feature/xyz'
```

**Cause:** Workflow was manually dispatched or triggered on an unexpected ref (should not happen with current `on.push.branches` filter).

**Fix:** No action needed for feature branches; they are intentionally excluded. Re-run only from `master` or `feature/develop`.

### Wrong commit synced

**Cause:** Push included unexpected commits (merge commit, wrong source branch).

**Fix:**

1. Check the workflow log for **Commit SHA**.
2. Compare with `git log` on source and production.
3. Roll back production if needed (see Rollback instructions).
4. Fix source branch history and push again.

### Concurrent pushes

The workflow uses concurrency groups per source branch (`sync-production-master`, `sync-production-feature/develop`) so overlapping pushes to the same branch queue rather than cancel each other.

### Verify sync manually

```bash
# Source
git ls-remote origin refs/heads/feature/develop

# Production (develop)
git ls-remote https://github.com/elvatech-apnacart/apnacart.git refs/heads/develop
```

Matching commit SHAs after a successful sync indicate the branches are aligned.

---

## Security notes

- Never commit `PROD_REPO_TOKEN` to the repository.
- Scope the token to the minimum required permissions and production repository only.
- Rotate the token periodically and update the repository secret.
- Restrict who can modify `.github/workflows/sync-production.yml` via branch protection and code review.
