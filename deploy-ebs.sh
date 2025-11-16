#!/bin/bash

# AWS Elastic Beanstalk Deployment Script
echo "Preparing application for AWS Elastic Beanstalk deployment..."

# Create deployment package
zip -r swapex-backend-$(date +%Y%m%d-%H%M%S).zip . -x "node_modules/*" ".git/*" "*.zip" ".DS_Store" ".env"

echo "Deployment package created successfully!"
echo ""
echo "Next steps:"
echo "1. Install AWS CLI: brew install awscli"
echo "2. Install EB CLI: pip install awsebcli"
echo "3. Configure AWS credentials: aws configure"
echo "4. Initialize EB: eb init"
echo "5. Create environment: eb create"
echo "6. Deploy: eb deploy"
echo ""
echo "Don't forget to set environment variables in AWS console:"
echo "- MONGODB_URI"
echo "- NODE_ENV=production"
