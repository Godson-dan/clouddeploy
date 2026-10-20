# EKS staging setup

The Ingress attaches the Terraform-managed `clouddeploy-alb-sg` security group. Terraform restricts that group's HTTP and HTTPS ingress to `alb_ingress_cidrs`. Keep this set to trusted administrator IP CIDRs while the application has no user authentication or authorization; do not use `0.0.0.0/0` for staging.

## GitHub Actions continuous deployment

The existing workflow tests, scans, and pushes SHA-tagged frontend/backend images to Docker Hub. After the Terraform changes for GitHub OIDC are applied, the workflow also deploys the reviewed commit to EKS after those checks pass.

The EKS public API is limited to trusted CIDRs, so the deploy job uses a Linux self-hosted GitHub Actions runner on a network whose public egress IP is in `eks_public_access_cidrs`. A GitHub-hosted runner will not be able to reach this cluster. Register a runner from the repository's **Settings → Actions → Runners** page, give it the `clouddeploy-staging` label, and keep it online when deployments should run. Use a dedicated unprivileged Linux/WSL account for the runner, not the account that owns local Terraform/runtime secret files. Restrict the runner to this repository and protect `master` so only reviewed changes can run on it.

After the Terraform changes are applied, set the GitHub repository Actions variable `AWS_DEPLOY_ROLE_ARN` to:

```sh
terraform -chdir=terraform output -raw github_actions_deployer_role_arn
```

Keep `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` configured as Actions secrets for image publishing; the Docker Hub username must be `temigodson`, matching the configured image repositories. The workflow uses GitHub OIDC for AWS access; do not add long-lived AWS keys or application runtime secrets to GitHub. The OIDC trust is restricted to this repository's immutable GitHub owner/repository IDs and the `master` branch.

## One-time cluster bootstrap

The workflow deploys only namespaced application resources. It does not manage runtime Secrets, install the cluster-wide load balancer controller, or grant itself cluster-wide access. After Terraform is applied and ACM reports the certificate as `ISSUED`, run the bootstrap script from the repository root on the trusted machine that can reach the EKS API:

```sh
bash scripts/bootstrap-eks.sh
```

The script installs pinned cert-manager and AWS Load Balancer Controller v2.14.1 from upstream Kubernetes manifests, creates the `clouddeploy` namespace and namespace-scoped deployer RBAC, and creates the two runtime Kubernetes Secrets from the local files in `~/.config/clouddeploy/`. Cert-manager issues the controller's internal webhook certificate; ACM remains responsible for the public application certificate. The script does not print secret values or add them to Git. Keep those files backed up securely; the encryption key must remain stable. The script requires `aws`, `curl`, `kubectl`, `sha256sum`, and `terraform` on that machine.

The Terraform update enables EKS access entries while retaining `aws-auth` compatibility. The GitHub role can describe the cluster and receives only the `clouddeploy-deployer` Kubernetes group; its RoleBinding cannot read or modify Secrets or resources in other namespaces.

The deployment runner must use the same trusted public egress IP allowed by `eks_public_access_cidrs` (or another explicitly allowed CIDR). Do not broaden the EKS API to `0.0.0.0/0` to accommodate a GitHub-hosted runner.

Once bootstrap is complete, each successful push to `master` builds/scans/publishes images and deploys those immutable commit-tagged images. The job waits for both Deployments to roll out. It applies the Ingress too; ensure ACM validation is complete and the controller is ready before the first deployment.

## Terraform inputs and outputs

Keep the existing S3 backend and state. From the repository root, provide both `eks_public_access_cidrs` (trusted administrator IPs allowed to reach the Kubernetes API) and `alb_ingress_cidrs` (trusted administrator IPs allowed to reach the application), plus `db_password` through a secure environment or interactive mechanism. For example, replace the CIDR placeholder with your current trusted IP and enter the database password at the hidden prompt:

```sh
export TF_VAR_eks_public_access_cidrs='["YOUR_TRUSTED_PUBLIC_IP/32"]'
export TF_VAR_alb_ingress_cidrs='["YOUR_TRUSTED_PUBLIC_IP/32"]'
read -rsp "RDS master password: " TF_VAR_db_password
printf '\n'
export TF_VAR_db_password
terraform -chdir=terraform plan
unset TF_VAR_db_password
```

Review the plan and confirm the AWS account, region, and resource changes before applying it yourself. Do not put credentials in a committed file or reconfigure/migrate the existing backend.

The ACM request covers `clouddeploy.name.ng`. After the certificate is requested, add the CNAME shown by `terraform output acm_dns_validation_records` to the active Truehost DNS zone. Keep this validation record in place for certificate renewal, and wait until ACM reports the certificate as `Issued` before creating the Ingress. The controller discovers the issued ACM certificate from the Ingress hostname.

## Install the AWS Load Balancer Controller manually

Use the bootstrap script above for the normal path. If bootstrapping manually, run these steps after EKS is ready and the Terraform-created IAM role exists. Cert-manager is pinned to `v1.21.2` (compatible with the configured Kubernetes 1.36 cluster); the controller IAM policy and upstream manifests are pinned to `v2.14.1`.

