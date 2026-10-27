#!/usr/bin/env bash
# Plans the store publishing identities; APPLY=1 bash scripts/chrome-store-infra.sh apply applies a saved plan.
# State and logs stay outside the checkout. Revoke federation before retiring the protected project.
set +x
set -euo pipefail
umask 077

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
state_dir=${CWS_INFRA_STATE_DIR:-"${XDG_STATE_HOME:-$HOME/.local/state}/native-html-preview-for-github/chrome-store"}
gcloud=${GCLOUD:-gcloud}
account=${CWS_GCLOUD_ACCOUNT:?Set CWS_GCLOUD_ACCOUNT to the personal account that owns the project}
mode=${1:-plan}
mkdir -p "$state_dir"
log_file="$state_dir/$(date -u +%Y%m%dT%H%M%SZ)-$$.log"
exec > >(tee -a "$log_file") 2>&1
tee_pid=$!
cleanup() {
  local rc=$?
  printf '\nexit %d — log: %s\n' "$rc" "$log_file"
  exec 1>&- 2>&-
  wait "$tee_pid" 2>/dev/null || true
}
trap cleanup EXIT

printf 'log: %s\n' "$log_file"
case "$mode" in
  plan) ;;
  apply)
    if [[ ${APPLY:-0} != 1 || ! -f "$state_dir/publish-identities.tfplan" ]]; then
      printf 'Apply requires APPLY=1 and a previously reviewed saved plan.\n' >&2
      exit 1
    fi
    ;;
  *) printf 'Usage: %s [plan|apply]\n' "$0" >&2; exit 1 ;;
esac

printf '[%s] Initialize pinned Terraform provider before obtaining credentials\n' "$(date -u +%H:%M:%SZ)"
terraform -chdir="$root/infra/chrome-store" init -input=false \
  -backend-config="path=$state_dir/terraform.tfstate"
printf '[%s] Authenticate without writing or printing a credential\n' "$(date -u +%H:%M:%SZ)"
GOOGLE_OAUTH_ACCESS_TOKEN=$("$gcloud" auth print-access-token --account="$account" 2>/dev/null)
export GOOGLE_OAUTH_ACCESS_TOKEN

if [[ $mode == plan ]]; then
  printf '[%s] Preview project, API enablement, and publishing identities\n' "$(date -u +%H:%M:%SZ)"
  terraform -chdir="$root/infra/chrome-store" plan -input=false \
    -out="$state_dir/publish-identities.tfplan"
else
  printf '[%s] Apply reviewed plan\n' "$(date -u +%H:%M:%SZ)"
  terraform -chdir="$root/infra/chrome-store" apply -input=false "$state_dir/publish-identities.tfplan"
  printf '[%s] Verify resulting resource outputs\n' "$(date -u +%H:%M:%SZ)"
  terraform -chdir="$root/infra/chrome-store" output
fi
