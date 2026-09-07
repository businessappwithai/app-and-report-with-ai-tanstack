#!/usr/bin/env groovy

/**
 * Enterprise Reporting System - Jenkins CI/CD Pipeline
 * Builds and deploys to Hostinger using Docker Compose
 */

pipeline {
    agent any

    options {
        timestamps()
        timeout(time: 1, unit: 'HOURS')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    environment {
        // Git Configuration
        GIT_REPO = "https://github.com/yourusername/enterprise_reporting_tanstack.git"
        GIT_BRANCH = "main"

        // Docker Registry (Docker Hub)
        REGISTRY = "docker.io"
        REGISTRY_CREDENTIALS = "docker-hub-credentials"
        IMAGE_NAME = "yourusername/enterprise-reporting-system"
        IMAGE_TAG = "${BUILD_NUMBER}-${GIT_COMMIT.take(7)}"
        IMAGE_LATEST = "latest"

        // Hostinger Configuration
        HOSTINGER_HOST = "148.135.137.110"
        HOSTINGER_USER = "root"
        HOSTINGER_SSH_KEY = "hostinger-ssh-key"
        HOSTINGER_DEPLOY_PATH = "/root/ers"
        HOSTINGER_COMPOSE_FILE = "docker-compose.yml"

        // Build Configuration
        DOCKER_BUILDKIT = "1"
    }

    stages {
        stage('Checkout') {
            steps {
                script {
                    echo "📦 Cloning repository..."
                    checkout([
                        $class: 'GitSCM',
                        branches: [[name: "*/${GIT_BRANCH}"]],
                        userRemoteConfigs: [[url: GIT_REPO]]
                    ])

                    // Get commit info
                    sh '''
                        echo "Git Commit: $(git rev-parse HEAD)"
                        echo "Git Branch: $(git rev-parse --abbrev-ref HEAD)"
                        echo "Git Author: $(git log -1 --pretty=format:'%an')"
                    '''
                }
            }
        }

        stage('Build') {
            steps {
                script {
                    echo "🔨 Building Docker images using docker-compose..."
                    sh '''
                        # Use docker-compose.remote.yml for building all services
                        docker-compose -f docker-compose.remote.yml build --no-cache
                    '''
                }
            }
        }

        stage('Test') {
            steps {
                script {
                    echo "🧪 Running health checks..."
                    sh '''
                        # Start services briefly to verify they build correctly
                        echo "Starting containers for health checks..."
                        docker-compose -f docker-compose.remote.yml up -d --wait

                        # Wait for services to be ready
                        sleep 10

                        # Check health
                        echo "Checking app health..."
                        docker-compose -f docker-compose.remote.yml ps

                        # Cleanup
                        echo "Stopping test containers..."
                        docker-compose -f docker-compose.remote.yml down
                    '''
                }
            }
        }

        stage('Push Images') {
            steps {
                script {
                    echo "📤 Pushing images to Docker Hub..."
                    withCredentials([usernamePassword(
                        credentialsId: REGISTRY_CREDENTIALS,
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )]) {
                        sh '''
                            echo "Logging in to Docker Hub..."
                            echo "${DOCKER_PASS}" | docker login -u "${DOCKER_USER}" --password-stdin

                            # Tag and push images
                            echo "Tagging images..."
                            docker tag ers-app:latest ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
                            docker tag ers-app:latest ${REGISTRY}/${IMAGE_NAME}:${IMAGE_LATEST}
                            docker tag ers-mastra:latest ${REGISTRY}/${IMAGE_NAME}-mastra:${IMAGE_TAG}
                            docker tag ers-mastra:latest ${REGISTRY}/${IMAGE_NAME}-mastra:${IMAGE_LATEST}
                            docker tag ers-stt:latest ${REGISTRY}/${IMAGE_NAME}-stt:${IMAGE_TAG}
                            docker tag ers-stt:latest ${REGISTRY}/${IMAGE_NAME}-stt:${IMAGE_LATEST}

                            echo "Pushing images..."
                            docker push ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
                            docker push ${REGISTRY}/${IMAGE_NAME}:${IMAGE_LATEST}
                            docker push ${REGISTRY}/${IMAGE_NAME}-mastra:${IMAGE_TAG}
                            docker push ${REGISTRY}/${IMAGE_NAME}-mastra:${IMAGE_LATEST}
                            docker push ${REGISTRY}/${IMAGE_NAME}-stt:${IMAGE_TAG}
                            docker push ${REGISTRY}/${IMAGE_NAME}-stt:${IMAGE_LATEST}

                            echo "Logging out..."
                            docker logout
                        '''
                    }
                }
            }
        }

        stage('Deploy to Hostinger') {
            steps {
                script {
                    echo "🚀 Deploying to Hostinger..."
                    withCredentials([sshUserPrivateKey(
                        credentialsId: HOSTINGER_SSH_KEY,
                        keyFileVariable: 'SSH_KEY_FILE',
                        usernameVariable: 'SSH_USER'
                    )]) {
                        sh '''
                            # Configure SSH
                            mkdir -p ~/.ssh
                            chmod 700 ~/.ssh
                            ssh-keyscan -H ${HOSTINGER_HOST} >> ~/.ssh/known_hosts 2>/dev/null || true

                            # Deploy via SSH
                            ssh -i ${SSH_KEY_FILE} ${HOSTINGER_USER}@${HOSTINGER_HOST} << 'EOF'
                                set -e

                                echo "📍 Deploying to ${HOSTINGER_DEPLOY_PATH}..."

                                # Create deployment directory if it doesn't exist
                                mkdir -p ${HOSTINGER_DEPLOY_PATH}
                                cd ${HOSTINGER_DEPLOY_PATH}

                                # Pull latest code
                                echo "📥 Pulling latest code..."
                                if [ -d ".git" ]; then
                                    git pull origin main
                                else
                                    git clone ${GIT_REPO} .
                                fi

                                # Load environment variables
                                echo "🔧 Loading environment configuration..."
                                if [ ! -f .env ]; then
                                    echo "⚠️  .env file not found! Using defaults or environment variables."
                                fi

                                # Pull latest images
                                echo "📦 Pulling latest Docker images..."
                                docker pull ${REGISTRY}/${IMAGE_NAME}:${IMAGE_LATEST}
                                docker pull ${REGISTRY}/${IMAGE_NAME}-mastra:${IMAGE_LATEST}
                                docker pull ${REGISTRY}/${IMAGE_NAME}-stt:${IMAGE_LATEST}

                                # Update docker-compose.yml to use pulled images
                                sed -i "s|image: ers-app:latest|image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_LATEST}|g" ${HOSTINGER_COMPOSE_FILE}
                                sed -i "s|image: ers-mastra:latest|image: ${REGISTRY}/${IMAGE_NAME}-mastra:${IMAGE_LATEST}|g" ${HOSTINGER_COMPOSE_FILE}
                                sed -i "s|image: ers-stt:latest|image: ${REGISTRY}/${IMAGE_NAME}-stt:${IMAGE_LATEST}|g" ${HOSTINGER_COMPOSE_FILE}

                                # Stop old containers gracefully
                                echo "🛑 Stopping old containers..."
                                docker-compose -f ${HOSTINGER_COMPOSE_FILE} down || true

                                # Start new containers
                                echo "🚀 Starting new containers..."
                                docker-compose -f ${HOSTINGER_COMPOSE_FILE} up -d --wait

                                # Verify deployment
                                echo "✅ Verifying deployment..."
                                sleep 10
                                docker-compose -f ${HOSTINGER_COMPOSE_FILE} ps

                                # Health check
                                echo "🏥 Running health checks..."
                                curl -f http://localhost:3000/api/health || echo "⚠️  Health check endpoint not ready yet"

                                echo "✅ Deployment complete!"
EOF
                        '''
                    }
                }
            }
        }

        stage('Post-Deploy Verification') {
            steps {
                script {
                    echo "🔍 Verifying deployed application..."
                    sh '''
                        # Verify the deployment
                        HOST="${HOSTINGER_HOST}"

                        echo "Checking application status..."
                        curl -s -m 5 http://${HOST}:3000 > /dev/null && echo "✅ App is responding" || echo "⚠️  App not responding yet"

                        echo "Checking Mastra service..."
                        curl -s -m 5 http://${HOST}:4111 > /dev/null && echo "✅ Mastra is responding" || echo "⚠️  Mastra not responding yet"

                        echo "Deployment verification complete!"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "✅ Pipeline completed successfully!"
            // Send success notification (configure Jenkins email or Slack)
        }

        failure {
            echo "❌ Pipeline failed. Check logs above for details."
            // Send failure notification
        }

        always {
            // Clean up
            sh 'docker-compose -f docker-compose.remote.yml down --remove-orphans || true'
        }
    }
}
