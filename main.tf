
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


module "Service1" {
  source           = "git::https://github.com/sheetalkubsad/terraform-cloud-run-module.git?ref=main"
  serviceName      = "service1"
  containerImage   = "gcr.io/project/image:tag"
  maxInstanceCount = 20
  cpuLimit         = "1000m"
  memoryLimit      = "512Mi"
}
