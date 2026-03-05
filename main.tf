
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


resource "google_bigquery_dataset" "BigqueryDataset" {
  dataset_id                  = "dataset1"
  location                    = "us-central1"
  default_table_expiration_ms = 3600000
}
