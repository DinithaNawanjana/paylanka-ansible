pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    disableConcurrentBuilds()
  }

  environment {
    DOCKER_USER = 'dinithan'
    API_IMG     = "${DOCKER_USER}/paylanka-nano-api"
    WEB_IMG     = "${DOCKER_USER}/paylanka-nano-web"

    // --- Change these if needed ---
    APP_HOST = '172.31.9.216'      // App VM (private IP if Jenkins is in same VPC; otherwise use public IP)
    APP_USER = 'ubuntu'
    APP_DIR  = '/opt/paylanka-nano'
  }

  stages {
    stage('Checkout') {
      steps {
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
            echo "${DH_PASS}" | docker login -u "${DH_USER}" --password-stdin
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
          sshUserPrivateKey(credentialsId: 'appvm-ssh-key', keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER'),
          usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')
        ]) {
          sh '''#!/bin/bash
            set -euxo pipefail

            # quick reachability & identity
            ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$SSH_USER@${APP_HOST}" "hostname && whoami"

            # write compose and deploy
            ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$SSH_USER@${APP_HOST}" bash -lc '
              set -euxo pipefail
              sudo mkdir -p "${APP_DIR}"
              sudo tee "${APP_DIR}/docker-compose.yml" >/dev/null <<EOF
version: "3.9"
services:
  api:
    image: ${API_IMG}:latest
    container_name: paylanka-nano-api-1
    restart: unless-stopped
    ports: ["8000:8000"]
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8000/health || exit 1"]
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
    ports: ["80:80"]
EOF

              echo "${DH_PASS}" | sudo docker login -u "${DH_USER}" --password-stdin
              cd "${APP_DIR}"
              sudo docker compose pull
              sudo docker compose up -d
            '
          '''
        }
      }
    }

    stage('Health Check') {
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: 'appvm-ssh-key', keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER')]) {
          sh '''#!/bin/bash
            set -euxo pipefail
            # hit through Nginx (web -> api)
            ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$SSH_USER@${APP_HOST}" '
              curl -fsS http://localhost/api/health | jq . || curl -fsS http://localhost/api/health
            '
          '''
        }
      }
    }
  }

  post {
    success {
      echo "✅ Deployment successful!"
      echo "If your VM has a public IP / ALB, open: http://<PUBLIC_IP_OR_DNS>/"
    }
    failure {
      echo "❌ Build failed. Check stage logs."
    }
  }
}