```sh
aws eks update-kubeconfig --region us-east-1 --name clouddeploy-eks
kubectl apply --validate=false \
  -f https://github.com/cert-manager/cert-manager/releases/download/v1.21.2/cert-manager.yaml
for deployment in cert-manager cert-manager-cainjector cert-manager-webhook; do
  kubectl rollout status "deployment/${deployment}" \
    --namespace cert-manager --timeout=5m
done
kubectl create serviceaccount aws-load-balancer-controller --namespace kube-system
kubectl annotate serviceaccount aws-load-balancer-controller \
  --namespace kube-system \
  eks.amazonaws.com/role-arn="$(terraform -chdir=terraform output -raw load_balancer_controller_role_arn)"
curl -fsSLo /tmp/v2_14_1_full.yaml \
  https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases/download/v2.14.1/v2_14_1_full.yaml
curl -fsSLo /tmp/v2_14_1_ingclass.yaml \
  https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases/download/v2.14.1/v2_14_1_ingclass.yaml
# The release-pinned upstream manifest puts its ServiceAccount on lines 764-772.
sed -i.bak \
  -e '764,772d' \
  -e 's|--cluster-name=your-cluster-name|--cluster-name=clouddeploy-eks|' \
  -e "/--ingress-class=alb/a\\
        - --aws-region=us-east-1\\
        - --aws-vpc-id=$(terraform -chdir=terraform output -raw vpc_id)" \
  /tmp/v2_14_1_full.yaml
kubectl apply -f /tmp/v2_14_1_full.yaml
kubectl apply -f /tmp/v2_14_1_ingclass.yaml
kubectl rollout status deployment/aws-load-balancer-controller \
  --namespace kube-system --timeout=10m
```

## Runtime secrets

Create the `clouddeploy` namespace with `kubectl apply -f k8s/namespace.yaml`, then add two Kubernetes Secrets without putting their values in Git:

- `clouddeploy-db`, containing the RDS `DATABASE_URL` under the same key.
- `clouddeploy-runtime-secrets`, containing a stable 64-character hex `ENVIRONMENT_ENCRYPTION_KEY` generated with `openssl rand -hex 32`.

Back up the encryption key in a restricted secure location. Losing or changing it without re-encrypting the database makes stored environment values unreadable. Do not use the database password as this key.

Read the RDS URL and encryption key into shell variables without placing literal values in shell history. Create the Secrets from stdin so secret values are not placed in the command arguments:

```sh
printf 'DATABASE_URL=%s\n' "$DATABASE_URL" | kubectl create secret generic clouddeploy-db \
  --namespace clouddeploy --from-env-file=/dev/stdin --dry-run=client -o yaml | kubectl apply -f -
printf 'ENVIRONMENT_ENCRYPTION_KEY=%s\n' "$ENVIRONMENT_ENCRYPTION_KEY" | kubectl create secret generic clouddeploy-runtime-secrets \
  --namespace clouddeploy --from-env-file=/dev/stdin --dry-run=client -o yaml | kubectl apply -f -
```

The URL must use the RDS endpoint, configured database name/user, URL-encoded username/password if they contain reserved characters, and the backend's `DATABASE_SSL=true` setting.

The backend image runs `node dist/migrate.js` before starting the server, so it creates/updates the schema on container startup. This is suitable for the current single-replica staging setup; use a separately managed migration step before scaling or running overlapping backend versions.

The bootstrap script prepares the namespace and Secrets. The GitHub Actions deployment uses Kustomize to replace the manifest's default `master` image tags with the current commit tag before applying the Services, Deployments, and Ingress. Keep the Terraform ALB allowlist restricted during staging verification. The ALB targets frontend pod IPs on port 80; the managed node group launch template attaches a worker security group that permits that port only from the ALB security group, along with the EKS cluster security group for control-plane communication.

After creating the Ingress, wait for its ALB address and healthy targets. Point the application DNS record at the ALB DNS name, not its current IP addresses. The ACM validation CNAMEs are separate from the application record. Truehost's documented zone editor supports A and CNAME records; if it does not offer ALIAS/ANAME or apex flattening for `clouddeploy.name.ng`, use a DNS provider with Route 53 Alias support or use `www` plus an apex redirect. Preserve existing mail and verification records.

## Current product limits

The API still has no user accounts or tenant authorization, and the deployment provider remains a mock. Keep the ALB allowlist restricted to administrators and use test data only. Do not treat this staging setup as an open customer platform.

## CloudWatch monitoring

Terraform installs the Amazon CloudWatch Observability EKS add-on with OTel Container Insights enabled. It collects EKS workload container stdout/stderr logs and cluster metrics, using a service-account-scoped IAM role. EKS control-plane logs and RDS PostgreSQL/upgrade logs are also exported to CloudWatch; configured log groups retain data for 30 days. After deployment, verify the add-on is `ACTIVE`, the `cloudwatch-agent` pods are running in `amazon-cloudwatch`, and the application and RDS log groups begin receiving data. CloudWatch ingestion and metric collection incur AWS charges.
