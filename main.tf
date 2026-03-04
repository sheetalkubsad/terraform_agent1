
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


resource "google_storage_bucket" "GoogleStorageBucket" {
  name          = "my-bucket"
  location      = "us-central1"
  storage_class = "STANDARD"
}
