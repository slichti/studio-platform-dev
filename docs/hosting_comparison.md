# Hosting Cost & Profitability Analysis

This analysis compares the costs of hosting the **Studio Platform** (Multi-tenant SaaS) on **Cloudflare** (current stack) versus migrating to **AWS** or **GCP**.

**Assumptions**:
- **Scale**: Growing SaaS with 100+ Studios, ~10k Monthly Active Users (MAU).
- **Traffic**: Moderate sustained traffic, spikes during class booking windows.
- **Assets**: Image/Video heavy (Studio portraits, class thumbnails).
- **Database**: Relational data (Tenants, Users, Bookings).

## 1. Cloudflare (Current Stack)

**Architecture**:
- **Frontend**: Cloudflare Pages (React Router SPA/SSR)
- **Backend**: Cloudflare Workers (Hono API)
- **Database**: D1 (SQLite at Edge)
- **Storage**: R2 (Object Storage)
- **Auth**: Clerk (External)

| Service | Tier / Usage | Monthly Cost | Notes |
| :--- | :--- | :--- | :--- |
| **Workers** | Paid ($5/mo) | **$5.00** | Includes 10M requests/mo. Overage is negligible ($0.15/M). |
| **Pages** | Pro (Optional) | **$0.00** | Free limit is generous. Pro is $20/mo only if unlimited concurrent builds needed. |
| **D1 Database** | Paid ($5/mo) | **$5.00** | Includes 25B reads/mo (practically infinite). Writes are main cost factor. |
| **R2 Storage** | Transactional | **~$1.00** | 10GB free, cheap overage ($0.015/GB). No egress fees. |
| **Images** | Basic | **$5.00** | Image resizing/optimization. |
| **TOTAL** | | **~$16.00 / mo** | **Extremely Low Overhead** |

**Pros**:
- **Zero Egress Fees**: Massive savings on bandwidth, especially for media-heavy apps.
- **Global Edge**: 0ms cold starts (mostly), close to user.
- **Management**: "Serverless" is truly ops-free. No OS patching, scaling groups, or VPCs to manage.
- **DDoS/WAF**: Enterprise-grade security included for free.

**Cons**:
- **Ecosystem Lock-in**: Hard to migrate away from Workers/D1 specific APIs.
- **Database Limits**: D1 is powerful but not comparable to a massive Postgres RDS cluster for complex analytics (yet).

---

## 2. AWS (Elastic Beanstalk / Lambda)

**Architecture**:
- **Frontend**: CloudFront + S3 (SPA)
- **Backend**: Elastic Beanstalk (Docker/Node) OR Lambda
- **Database**: RDS (PostgreSQL) or Aurora Serverless
- **Storage**: S3

| Service | Configuration | Monthly Cost | Notes |
| :--- | :--- | :--- | :--- |
| **Elastic Beanstalk**| t3.small (x2 for HA) | **~$30.00** | Requires load balancer (ALB). |
| **ALB** | Application Load Balancer | **~$16.00** | Base cost + LCU usage. |
| **RDS (Postgres)** | db.t3.micro (Single AZ) | **~$15.00** | Very basic. Production readiness often requires Multi-AZ (~30). |
| **CloudFront** | 1TB Transfer | **~$85.00** | Egress fees are high ($0.085/GB). |
| **S3** | Storage + Requests | **~$5.00** | Storage is cheap, requests cost money. |
| **NAT Gateway** | For Private VPC | **~$30.00** | Often a hidden cost in AWS VPCs. |
| **TOTAL** | | **~$180.00 / mo** | **High Base Cost** |

**Profit Impact**:
- **Higher COGS**: Cost of Goods Sold is significantly higher (~10x).
- **Complexity**: Requires DevOps time to manage VPCs, Security Groups, IAM roles. This time costs money.

---

## 3. Google Cloud (Firebase / Cloud Run)

**Architecture**:
- **Frontend**: Firebase Hosting
- **Backend**: Cloud Run (Containerless) or Firebase Functions
- **Database**: Firestore (NoSQL) or Cloud SQL (Postgres)
- **Storage**: Cloud Storage

| Service | Configuration | Monthly Cost | Notes |
| :--- | :--- | :--- | :--- |
| **Cloud Run** | Sidecar/Request-based | **~$10.00** | Excellent scale-to-zero. Costs scale with CPU usage. |
| **Cloud SQL** | db.f1-micro | **~$10.00** | Basic instance. Shared core. |
| **Firebase Hosting** | GB Transfer | **~$0.00** | Generous free tier (10GB/mo). |
| **Network Egress** | Premium Tier | **~$10-50** | Google charges for egress traffic. |
| **Firestore** | Reads/Writes | **Varies** | Can get expensive quickly with high-read apps ($0.06/100k reads). |
| **TOTAL** | | **~$30-70 / mo** | **Medium Cost** |

**Pros**:
- **Developer Exp**: Firebase DX is great. Cloud Run is very easy to use.
- **Scale**: Google scales containers exceptionally well.

**Cons**:
- **Firestore Traps**: NoSQL modeling is rigid. Complex queries (like our dashboard analytics) are hard or expensive.
- **Cold Starts**: Cloud Run has noticeable cold starts unless min-instances (cost $) are set.

---

## Conclusion & Recommendation

### Winner: Cloudflare (Current) 🏆
For a bootstrapped or high-margin SaaS platform like **Studio Platform**:

1.  **Cost Efficiency**: Running the entire production environment for **<$20/mo** is unbeatable. This directly increases your profit margin.
2.  **Performance**: Edge rendering gives the fastest possible specific user experience for a global audience.
3.  **Simplicity**: You are one developer. Managing AWS infrastructure (VPCs, RDS, IAM) is a full-time job. Cloudflare lets you focus on **Code**.

**When to switch?**
- Only move to AWS/GCP if you hit a hard technical limit of D1 (e.g., need PostGIS complex extensions, or database size > 100GB with complex joins) or need specific enterprise compliance certifications that Cloudflare is still acquiring.

**Recommendation**:
Stay on **Cloudflare**. The "Free SSL" for custom domains (which costs $100s/mo elsewhere or requires complex cert-manager setups) alone saves significant complexity and money.
