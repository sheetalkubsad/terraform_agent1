
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

provider "google" {
  project = "durable-fact-489014-s6"
  region  = "us-central1"
}


module "CloudRunService" {
  source = "git::https://github.com/sheetalkubsad/terraform-cloud-run-module.git?ref=main"

  serviceName      = "csr"
  containerImage   = "gcr.io"
  maxInstanceCount = 10
  cpuLimit         = "1000m"
  memoryLimit      = "512Mi"
}
