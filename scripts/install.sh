#!/bin/bash
set -e

echo "Installing dependencies..."
npm install

if ! command -v aws &> /dev/null; then
  echo "Warning: AWS CLI not found. deploy-sam-application workflow command requires 'aws' on PATH."
fi
