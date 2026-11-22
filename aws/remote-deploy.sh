#!/bin/bash
# Runs ON THE EC2 SERVER (sent by GitHub Actions through AWS SSM).
# BUCKET and AWS_DEFAULT_REGION are exported by the workflow before this script.
set -euo pipefail

RELEASE_DIR="/opt/app/releases/$(date +%Y%m%d%H%M%S)"
mkdir -p "$RELEASE_DIR"

echo "Downloading latest build from s3://$BUCKET/latest/build-latest.zip"
aws s3 cp "s3://$BUCKET/latest/build-latest.zip" /tmp/build-latest.zip

unzip -q /tmp/build-latest.zip -d "$RELEASE_DIR"
chown -R ec2-user:ec2-user /opt/app

# Switch the "current" symlink to the new release and restart
ln -sfn "$RELEASE_DIR" /opt/app/current
systemctl restart cicd-app

# Health check (fail the deployment if the app does not come up)
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fs http://localhost/health > /dev/null; then
    echo "Deployed OK:"
    cat /opt/app/current/build-info.json
    # keep only the 3 most recent releases
    ls -1dt /opt/app/releases/* | tail -n +4 | xargs -r rm -rf
    exit 0
  fi
  sleep 2
done

echo "Health check failed after deploy"
journalctl -u cicd-app -n 30 --no-pager || true
exit 1
