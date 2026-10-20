variable "project_name" {
  description = "Project name used to identify resources"
  type        = string
  default     = "clouddeploy"
}

variable "aws_region" {
  description = "AWS region for the Terraform state bucket"
  type        = string
  default     = "us-east-1"
}