pipeline {
  agent any
  options { timestamps(); ansiColor('xterm') }

  environment {
    DOCKER_USER = 'dinithan'
    API_IMG     = "${DOCKER_USER}/paylanka-nano-api"
    WEB_IMG     = "${DOCKER_USER}/paylanka-nano-web"
    APP_HOST    = '172.31.9.216'
    APP_USER    = 'ubuntu'
  }

  stages {
    stage('Checkout') {
      steps {
        git branch: 'main', url: 'https://github.com/DinithaNawanjana/paylanka-nano.git'
      }
    }

    stage('Docker Build + Tag') {
      steps {
        script { env.TAG = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim() }
        // No creds here → keep a single-quoted heredoc and set options inside
        sh '''bash <<'BASH'
set -euo pipefail
docker build -t ${API_IMG}:${TAG} -t ${API_IMG}:latest services/api
docker build -t ${WEB_IMG}:${TAG} -t ${WEB_IMG}:latest services/web
BASH
'''
      }
    }

    stage('Docker Push') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          // Needs $DH_* → use UNQUOTED heredoc so bash expands env vars at runtime
          sh '''bash <<BASH
set -euo pipefail
: "\${DH_USER:?missing}"   # fail clearly if not injected
: "\${DH_PASS:?missing}"
echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
docker push ${API_IMG}:${TAG} && docker push ${API_IMG}:latest
docker push ${WEB_IMG}:${TAG} && docker push ${WEB_IMG}:latest
docker logout || true
BASH
'''
        }
      }
    }

    stage('SSH Smoke Test') {
      steps {
        sshagent(credentials: ['appvm-ssh-key']) {
          sh '''bash <<'BASH'
set -euo pipefail
ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
  "${APP_USER}@${APP_HOST}" "echo OK && whoami && hostname"
BASH
'''
        }
      }
    }

    stage('Deploy to App VM') {
      steps {
        withCredentials([
          usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')
        ]) {
          sshagent(credentials: ['appvm-ssh-key']) {
            // Needs $DH_* → UNQUOTED heredoc
            sh '''bash <<BASH
set -euo pipefail

# Build compose locally so env vars expand here
cat > docker-compose.yml <<EOF
version: "3.9"
services:
  api:
    image: ${API_IMG}:${TAG}
    container_name: paylanka-nano-api-1
    ports: ["8000:8000"]
    healthcheck:
      test: ["CMD-SHELL","wget -qO- http://localhost:8000/health || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 20
  web:
    image: ${WEB_IMG}:${TAG}
    container_name: paylanka-nano-web-1
    depends_on:
      api:
        condition: service_healthy
    ports: ["80:80"]
EOF

scp -o StrictHostKeyChecking=accept-new docker-compose.yml "${APP_USER}@${APP_HOST}:/tmp/docker-compose.yml"

ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
  "${APP_USER}@${APP_HOST}" bash -lc '
  set -euo pipefail
  sudo mkdir -p /opt/paylanka-nano
  sudo mv /tmp/docker-compose.yml /opt/paylanka-nano/docker-compose.yml
  : "${DH_USER:?missing}"; : "${DH_PASS:?missing}"
  echo "${DH_PASS}" | sudo docker login -u "${DH_USER}" --password-stdin
  sudo docker compose -f /opt/paylanka-nano/docker-compose.yml pull
  sudo docker compose -f /opt/paylanka-nano/docker-compose.yml up -d
  curl -fsS http://localhost/api/health || curl -fsS http://localhost:8000/health
'
BASH
'''
          }
        }
      }
    }

    stage('Health Check (from Jenkins)') {
      steps {
        sshagent(credentials: ['appvm-ssh-key']) {
          sh '''bash <<'BASH'
set -euo pipefail
ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
  "${APP_USER}@${APP_HOST}" "curl -fsS http://localhost/api/health || curl -fsS http://localhost:8000/health"
BASH
'''
        }
      }
    }
  }

  post {
    success { echo "✅ Deployment successful! Visit: http://${APP_HOST}" }
    failure { echo "❌ Build failed — check the stage logs above." }
  }
}
