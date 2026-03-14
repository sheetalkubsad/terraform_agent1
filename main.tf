
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

module "Dataset1" {
  source = "git::https://github.com/sheetalkubsad/terraform-bigquery-module.git?ref=main"

  datasetId         = "dataset1"
  dataLocation      = "us-east1"
  tableExpirationMs = 3600000
  allowUpdate       = false
}

module "Dataset2" {
  source = "git::https://github.com/sheetalkubsad/terraform-bigquery-module.git?ref=main"

  datasetId         = "dataset2"
  dataLocation      = "us-west1"
  tableExpirationMs = 3600000
  allowUpdate       = false
}

module "Dataset3" {
  source = "git::https://github.com/sheetalkubsad/terraform-bigquery-module.git?ref=main"

  datasetId         = "dataset3"
  dataLocation      = "us-central1"
  tableExpirationMs = 3600000
  allowUpdate       = false
}
