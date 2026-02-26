# Generated at Thu Feb 26 15:08:04 2026
resource "google_storage_bucket" "bucket" {
  name          = "my-bucket"
  location      = "us-central1"
  storage_class = "STANDARD"
  force_destroy = false
  
  lifecycle {
    prevent_destroy = true
  }
}
