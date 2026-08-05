
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


module "cloudrunService1" {
  source = "git::https://github.com/sheetalkubsad/terraform-cloud-run-module.git?ref=main"

  serviceName      = "cloudRnsErive1"
  containerImage   = "gcr.io"
  maxInstanceCount = 10
  cpuLimit         = "1000m"
  memoryLimit      = "512Mi"
}

module "CloudRunServiceIamPolicy" {
  source = "git::https://github.com/sheetalkubsad/terraform-cloud-run-iam-module.git?ref=main"

  service_name = "cloudRnsErive1"
  region       = "us-central1"
  member       = "user:test-user@exampl.com"
  environment  = "Development"
}

module "cloudRunApi" {
  source = "git::https://github.com/sheetalkubsad/terraform-cloud-run-module.git?ref=main"

  serviceName      = "cloud_run_api"
  containerImage   = "us-central1-docker.pkg.dev/my-project/my-rep"
  maxInstanceCount = 8
  cpuLimit         = "1000m"
  memoryLimit      = "512Mi"
}

module "paymentsData" {
  source = "git::https://github.com/sheetalkubsad/terraform-bigquery-module.git?ref=main"

  datasetId         = "payments_data"
  dataLocation      = "us-central1"
  allowUpdate       = false
  tableExpirationMs = 7200000
}
