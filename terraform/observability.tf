data "aws_eks_addon_version" "cloudwatch_observability" {
  addon_name         = "amazon-cloudwatch-observability"
  kubernetes_version = aws_eks_cluster.main.version
  most_recent        = true
}

resource "aws_cloudwatch_log_group" "eks_control_plane" {
  name              = "/aws/eks/${var.eks_cluster_name}/cluster"
  retention_in_days = 30

  tags = {
    Name    = "${var.project_name}-eks-control-plane"
    Project = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "eks_application" {
  name              = "/aws/containerinsights/${var.eks_cluster_name}/application"
  retention_in_days = 30

  tags = {
    Name    = "${var.project_name}-eks-application-logs"
    Project = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "rds_postgresql" {
  name              = "/aws/rds/instance/${var.project_name}-postgres/postgresql"
  retention_in_days = 30

  tags = {
    Name    = "${var.project_name}-rds-postgresql-logs"
    Project = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "rds_upgrade" {
  name              = "/aws/rds/instance/${var.project_name}-postgres/upgrade"
  retention_in_days = 30

  tags = {
    Name    = "${var.project_name}-rds-upgrade-logs"
    Project = var.project_name
  }
}

resource "aws_eks_addon" "cloudwatch_observability" {
  cluster_name             = aws_eks_cluster.main.name
  addon_name               = "amazon-cloudwatch-observability"
  addon_version            = data.aws_eks_addon_version.cloudwatch_observability.version
  service_account_role_arn = aws_iam_role.cloudwatch_observability.arn
  configuration_values = jsonencode({
    otelContainerInsights = {
      enabled = true
    }
  })
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"

  depends_on = [
    aws_eks_node_group.main,
    aws_iam_role_policy_attachment.cloudwatch_agent,
    aws_iam_role_policy_attachment.cloudwatch_xray,
    aws_cloudwatch_log_group.eks_application
  ]
}
