# CI/CD Pipeline: GitHub Actions → AWS S3 → EC2

A very small Node.js (Express) web page with a full CI/CD pipeline:

```
Code Change → Git Push → Unit Tests → Security Scan → Build → Zip Artifact → AWS S3 → Deploy to EC2 → Live App
```

| Part | What it is |
|---|---|
| App | Express server showing a page with a message, version, build number and commit |
| Tests | 4 unit tests using Node's built-in test runner (no extra libraries) |
| Pipeline | `.github/workflows/ci-cd.yml` |
| Bonus (DevSecOps) | `npm audit` (dependency scan), Gitleaks (secret scan), CodeQL (SAST, `.github/workflows/codeql.yml`) |
| Deploy method | GitHub Actions tells EC2 (through AWS Systems Manager) to download `latest/build-latest.zip` from S3 and restart. **No SSH keys needed.** |

## Project structure

```
cicd-demo/
├── .github/workflows/
│   ├── ci-cd.yml            <- main pipeline (submit this file)
│   └── codeql.yml           <- bonus: CodeQL SAST
├── aws/
│   ├── ec2-user-data.sh     <- paste into EC2 "User data"
│   ├── remote-deploy.sh     <- runs on EC2 during deployment
│   ├── github-user-policy.json
│   └── ec2-role-s3-policy.json
├── scripts/build.sh         <- creates build-vX.Y.Z.<run>.zip
├── src/                     <- application (edit src/config.js for the demo change)
├── test/app.test.js         <- unit tests
└── package.json
```

---

# Part A: One-time setup (about 30 minutes)

You can do this in the AWS Console. Use **one region** for everything (e.g. `us-east-1`).

## Step 1: Test locally

Install Node.js 20 and Git, then:

```bash
cd cicd-demo
npm install
npm test          # all 4 tests should pass
npm start         # open http://localhost:3000
```

## Step 2: Create the GitHub repository and push

1. On github.com click **New repository**, name it `cicd-demo`. Choose **Public** (CodeQL is free on public repos). Don't add a README (you already have one).
2. In the project folder:

```bash
git init -b main
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<YOUR_USERNAME>/cicd-demo.git
git push -u origin main
```

The first push will start the pipeline and it will **fail at the build/upload stage** because AWS secrets don't exist yet. That is expected. Continue with the AWS setup.

## Step 3: Create the S3 bucket

1. AWS Console → **S3** → **Create bucket**.
2. Bucket name: globally unique, e.g. `cicd-demo-<yourname>-12345`. Region: your chosen region.
3. Keep **Block all public access** ON. Click **Create bucket**.

## Step 4: Create the IAM role for the EC2 server

The server needs permission to (a) receive commands from Systems Manager and (b) read the S3 bucket.

1. **IAM** → **Roles** → **Create role** → Trusted entity: **AWS service** → **EC2** → Next.
2. Attach the managed policy **`AmazonSSMManagedInstanceCore`**.
3. Name the role `cicd-demo-ec2-role` → **Create role**.
4. Open the role → **Add permissions** → **Create inline policy** → **JSON** tab. Paste the contents of `aws/ec2-role-s3-policy.json` and replace `YOUR_BUCKET_NAME` with your bucket name. Name it `read-artifacts-bucket` → Create.

## Step 5: Launch the EC2 server

1. **EC2** → **Launch instance**.
2. Name: `cicd-demo-server`.
3. AMI: **Amazon Linux 2023**. Type: **t2.micro / t3.micro** (free tier).
4. Key pair: **Proceed without a key pair** (not needed, we use SSM).
5. Network settings → **Edit** → create a security group with one inbound rule: **HTTP, port 80, Source 0.0.0.0/0**. Ensure **Auto-assign public IP** is Enable.
6. **Advanced details**:
   - **IAM instance profile**: `cicd-demo-ec2-role`
   - **User data**: paste the full contents of `aws/ec2-user-data.sh`
7. **Launch instance**.
8. Wait about 2 minutes. Note the **Instance ID** (`i-0abc...`) and **Public IPv4 address**.

> The public IP changes if you stop/start the instance. For a stable address, allocate an **Elastic IP** (EC2 → Elastic IPs) and associate it, then use that IP in the secrets below.

Check that Systems Manager sees the server: **Systems Manager → Fleet Manager** (or Node Tools) should list the instance as **Online**. If it doesn't appear after 5 minutes, see Troubleshooting.

## Step 6: Create an IAM user for GitHub Actions

1. **IAM** → **Users** → **Create user** → name `github-actions-deployer` (no console access).
2. **Attach policies directly** → **Create policy** → JSON. Paste `aws/github-user-policy.json` and replace `YOUR_BUCKET_NAME`, `YOUR_REGION`, `YOUR_ACCOUNT_ID` and `YOUR_INSTANCE_ID`. Name it `github-actions-cicd-policy`, then attach it to the user.
3. Open the user → **Security credentials** → **Create access key** → use case **Application running outside AWS** → create. **Copy the Access key ID and Secret access key** (shown only once).

## Step 7: Add the GitHub secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Create all 6:

| Secret name | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | from Step 6 |
| `AWS_SECRET_ACCESS_KEY` | from Step 6 |
| `AWS_REGION` | e.g. `us-east-1` |
| `S3_BUCKET` | bucket name from Step 3 |
| `EC2_INSTANCE_ID` | e.g. `i-0abc123...` |
| `EC2_PUBLIC_IP` | server public IP (no `http://`) |

