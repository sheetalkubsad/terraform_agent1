resource google_storage_bucket bucket {
  name          = cloud_storage_bucket
  location      = US
  storage_class = STANDARD
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }
}

resource google_cloud_run_v2_service_iam_member invoker {
  location = google_cloud_run_v2_service.service.location
  name     = google_cloud_run_v2_service.service.name
  role     = roles/run.invoker
  member   = allAuthenticatedUsers
}
