resource "aws_acm_certificate" "clouddeploy" {
  domain_name       = "clouddeploy.name.ng"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name    = "${var.project_name}-public-certificate"
    Project = var.project_name
  }
}