## Step 8: Run the pipeline for the first time

Repo → **Actions** → **CI/CD Pipeline** → **Run workflow** (or push any commit).

You should see four jobs turn green: **Unit Tests**, **Security Scan**, **Build and Upload to S3**, **Deploy Latest Build from S3 to EC2**.

Then:
- **S3 console** → your bucket → `builds/build-v1.0.0.<n>.zip` and `latest/build-latest.zip` exist.
- Open `http://<EC2_PUBLIC_IP>` in your browser. You will see the app with **Version 1.0.0**.

If this works, you are ready to record the demo.

---

# Part B: The demo (what you will record)

## Step 9: Make a visible change

Edit `src/config.js`:

```js
module.exports = {
  appName: 'CI/CD Demo App',
  message: 'Hello from Version 1.1 - this change went live through the pipeline!',
};
```

And bump the version in `package.json`: `"version": "1.1.0"` (so the artifact becomes `build-v1.1.0.<n>.zip`).

## Step 10: Commit and push

```bash
git add .
git commit -m "Release v1.1: update welcome message"
git push
```

## Step 11: Watch the pipeline

GitHub → **Actions** → click the running workflow. Show: Unit Tests ✔ → Security Scan ✔ → Build and Upload to S3 ✔ → Deploy ✔. Open the **Summary** page to show the S3 path.

## Step 12: Show the S3 artifact

AWS Console → S3 → your bucket → `builds/` → the new `build-v1.1.0.<n>.zip`.

## Step 13: Show production

Refresh `http://<EC2_PUBLIC_IP>`: the new message, **Version 1.1.0** and the new build number are displayed.

## Bonus demo: the pipeline blocks bad code

Optional, if time permits (or show it as a separate short clip): in `test/app.test.js` change `{ status: 'ok' }` to `{ status: 'broken' }`, push, and show **Unit Tests ✘** and that Build/Deploy are **skipped**. Then revert (`git revert HEAD && git push`).

---

# 2-minute video script

Pre-record the long waits and fast-forward them (any screen recorder: OBS, Win+G, QuickTime, Loom).

| Time | Show | Say (short) |
|---|---|---|
| 0:00–0:10 | Browser with the live app (old version) | "This is production, currently Version 1.0." |
| 0:10–0:30 | Edit `config.js` + `package.json`, commit and push in terminal/VS Code | "I change the message and version, commit and push." |
| 0:30–1:05 | GitHub Actions run (fast-forward) | "The push triggers the pipeline: unit tests and security scans run first, then the build." |
| 1:05–1:20 | S3 console with the new zip | "The build is stored in S3 as build-v1.1.0 zip." |
| 1:20–1:35 | Deploy job log (`Deployed OK`) | "The deploy job makes the EC2 server pull the latest build from S3." |
| 1:35–1:55 | Refresh the live page | "Production now shows Version 1.1, the change is live." |
| 1:55–2:00 | (optional) CodeQL / failed-test clip | "Bonus: security scans are part of the pipeline." |

---

# Submission checklist

- [ ] GitHub repository URL (public)
- [ ] Video (≤ 2 minutes)
- [ ] Workflow file: `.github/workflows/ci-cd.yml` (also mention `codeql.yml` for the bonus)

# DevSecOps bonus: what to point out

| Tool | Where | What it does |
|---|---|---|
| `npm audit` | `security` job | Scans dependencies for known vulnerabilities; fails on high/critical |
| Gitleaks | `security` job | Scans the repo history for leaked secrets (keys, passwords) |
| CodeQL | `codeql.yml` | Static code analysis (SAST); results appear in **Security → Code scanning** |

Because `build` has `needs: [test, security]`, nothing is packaged or deployed unless tests **and** scans pass.

---

# Troubleshooting

| Problem | Fix |
|---|---|
| Instance not "Online" in Systems Manager | Check the IAM role is attached to the instance (EC2 → Actions → Security → Modify IAM role), it has `AmazonSSMManagedInstanceCore`, and the instance has internet access (public IP). Reboot once after attaching. |
| `AccessDenied` in upload step | Bucket name or policy resource ARNs are wrong in `github-actions-cicd-policy`. |
| `AccessDeniedException ... ssm:SendCommand` | Instance ID / region / account ID in the policy are wrong. |
| Deploy fails: `Unit cicd-app.service not found` | User data didn't finish. SSH-less check: EC2 → Actions → Monitor and troubleshoot → Get system log. Wait a few minutes and re-run the workflow. |
| Deploy ok but browser can't open the site | Security group needs inbound HTTP port 80; use `http://` (not https). |
| "Production is not serving the new build" | `EC2_PUBLIC_IP` secret is wrong/outdated (IP changed after a restart). |
| Gitleaks step asks for a license | Only needed for repos owned by a GitHub *organization*. Personal accounts are free. If needed, delete that step. CodeQL and `npm audit` are enough for the bonus. |
| CodeQL upload fails on a private repo | Make the repo public (or remove `codeql.yml`). |

# Clean up (avoid AWS charges)

After your grade: terminate the EC2 instance, release the Elastic IP (if any), empty and delete the S3 bucket, and delete the IAM user's access key.

# Notes

- Access keys in secrets are the simplest approach for a course. In real projects, GitHub **OIDC** with an IAM role is preferred (no long-lived keys).
- Rollback: older builds stay in `s3://<bucket>/builds/`. Copy one over `latest/build-latest.zip` and re-run the deploy job.
