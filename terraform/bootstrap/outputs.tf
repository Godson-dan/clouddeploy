output "terraform_state_bucket_name" {
  description = "S3 bucket name for the shared Terraform state"
  value       = aws_s3_bucket.terraform_state.bucket
}

output "terraform_state_bucket_region" {
  description = "AWS region containing the Terraform state bucket"
  value       = var.aws_region
}

output "terraform_state_bucket_arn" {
  description = "ARN of the Terraform state bucket"
  value       = aws_s3_bucket.terraform_state.arn
}