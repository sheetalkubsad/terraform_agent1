terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "dummy-project"
  region  = "us-central1"
}

# ==========================================
# GLOBAL VARIABLES
# ==========================================
variable "allowUpdate" {
  type        = bool
  default     = false
  description = "Safety flag. If false, prevents resource destruction/replacement."
}

variable "deploymentEnvironment" {
  type        = string
  description = "Target environment. Options: Development, Staging, Production."
}

# ==========================================
# 1. GOOGLE STORAGE BUCKET
# ==========================================
variable "bucketName" { type = string }

variable "storageClass" {
  type        = string
  default     = "STANDARD"
  description = "Options: STANDARD, NEARLINE, COLDLINE, ARCHIVE."
}

variable "dataLocation" {
  type        = string
  default     = "US"
  description = "The geographic location of the bucket."
}

resource "google_storage_bucket" "bucket" {
  name          = var.bucketName
  location      = var.dataLocation
  storage_class = var.storageClass
  force_destroy = var.allowUpdate 
  
  lifecycle {
    prevent_destroy = !var.allowUpdate
  }
}

# ==========================================
# 2. BIGQUERY DATASET
# ==========================================
variable "datasetId" { type = string }

variable "tableExpirationMs" {
  type        = number
  default     = 3600000 # 1 hour default for safety/testing
  description = "Default lifetime of tables in the dataset in milliseconds."
}

resource "google_bigquery_dataset" "dataset" {
  dataset_id                  = var.datasetId
  location                    = var.dataLocation
  default_table_expiration_ms = var.tableExpirationMs
  delete_contents_on_destroy  = var.allowUpdate
}

# ==========================================
# 3. BIGQUERY TABLE
# ==========================================
variable "tableId" { type = string }

variable "tableSchema" {
  type        = string
  description = "A JSON string representing the table schema."
}

variable "timePartitionField" {
  type        = string
  default     = ""
  description = "The field used for time-based partitioning. If empty, partitioning is disabled."
}

resource "google_bigquery_table" "table" {
  dataset_id          = google_bigquery_dataset.dataset.dataset_id
  table_id            = var.tableId
  deletion_protection = !var.allowUpdate

  dynamic "time_partitioning" {
    for_each = var.timePartitionField != "" ? [1] : []
    content {
      type  = "DAY"
      field = var.timePartitionField
    }
  }
}

# ==========================================
# 4. GOOGLE CLOUD SQL DATABASE
# ==========================================
variable "sqlDatabaseName" {
  type        = string
  description = "Must be CamelCase. Example: InventoryData"
}

variable "sqlCharset" {
  type    = string
  default = "UTF8"
}

resource "google_sql_database" "database" {
  name     = var.sqlDatabaseName
  instance = google_sql_database_instance.instance.name
  charset  = var.sqlCharset
}

# ==========================================
# 5. CLOUD RUN SERVICE
# ==========================================
variable "serviceName" { type = string }

variable "containerImage" {
  type        = string
  description = "The full URI of the container image (e.g. gcr.io/project/image:tag)."
}

variable "maxInstanceCount" {
  type        = number
  default     = 10
  description = "Maximum number of instances to scale up to."
}

variable "cpuLimit" {
  type    = string
  default = "1000m" # 1 CPU
}

variable "memoryLimit" {
  type    = string
  default = "512Mi"
}

resource "google_cloud_run_v2_service" "service" {
  name     = var.serviceName
  location = "us-central1"

  template {
    scaling {
      max_instance_count = var.maxInstanceCount
    }
    containers {
      image = var.containerImage
      resources {
        limits = {
          cpu    = var.cpuLimit
          memory = var.memoryLimit
        }
      }
    }
  }

  lifecycle {
    prevent_destroy = !var.allowUpdate
  }
}

# ==========================================
# 6. CLOUD RUN SERVICE IAM POLICY
# ==========================================
variable "invokerMember" {
  type        = string
  default     = "allAuthenticatedUsers"
  description = "The identity that will be granted invoker access."
}

resource "google_cloud_run_v2_service_iam_member" "invoker" {
  location = google_cloud_run_v2_service.service.location
  name     = google_cloud_run_v2_service.service.name
  role     = "roles/run.invoker"
  member   = var.invokerMember
}



