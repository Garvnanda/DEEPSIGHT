# CLAUDE.md — Deep-Sight backend

Rules for any AI agent working in this repo. These are hard constraints, not
preferences. Break one and you have made a mistake worth stopping to report.

## 1 · No git writes — ever

Never run any command that mutates git state or history:

- `git add`, `git commit`, `git push`, `git commit --amend`
- `git reset`, `git rebase`, `git revert`, `git cherry-pick`
- `git checkout -b`, `git branch`, `git switch -c`, `git merge`
- `git stash`, `git clean`, `git tag`
- any `git config` write, any hook install

Read-only git is fine: `git status`, `git log`, `git diff`, `git show`.

Staging, committing, branching, and pushing are the user's job. Always. If work
is at a point where a commit makes sense, say so and stop — do not do it.

## 2 · No autonomous design decisions

Every choice that is not already fixed by `docs/apiendpoints.md` or
`docs/implementation_garv.md` must be put to the user before you act on it.
This includes, and is not limited to:

- library or dependency choices
- file and directory layout beyond what the docs specify
- field names, response keys, enum values, class taxonomy
- default values, thresholds, tuning constants
- fixture and mock data shapes
- error messages and user-facing copy
- algorithm choices where the doc leaves options open

When in doubt, ask. A short question now beats a wrong assumption shipped.

## 3 · The API contract is frozen

`docs/apiendpoints.md` is the only agreement between backend and frontend.

- Never edit it.
- Every endpoint you build returns exactly the shape written there.
- Changing it requires the user's explicit agreement and both implementation
  docs updated in the same change.

## 4 · Server-side only

Your scope is everything under `/backend` and `/scripts`. Never create or modify
anything under `/frontend`. Do not "just fix" a frontend file.

## 5 · One step at a time

Follow the dependency order in `docs/implementation_garv.md` §8. Complete one
step, then stop and report before starting the next.

## 6 · Never add or commit sonar data

`data/` is gitignored and stays that way. Never `git add` a file under it.
Never paste survey data into the repo tree outside `data/`.

## 7 · Commands are fine; destructive file ops are not

Running commands without asking is allowed: creating a venv, `pip install`,
`uvicorn`, running tests, `curl`. But confirm with the user before deleting or
overwriting any existing file.

## 8 · Every number traces to something real

Any value that reaches an API response must come from a measured quantity or be
an explicitly labelled mock stub. No silent placeholders that survive to a demo.
