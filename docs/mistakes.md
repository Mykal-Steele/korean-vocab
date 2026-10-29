# Past mistakes

Each entry is a kind of mistake, the rule that prevents it, and any check that enforces it.
Add a new entry when a mistake repeats a kind that isn't here yet. Keep entries general.

## A job that depends on a skipped job gets skipped too

A deploy job depended on a check job, and the check job depended on an audio job. On pushes,
the audio job is skipped, so the deploy never ran, even though every job that ran passed.

Rule: a job that depends on a job with an `if` condition needs `always()` and an explicit
check of `needs.<job>.result`. Don't assume a skipped job lets its dependents run.

Check: `tests/test_workflows.py`.

## Verify a CI path by running it

I described the audio job as working before any run had rendered a clip in CI. The first
real run failed because the runner had no `ffmpeg`.

Rule: a CI path is only verified after a run that exercises it. A passing run that skipped
the path proves nothing about it. Make the test cause the path to run, for example by deleting
a clip on a throwaway branch.

Check: none. This is a process rule.

## Verify a deploy against the stored object

The deploy compared the public URL with the build. Cloudflare adds a script to HTML served on
the `adorio.space` zone, so the hashes never matched, even though the stored file was correct.

Rule: check what was stored, not a URL behind a proxy that can change the bytes.

Check: the deploy job reads the entry page from R2 with `rclone cat`.

## Check the value the parser sees, not the source

A doubled escape (`\\\'`) in a gloss put a backslash on the page, and the clip lookup failed.

Rule: after you edit a string literal, check the value the code reads. Prefer `’` over
escaped apostrophes.

Check: `tools/check-data.js` rejects backslashes in word text. `tests/test_data_strings.py`
covers it.

## State what the code does only after reading it

I said clip names were content hashes. They are hashes of the voice and the text, not the audio.

Rule: read the function before you describe what it does, and say which part you read.

Check: none. This is a process rule.

## Fetch before you read a remote branch

I read `main` from a stale local branch and concluded a file was missing. The merge had
already put it on `origin/main`.

Rule: run `git fetch` before you read remote state, and read `origin/<branch>`.

Check: none. This is a process rule.

## Update the docs in the same change

After the deploy stopped needing an approval step, `AGENTS.md` still described one.

Rule: when you change how deploys, reviews or audio work, update the docs in the same PR.

Check: none. This is a process rule.

## Kill processes by PID, not by name

`pkill -f` matched the shell that ran it, and killed that shell.

Rule: don't use `pkill -f` with a pattern that also appears in your own command. Find the PID
and kill that.

Check: none. This is a process rule.

## Don't leave builds in tracked files

Running the tests rebuilt the tracked `dist/` files, which left them modified.

Rule: restore `dist/` after tests and builds, or run them from a separate copy.

Check: none. This is a process rule.

## Read the headers back after an upload

The deploy set `Cache-Control` on uploads, but the stored objects never got it. Two things
hid it: `rclone copy` skips files that look unchanged, so existing objects were never
rewritten, and CI ran an older rclone that didn't store the header.

Rule: after an upload, read the stored metadata back and fail if a header is wrong. Pin the
tool version in CI to the one you tested locally.

Check: the deploy job's "Check the stored cache headers" step.

## Copy source text exactly

I stored three words without their spaces, and one with a bracket removed, because the
validator only allowed bare Hangul. The handout had the spaces and brackets.

Rule: copy the text from the source as written. If a check rejects it, change the check, not
the text. Compare the stored text against the source before you open the PR.

Check: `tools/check-data.js` allows spaces and brackets in `ko`, and counts only the Hangul
syllables for the pads and romanization. `tests/test_word_text.py` checks the four words.
