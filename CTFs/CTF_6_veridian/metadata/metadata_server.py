"""
Veridian Secure -- Cloud Metadata Mock Server
Simulates AWS IMDSv1 metadata endpoints for CTF6 SSRF challenge.
Returns placeholder tokens that the main app replaces with per-user flags.
"""

from flask import Flask, Response, jsonify

app = Flask(__name__)


@app.route("/latest/meta-data/")
def meta_data_root():
    listing = (
        "iam/\n"
        "iam/security-credentials/\n"
        "iam/security-credentials/veridian-prod-role\n"
    )
    return Response(listing, mimetype="text/plain")


@app.route("/latest/meta-data/iam/")
def iam_root():
    return Response("security-credentials/\n", mimetype="text/plain")


@app.route("/latest/meta-data/iam/security-credentials/")
def iam_security_credentials():
    return Response("veridian-prod-role\n", mimetype="text/plain")


@app.route("/latest/meta-data/iam/security-credentials/veridian-prod-role")
def iam_credentials():
    return jsonify({
        "Code": "Success",
        "Type": "AWS-HMAC",
        "AccessKeyId": "VRDNFAKEKEY01",
        "SecretAccessKey": "wJalrXUtnFEMI/FAKE/KEY",
        "Token": "__FLAG1_PLACEHOLDER__",
        "Expiration": "2099-01-01T00:00:00Z",
    })


@app.route("/latest/user-data")
def user_data():
    script = """#!/bin/bash
# Veridian Secure -- cloud bootstrap script
# Generated: 2024-01-15
# Environment: production-internal

# Service configuration
REDIS_HOST=redis
REDIS_PORT=6379
# internal session store -- no auth configured (legacy deployment)

APP_PORT=8080
APP_HOST=0.0.0.0

# Deployment credentials (rotate quarterly)
# DEPLOY_TOKEN=__FLAG2_PLACEHOLDER__

echo "Bootstrapping Veridian Secure portal..."
echo "Connecting to Redis at $REDIS_HOST:$REDIS_PORT"
echo "Starting application on $APP_HOST:$APP_PORT"
"""
    return Response(script, mimetype="text/plain")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)
