resource "google_cloud_run_v2_service" "CloudRunApi" {
  name     = "cloud_run_api"
  location = "us-central1"

  template {
    scaling {
      max_instance_count = 10
    }
    containers {
      image = "gcr.io/project/image:tag"
      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}
resource "google_cloud_run_v2_service" "service" {
  name     = "cloud_run_api2"
  location = "us-central1"

  template {
    scaling {
      max_instance_count = 10
    }
    containers {
      image = "gcr.io/project/image1:tag"
      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_bigquery_dataset" "dataset" {
  dataset_id                  = "dataset1"
  location                    = "us-central"
  default_table_expiration_ms = 7200000
  delete_contents_on_destroy  = false
}

resource "google_cloud_run_v2_service" "CloudRunService" {
  name     = "backend-api"
  location = "us-central1"

  template {
    scaling {
      max_instance_count = 10
    }
    containers {
      image = "gcr.io/project/image:tag"
      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}
