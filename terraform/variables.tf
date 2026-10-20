
variable "project_name" {
  description = "Name of the CloudDeploy infrastructure"
  type        = string
  default     = "clouddeploy"
}

variable "aws_region" {
  description = "AWS region for CloudDeploy"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the CloudDeploy VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrsubnet(var.vpc_cidr, 8, 22)) && tonumber(split("/", var.vpc_cidr)[1]) <= 16
    error_message = "vpc_cidr must be a valid IPv4 network with a /16 or shorter prefix so the VPC has room for the required subnets."
  }
}

variable "eks_cluster_name" {
  description = "Name of the Amazon EKS cluster"
  type        = string
  default     = "clouddeploy-eks"
}

variable "github_repository_owner" {
  description = "GitHub owner for the repository allowed to deploy through OIDC"
  type        = string
  default     = "Godson-dan"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+$", var.github_repository_owner))
    error_message = "github_repository_owner must be a GitHub owner name."
  }
}

variable "github_repository_name" {
  description = "GitHub repository name allowed to deploy from master through OIDC"
  type        = string
  default     = "clouddeploy"
}

variable "github_repository_owner_id" {
  description = "Immutable GitHub owner ID used in the OIDC subject claim"
  type        = string
  default     = "111269312"
}

variable "github_repository_id" {
  description = "Immutable GitHub repository ID used in the OIDC subject claim"
  type        = string
  default     = "1406092210"
}

variable "eks_public_access_cidrs" {
  description = "Public CIDR blocks allowed to reach the EKS Kubernetes API; use trusted admin IPs, not 0.0.0.0/0"
  type        = list(string)
  nullable    = false

  validation {
    condition     = length(var.eks_public_access_cidrs) > 0
    error_message = "At least one trusted CIDR must be provided for EKS API access."
  }
}

variable "alb_ingress_cidrs" {
  description = "Public CIDR blocks allowed to reach the staging application through its ALB; keep restricted until authentication is implemented"
  type        = list(string)
  nullable    = false

  validation {
    condition     = length(var.alb_ingress_cidrs) > 0
    error_message = "At least one trusted CIDR must be provided for ALB access."
  }
}

variable "db_name" {
  description = "Name of the CloudDeploy PostgreSQL database"
  type        = string
  default     = "clouddeploy"
}

variable "db_username" {
  description = "Master username for the RDS PostgreSQL database"
  type        = string
  default     = "clouddeploy_admin"
}

variable "db_password" {
  description = "Master password for the RDS PostgreSQL database"
  type        = string
  sensitive   = true
  nullable    = false
  ephemeral   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Initial RDS storage in GB"
  type        = number
  default     = 20
}

variable "db_final_snapshot_identifier" {
  description = "Unique identifier for the RDS snapshot created before deletion"
  type        = string
  default     = "clouddeploy-postgres-final"
}

variable "eks_node_instance_types" {
  description = "EC2 instance types for EKS worker nodes"
  type        = list(string)
  default     = ["t3.small"]
}

variable "eks_node_desired_size" {
  description = "Desired number of EKS worker nodes"
  type        = number
  default     = 2
}

variable "eks_node_min_size" {
  description = "Minimum number of EKS worker nodes"
  type        = number
  default     = 1
}

variable "eks_node_max_size" {
  description = "Maximum number of EKS worker nodes"
  type        = number
  default     = 3
}

