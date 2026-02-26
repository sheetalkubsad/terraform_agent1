# Generated at Thu Feb 26 15:05:25 2026
resource "google_bigquery_table" "table" {
  dataset_id          = google_bigquery_dataset.dataset.dataset_id
  table_id            = "table1"
  deletion_protection = true

  time_partitioning {
    type  = "DAY"
    field = ""
  }
}
