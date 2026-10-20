# CloudDeploy Architecture Walkthrough

## Architecture and delivery

CloudDeploy runs on AWS in `us-east-1`. Terraform provisions the VPC, Amazon EKS cluster and worker nodes, and a private Amazon RDS PostgreSQL database. The Terraform configuration is organized by infrastructure area. DNS records are managed separately through Cloudflare; the domain was registered through Truehost.

Users reach `clouddeploy.name.ng` over HTTPS. Cloudflare provides DNS resolution, and an AWS Application Load Balancer handles ingress and TLS. In the `clouddeploy` Kubernetes namespace, the ALB routes browser traffic to the React frontend served by Nginx. Nginx forwards `/api` requests to the Node.js, TypeScript, and Express backend. The backend connects to private RDS PostgreSQL using TLS and the RDS CA bundle.

The GitHub Actions workflow runs backend tests, builds the frontend and backend Docker images, scans them with Trivy, and pushes versioned images to Docker Hub. A self-hosted runner deploys reviewed image tags to EKS with `kubectl` and the repository's Kubernetes manifests. The workflow uses GitHub OIDC to obtain AWS credentials through an IAM role, avoiding long-lived AWS keys. GitHub Actions Secrets hold CI/CD credentials such as the Docker Hub token; they are not the application's customer runtime secrets manager. Runtime database and application secrets are supplied to Kubernetes through restricted Kubernetes Secrets. HashiCorp Vault is deferred for the initial delivery.

CloudWatch is the monitoring and logging target. Health probes help Kubernetes detect application availability, and the backend exposes live and database health endpoints.

## Design decisions and limitations

EKS was selected to demonstrate Kubernetes-based deployment and repeatable infrastructure automation. RDS keeps the database managed and private, while Docker images make application releases portable and versioned. The current deployment is a working initial platform, not yet a complete multi-tenant customer deployment service: repository-to-customer deployments, authentication, authorization, and tenant isolation remain future application work. DNS is outside Terraform, and runtime secret management needs a more complete design. RDS recovery and disaster-recovery procedures should also be tested before treating the system as production-hardened.

## Architecture diagram

See [CloudDeploy deployment architecture](clouddeploy-architecture.svg).
