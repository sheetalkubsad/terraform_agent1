
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


module "BigqueryDataset" {
  source = "git::https://github.com/sheetalkubsad/terraform-bigquery-module.git?ref=main"

  datasetId         = "dataset1"
  dataLocation      = "us-central1"
  allowUpdate       = false
  tableExpirationMs = 3600000
}
