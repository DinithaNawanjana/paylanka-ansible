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
    PRIVATE_KEY = '''ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFSZum3ih+i0WrRNJoJPX8qPcMMRV275nUQYvXUDV8oa jenkins@appvm'''
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

    stages {
    stage('Deploy to App VM (manual key)') {
      steps {
        sh '''#!/bin/bash
          set -eux

          # Write key to temporary file
          KEY_FILE=$(mktemp)
          echo "$PRIVATE_KEY" > $KEY_FILE
          chmod 600 $KEY_FILE

          # Check connectivity
          ssh -i $KEY_FILE -o StrictHostKeyChecking=accept-new $APP_USER@$APP_HOST "hostname && whoami"

          # Deploy your stack
          ssh -i $KEY_FILE -o StrictHostKeyChecking=accept-new $APP_USER@$APP_HOST bash -lc "
            sudo mkdir -p $APP_DIR
            sudo tee $APP_DIR/docker-compose.yml >/dev/null <<'EOF'
version: '3.9'
services:
  api:
    image: dinithan/paylanka-nano-api:latest
    container_name: paylanka-nano-api-1
    ports: ['8000:8000']
  web:
    image: dinithan/paylanka-nano-web:latest
    container_name: paylanka-nano-web-1
    depends_on:
      api:
        condition: service_healthy
    ports: ['80:80']
EOF
            cd $APP_DIR && sudo docker compose up -d
          "

          rm -f $KEY_FILE
        '''
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
