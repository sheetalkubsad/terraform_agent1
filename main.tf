
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

module "CloudRunApi1Service" {
  source = "git::https://github.com/sheetalkubsad/terraform-cloud-run-module.git?ref=main"

  serviceName      = "cloud_run_api1"
  containerImage   = "gcr.io/project/image:tag"
  maxInstanceCount = 18
  cpuLimit         = "1000m"
  memoryLimit      = "512Mi"
}
