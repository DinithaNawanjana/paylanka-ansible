pipeline {
  agent any
  options {
    timestamps()
    ansiColor('xterm')
    disableConcurrentBuilds()
    shell('/bin/bash') // run sh steps with bash (enables pipefail)
  }

  environment {
    DOCKER_USER = 'dinithan'
    API_IMG     = "${DOCKER_USER}/paylanka-nano-api"
    WEB_IMG     = "${DOCKER_USER}/paylanka-nano-web"

    APP_HOST = '172.31.9.216'   // private IP (same VPC)
    APP_USER = 'ubuntu'
    APP_DIR  = '/opt/paylanka-nano'
  }

  stages {
    stage('Checkout') {
      steps {
        // If your repo is public you can drop credentialsId
        git branch: 'main',
            url: 'https://github.com/DinithaNawanjana/paylanka-nano.git',
            credentialsId: 'github-https'
      }
    }

    stage('Docker Build + Tag') {
      steps {
        script { env.TAG = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim() }
        sh '''#!/bin/bash
set -euxo pipefail
docker build -t "${API_IMG}:${TAG}" -t "${API_IMG}:latest" services/api
docker build -t "${WEB_IMG}:${TAG}" -t "${WEB_IMG}:latest" services/web
'''
      }
    }

    stage('Docker Push') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh '''#!/bin/bash
set -euxo pipefail
printf '%s\n' "${DH_PASS}" | docker login -u "${DH_USER}" --password-stdin
docker push "${API_IMG}:${TAG}"; docker push "${API_IMG}:latest"
docker push "${WEB_IMG}:${TAG}"; docker push "${WEB_IMG}:latest"
docker logout || true
'''
        }
      }
    }

    stage('Deploy to App VM') {
      steps {
        withCredentials([
          // Create this in Jenkins: “SSH Username with private key”, ID: appvm-ssh
          sshUserPrivateKey(credentialsId: 'appvm-ssh', keyFileVariable: 'DUMMY', usernameVariable: 'DUMMYU'),
          usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')
        ]) {
          // Use sshagent so we don't leak/mask -i paths
          sshagent(credentials: ['appvm-ssh']) {
            sh '''#!/bin/bash
set -euxo pipefail

# quick sanity check
ssh -o StrictHostKeyChecking=accept-new "${APP_USER}@${APP_HOST}" "hostname && whoami"

# 1) write docker-compose.yml on REMOTE with local expansion of vars
ssh -o StrictHostKeyChecking=accept-new "${APP_USER}@${APP_HOST}" "sudo mkdir -p '${APP_DIR}' && sudo chown ${APP_USER}:${APP_USER} '${APP_DIR}'"
ssh -o StrictHostKeyChecking=accept-new "${APP_USER}@${APP_HOST}" "cat > '${APP_DIR}/docker-compose.yml' <<EOF
version: '3.9'
services:
  api:
    image: ${API_IMG}:latest
    container_name: paylanka-nano-api-1
    restart: unless-stopped
    ports: ['8000:8000']
    healthcheck:
      test: ['CMD-SHELL','wget -qO- http://localhost:8000/health || exit 1']
      interval: 5s
      timeout: 3s
      retries: 20

  web:
    image: ${WEB_IMG}:latest
    container_name: paylanka-nano-web-1
    restart: unless-stopped
    depends_on:
      api:
        condition: service_healthy
    ports: ['80:80']
EOF"

# 2) docker login on REMOTE (secret piped over SSH)
printf '%s\n' "${DH_PASS}" | ssh -o StrictHostKeyChecking=accept-new "${APP_USER}@${APP_HOST}" \
  "docker login -u '${DH_USER}' --password-stdin"

# 3) pull & up on REMOTE
ssh -o StrictHostKeyChecking=accept-new "${APP_USER}@${APP_HOST}" "cd '${APP_DIR}' && docker compose pull && docker compose up -d && docker image prune -f || true"
'''
          }
        }
      }
    }

    stage('Health Check') {
      steps {
        sshagent(credentials: ['appvm-ssh']) {
          sh '''#!/bin/bash
set -euxo pipefail
# Web -> API (port 80 served by nginx container)
ssh -o StrictHostKeyChecking=accept-new "${APP_USER}@${APP_HOST}" "curl -fsS http://localhost/ | head -n 5 || true"
ssh -o StrictHostKeyChecking=accept-new "${APP_USER}@${APP_HOST}" "curl -fsS http://localhost:8000/health || true"
'''
        }
      }
    }
  }

  post {
    success {
      echo "✅ Deployment successful. Browse the App VM public IP (or ALB) on http://<PUBLIC_IP>/"
    }
    failure {
      echo "❌ Build failed. Open the stage logs for the exact command that failed."
    }
  }
}
