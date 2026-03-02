resource google_cloud_run_v2_service CloudRunApi {
  name     = cloud_run_api
  location = us-central1

  template {
    scaling {
      max_instance_count = 10
    }
    containers {
      image = gcr.io/project/image:tag
      resources {
        limits = {
          cpu    = 1000m
          memory = 512Mi
        }
      }
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}
