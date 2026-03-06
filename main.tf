
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


module "cloudrunservice1" {
  source = "git::https://github.com/sheetalkubsad/terraform-cloud-run-module.git?ref=main"

  serviceName      = "cloudrunservice1"
  containerImage   = "gcr.io"
  maxInstanceCount = 12
  cpuLimit         = "1000m"
  memoryLimit      = "512Mi"
}
