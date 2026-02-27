resource google_bigquery_table BigqueryTable1 {
  dataset_id          = google_bigquery_dataset.dataset.dataset_id
  table_id            = table1
  deletion_protection = true

  time_partitioning {
    type  = DAY
    field = 
  }
}