terraform {
  required_version = "= 1.14.4"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "8.8.0"
    }
  }

  backend "local" {}
}

provider "google" {
  project = "tbarreto-chrome-store"
}

resource "google_project" "publisher" {
  project_id      = "tbarreto-chrome-store"
  name            = "Chrome Store Releases"
  deletion_policy = "PREVENT"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_service" "publisher" {
  for_each = toset([
    "chromewebstore.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
  ])

  project            = google_project.publisher.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_service_account" "publisher" {
  project      = google_project.publisher.project_id
  account_id   = "chrome-store-publisher"
  display_name = "Chrome Store Publisher"

  depends_on = [google_project_service.publisher]
}

resource "google_iam_workload_identity_pool" "releases" {
  project                   = google_project.publisher.project_id
  workload_identity_pool_id = "github-releases"
  display_name              = "GitHub Releases"

  depends_on = [google_project_service.publisher]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = google_project.publisher.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.releases.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub Actions"

  attribute_mapping = {
    "google.subject"                = "assertion.sub"
    "attribute.repository_id"       = "assertion.repository_id"
    "attribute.repository_owner_id" = "assertion.repository_owner_id"
    "attribute.ref"                 = "assertion.ref"
    "attribute.workflow_ref"        = "assertion.workflow_ref"
    "attribute.environment"         = "assertion.environment"
  }

  # The environment gate and workflow identity must hold even for read-only checks.
  attribute_condition = join(" && ", [
    "assertion.repository_id == '1356613446'",
    "assertion.repository_owner_id == '32571922'",
    "assertion.environment == 'chrome-web-store'",
    "(assertion.ref == 'refs/heads/main' || assertion.ref.startsWith('refs/tags/v'))",
    "assertion.workflow_ref == 'thiagocbarreto/native-html-preview-for-github/.github/workflows/release.yml@' + assertion.ref",
  ])

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github" {
  service_account_id = google_service_account.publisher.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.releases.name}/attribute.repository_id/1356613446"
}

output "project_id" {
  value = google_project.publisher.project_id
}

output "project_number" {
  value = google_project.publisher.number
}

output "service_account_email" {
  value = google_service_account.publisher.email
}

output "workload_identity_provider" {
  value = google_iam_workload_identity_pool_provider.github.name
}
