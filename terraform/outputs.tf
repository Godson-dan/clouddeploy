output "rds_endpoint" {
  description = "RDS hostname and port; the database password is never output"
  value       = aws_db_instance.main.endpoint
}

output "vpc_id" {
  description = "CloudDeploy VPC ID for the AWS Load Balancer Controller installation"
  value       = aws_vpc.main.id
}

output "load_balancer_controller_role_arn" {
  description = "IAM role ARN to annotate on the AWS Load Balancer Controller service account"
  value       = aws_iam_role.load_balancer_controller.arn
}

output "github_actions_deployer_role_arn" {
  description = "Set this as the GitHub Actions repository variable AWS_DEPLOY_ROLE_ARN"
  value       = aws_iam_role.github_actions_deployer.arn
}

output "acm_dns_validation_records" {
  description = "Add these ACM validation CNAME records in the active public DNS zone"
  value = [
    for option in aws_acm_certificate.clouddeploy.domain_validation_options : {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  ]
}

output "acm_certificate_arn" {
  description = "ACM certificate ARN for the ALB HTTPS listener"
  value       = aws_acm_certificate.clouddeploy.arn
}
