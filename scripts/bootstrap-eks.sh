#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
secret_dir="${HOME}/.config/clouddeploy"

for command_name in aws curl kubectl sha256sum terraform; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    printf 'Required command not found: %s\n' "${command_name}" >&2
    exit 1
  }
done

if [[ ! -r "${secret_dir}/terraform.env" || ! -r "${secret_dir}/runtime-encryption.env" ]]; then
  printf 'Expected local secret files are missing under %s\n' "${secret_dir}" >&2
  exit 1
fi

set +x
# These files contain local secrets and are outside the repository.
# shellcheck disable=SC1091
source "${secret_dir}/terraform.env"
# shellcheck disable=SC1091
source "${secret_dir}/runtime-encryption.env"

: "${TF_VAR_db_password:?TF_VAR_db_password is missing}"
: "${ENVIRONMENT_ENCRYPTION_KEY:?ENVIRONMENT_ENCRYPTION_KEY is missing}"

region="us-east-1"
cluster_name="clouddeploy-eks"
controller_version="v2.14.1"
cert_manager_version="v1.21.2"
certificate_arn="$(terraform -chdir="${repo_root}/terraform" output -raw acm_certificate_arn)"
certificate_status="$(aws acm describe-certificate \
  --region "${region}" \
  --certificate-arn "${certificate_arn}" \
  --query 'Certificate.Status' \
  --output text)"
if [[ "${certificate_status}" != "ISSUED" ]]; then
  printf 'ACM certificate is %s; add/verify its DNS validation CNAME and retry.\n' "${certificate_status}" >&2
  exit 1
fi

aws eks update-kubeconfig --region "${region}" --name "${cluster_name}"
kubectl wait --for=condition=Ready nodes --all --timeout=15m

controller_role_arn="$(terraform -chdir="${repo_root}/terraform" output -raw load_balancer_controller_role_arn)"
vpc_id="$(terraform -chdir="${repo_root}/terraform" output -raw vpc_id)"
kubectl create serviceaccount aws-load-balancer-controller --namespace kube-system \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl annotate serviceaccount aws-load-balancer-controller \
  --namespace kube-system \
  --overwrite \
  "eks.amazonaws.com/role-arn=${controller_role_arn}"

controller_manifest_dir="$(mktemp -d)"
lbc_webhook_temporarily_ignored=false
lbc_manifest_applied=false
cleanup() {
  if [[ "${lbc_webhook_temporarily_ignored}" == true && "${lbc_manifest_applied}" == false ]]; then
    kubectl patch mutatingwebhookconfiguration aws-load-balancer-webhook \
      --type=strategic \
      --patch='{"webhooks":[{"name":"mservice.elbv2.k8s.aws","failurePolicy":"Fail"}]}' \
      >/dev/null 2>&1 || true
  fi
  rm -rf "${controller_manifest_dir}"
}
trap cleanup EXIT
controller_release_tag="${controller_version//./_}"
controller_manifest="${controller_manifest_dir}/${controller_release_tag}_full.yaml"
ingress_class_manifest="${controller_manifest_dir}/${controller_release_tag}_ingclass.yaml"
cert_manager_manifest="${controller_manifest_dir}/cert-manager.yaml"
curl --fail --silent --show-error --location \
  "https://github.com/cert-manager/cert-manager/releases/download/${cert_manager_version}/cert-manager.yaml" \
  --output "${cert_manager_manifest}"
curl --fail --silent --show-error --location \
  "https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases/download/${controller_version}/${controller_release_tag}_full.yaml" \
  --output "${controller_manifest}"
curl --fail --silent --show-error --location \
  "https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases/download/${controller_version}/${controller_release_tag}_ingclass.yaml" \
  --output "${ingress_class_manifest}"
printf '%s  %s\n' \
  'e03b668ec8675214af6b0a671699d088f2601fa3878e0dbe1b41d3feafd1879f' \
  "${cert_manager_manifest}" \
  '6bb10f0f121c20486f098b05decc34cec697203f84c83b88c4be91df17a82af3' \
  "${controller_manifest}" \
  '90b9750cbab4c65372180c1d5efa46024c1a2f6f0d857eaf6755e512a0078384' \
  "${ingress_class_manifest}" | sha256sum --check --status || {
    printf 'Pinned Kubernetes manifest checksum mismatch.\n' >&2
    exit 1
  }

# The LBC v2.14.1 manifest defines webhook Certificate and Issuer resources.
# Install cert-manager first so those resource types exist before applying it.
# A previous partial LBC install may have registered a fail-closed Service
# webhook before its controller pod had a serving certificate. Temporarily
# fail open only that webhook so cert-manager can create its Services.
if kubectl get mutatingwebhookconfiguration aws-load-balancer-webhook >/dev/null 2>&1; then
  webhook_endpoints="$(kubectl get endpoints aws-load-balancer-webhook-service \
    --namespace kube-system \
    --output jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || true)"
  if [[ -z "${webhook_endpoints}" ]]; then
    kubectl patch mutatingwebhookconfiguration aws-load-balancer-webhook \
      --type=strategic \
      --patch='{"webhooks":[{"name":"mservice.elbv2.k8s.aws","failurePolicy":"Ignore"}]}'
    lbc_webhook_temporarily_ignored=true
  fi
fi
kubectl apply --validate=false -f "${cert_manager_manifest}"
for deployment in cert-manager cert-manager-cainjector cert-manager-webhook; do
  kubectl rollout status "deployment/${deployment}" \
    --namespace cert-manager --timeout=5m
done

# AWS's v2.14.1 manifest places its ServiceAccount at lines 764-772. Remove it
# so applying the upstream file preserves the Terraform-role annotation above.
sed -i.bak \
  -e '764,772d' \
  -e "s|--cluster-name=your-cluster-name|--cluster-name=${cluster_name}|" \
  -e "/--ingress-class=alb/a\\
        - --aws-region=${region}\\
        - --aws-vpc-id=${vpc_id}" \
  "${controller_manifest}"
kubectl apply -f "${controller_manifest}"
lbc_manifest_applied=true
kubectl patch deployment aws-load-balancer-controller \
  --namespace kube-system \
  --type=merge \
  --patch='{"spec":{"progressDeadlineSeconds":1200}}'
kubectl rollout status deployment/aws-load-balancer-controller \
  --namespace kube-system --timeout=20m
kubectl apply -f "${ingress_class_manifest}"

kubectl apply -f "${repo_root}/k8s/namespace.yaml"
kubectl apply -f "${repo_root}/k8s/rbac.yaml"

rds_endpoint="$(terraform -chdir="${repo_root}/terraform" output -raw rds_endpoint)"
database_url="postgres://clouddeploy_admin:${TF_VAR_db_password}@${rds_endpoint}/clouddeploy?sslmode=require"
printf 'DATABASE_URL=%s\n' "${database_url}" | kubectl create secret generic clouddeploy-db \
  --namespace clouddeploy \
  --from-env-file=/dev/stdin \
  --dry-run=client -o yaml | kubectl apply -f -
printf 'ENVIRONMENT_ENCRYPTION_KEY=%s\n' "${ENVIRONMENT_ENCRYPTION_KEY}" | kubectl create secret generic clouddeploy-runtime-secrets \
  --namespace clouddeploy \
  --from-env-file=/dev/stdin \
  --dry-run=client -o yaml | kubectl apply -f -

unset TF_VAR_db_password ENVIRONMENT_ENCRYPTION_KEY database_url
printf '\nBootstrap completed. GitHub Actions deploy access is limited to the clouddeploy namespace.\n'
