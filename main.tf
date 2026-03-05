
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


module "CloudRunService1" {
  source = "git::https://github.com/sheetalkubsad/terraform-cloud-run-module.git?ref=main"

  serviceName      = "cloudRunService1"
  containerImage   = "gcr.io/project/image:tag"
  maxInstanceCount = 10
  cpuLimit         = "1000m"
  memoryLimit      = "512Mi"
}

module "CloudRunIamPolicy1" {
  source = "git::https://github.com/sheetalkubsad/terraform-cloud-run-iam-module.git?ref=main"

  service_name = "cloudRunService1"
  region       = "us-central1"
  member       = "serviceAccount:my-sa@project.iam.gserviceaccount.com"
  environment  = "dev"
}
