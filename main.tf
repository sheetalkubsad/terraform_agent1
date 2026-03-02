resource "google_storage_bucket" "bucket" {
  name          = "clouyd_storage_bucket"
  location      = "US"
  storage_class = "STANDARD"
  force_destroy = false 
  
  lifecycle {
    prevent_destroy = true
  }
}

resource "google_cloud_run_v2_service" "service" {
  name     = "cloud_run_service"
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

resource "google_cloud_run_v2_service_iam_member" "invoker" {
  location = google_cloud_run_v2_service.service.location
  name     = google_cloud_run_v2_service.service.name
  role     = "roles/run.invoker"
  member   = "allAuthenticatedUsers"
}