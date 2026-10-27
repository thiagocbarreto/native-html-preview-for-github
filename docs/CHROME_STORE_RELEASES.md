# Chrome Web Store releases

The [release workflow](../.github/workflows/release.yml) builds and tests release tags, then uses the [Chrome Web Store API V2](https://developer.chrome.com/docs/webstore/using-api) to upload the tested ZIP and submit it for review. Google publishes it after approval; a successful submission does not mean users have received the update.

## Access and approval

The publishing job uses [Google Workload Identity Federation](https://github.com/google-github-actions/auth) through a service account. No service-account key or OAuth refresh token is stored in GitHub. The linked service account has publisher-wide store authority, not access limited to one extension.

The [Terraform configuration](../infra/chrome-store/main.tf) restricts federation to this repository's numeric owner and repository IDs, the release workflow, the `chrome-web-store` environment, and either `main` or release tags. Manual runs on `main` are read-only. Publishing additionally requires an exact version-tag match, a tag-push event, and an explicit environment opt-in.

Configure the GitHub environment with yourself as a required reviewer, self-review allowed, and selected deployment rules for the `main` branch and `v*` tags. Keep build jobs separate: dependency installation and tests never run in the job holding the store token. Actions are pinned to commit SHAs.

## Environment variables

Set these as variables on the `chrome-web-store` GitHub environment, not as secrets:

| Variable | Purpose |
|----------|---------|
| `CWS_WIF_PROVIDER` | Full Google workload identity provider resource name |
| `CWS_SERVICE_ACCOUNT` | Publishing service-account email |
| `CWS_PUBLISHER_ID` | Publisher ID from the store dashboard |
| `CWS_ITEM_ID` | Existing extension ID |
| `CWS_PUBLISH_ENABLED` | Set to `true` only when tag-triggered uploads and review submissions are authorized; unset or any other value keeps runs read-only |

Link the service-account email under **Account** in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/). Get the publisher ID from **Publisher → Settings**. These identifiers are not secrets. Store listing, privacy, visibility changes, and account enrollment remain dashboard tasks.

## Check access without uploading

Run **Chrome Web Store → Run workflow** from `main` in GitHub Actions, then approve the environment job. It requests only the `chromewebstore.readonly` scope and calls `fetchStatus`. Manual runs never upload, even when publishing is enabled.

Before the first release, verify this check succeeds and shows the expected extension revisions. A 403 can mean the service account has not been linked to the publisher. Allow time for new IAM bindings and enabled APIs to propagate before diagnosing a new setup.

## Publish a release

1. Update the manifest, package, and lockfile versions together, then commit and push to `main`.
2. Verify the commit's tests pass.
3. Set `CWS_PUBLISH_ENABLED` to `true` after authorizing store writes.
4. Push a `v`-prefixed tag matching the manifest version at that commit.
5. Approve the `chrome-web-store` environment job after checking its tag and commit.
6. Check the run's credential-free log artifact for the confirmed submission version and state.
7. Check the dashboard or rerun the read-only workflow later to confirm the published version.

The build checks the tag, runs the full test suite, and packages a clean checkout. Only its ZIP artifact reaches the publishing job. One concurrency group serializes this workflow's store jobs. Do not upload through the dashboard or another tool while a release is running: the API publishes the latest uploaded package and does not accept a version or package digest in its publish request.

Other callers of the [store script](../scripts/chrome-store.mts) can authorize manual tag releases with `CWS_MANUAL_PUBLISH_CONFIRMED=true` and `--publish`; the publishing opt-in and exact version-tag checks still apply. This repository's manual workflow entrypoint remains read-only.

The [store script](../scripts/chrome-store.mts) skips a version already published, pending review, or staged. It refuses lower versions, another active submission, ambiguous revisions, policy-enforced items, and uploads already in progress. Upload processing has a bounded poll; review itself is not polled in a long-running Actions job. Warnings block submission.

## Failure and rollback

For an upload or publish timeout, inspect the dashboard or run the read-only check before retrying. The server might have accepted the request. A retry checks published and submitted versions first, but cannot identify an unsubmitted draft by digest. Never blindly retry a mutation or cancel another submission.

To stop future automated writes, unset `CWS_PUBLISH_ENABLED`. To revoke authentication, disable the Google identity provider or remove its service-account IAM grant. A store rollback remains an explicit dashboard operation; see [Google's rollback procedure](https://developer.chrome.com/docs/webstore/rollback).

The script logs timestamps and revision state to a private local log file; Actions saves these logs as an artifact. It never logs bearer tokens or raw API response bodies. Optional positive-integer tunables are `CWS_REQUEST_TIMEOUT_MS` (default `60000`), `CWS_UPLOAD_POLL_INTERVAL_MS` (default `5000`), and `CWS_UPLOAD_POLL_ATTEMPTS` (default `12`). Set them in the publishing job's environment if needed. `CWS_LOG_DIR` overrides the log directory.

## Manage the Google identities

Use the pinned Terraform version declared in the [configuration](../infra/chrome-store/main.tf). The [infrastructure helper](../scripts/chrome-store-infra.sh) uses `gcloud` for a short-lived personal account token, without printing or persisting it. Set `GCLOUD` if the CLI is not on `PATH`.

```sh
CWS_GCLOUD_ACCOUNT=your-personal-account@example.com bash scripts/chrome-store-infra.sh plan
```

Review the saved plan before applying it. Applying is a separate authorized operation:

```sh
CWS_GCLOUD_ACCOUNT=your-personal-account@example.com APPLY=1 bash scripts/chrome-store-infra.sh apply
```

State, saved plans, and logs live outside the checkout under `${XDG_STATE_HOME:-$HOME/.local/state}/native-html-preview-for-github/chrome-store`; `CWS_INFRA_STATE_DIR` overrides that path. Keep it in private machine backups. If state is lost, import the existing identities rather than creating replacements. The project is protected against Terraform deletion, and removing a service resource from state does not disable its API. No billing account, compute instance, or service-account key is provisioned by this configuration.
