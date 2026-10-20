terraform {
  backend "s3" {
    bucket       = "clouddeploy-terraform-state-f5618cca"
    key          = "clouddeploy/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}