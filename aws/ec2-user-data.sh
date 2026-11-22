#!/bin/bash
# Paste this into "Advanced details -> User data" when launching the EC2 instance
# (Amazon Linux 2023). It installs Node.js and creates the systemd service.
set -eux

dnf install -y nodejs unzip

mkdir -p /opt/app/releases
chown -R ec2-user:ec2-user /opt/app

cat > /etc/systemd/system/cicd-app.service <<'EOF'
[Unit]
Description=CI/CD Demo Node.js App
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/opt/app/current
Environment=PORT=80
ExecStart=/usr/bin/node src/server.js
Restart=always
# lets a non-root user listen on port 80
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cicd-app
# The service is started by the first pipeline deployment (nothing to run yet).
