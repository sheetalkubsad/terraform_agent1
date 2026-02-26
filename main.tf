# Generated at Thu Feb 26 14:42:27 2026
resource "google_bigquery_table" "BigqueryTable" {
  dataset_id          = google_bigquery_dataset.dataset.dataset_id
  table_id            = "table1"
  deletion_protection = true
}
