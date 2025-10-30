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
        git branch: 'main',
            url: 'https://github.com/DinithaNawanjana/paylanka-nano.git'
      }
    }

    stage('Docker Build + Tag') {
      steps {
        script { env.TAG = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim() }
        sh """
          docker build -t ${API_IMG}:${TAG} -t ${API_IMG}:latest services/api
          docker build -t ${WEB_IMG}:${TAG} -t ${WEB_IMG}:latest services/web
        """
      }
    }

    stage('Docker Push') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh """
            set -e
            echo "\$DH_PASS" | docker login -u "\$DH_USER" --password-stdin
            docker push ${API_IMG}:${TAG} && docker push ${API_IMG}:latest
            docker push ${WEB_IMG}:${TAG} && docker push ${WEB_IMG}:latest
            docker logout || true
          """
        }
      }
    }

    stage('Deploy to App VM') {
      steps {
        withCredentials([
          usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS'),
          sshUserPrivateKey(credentialsId: 'appvm-ssh-key', keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER')
        ]) {
          sh '''
            set -euo pipefail

            # Build compose locally so env vars expand here
            cat > docker-compose.yml <<EOF
version: "3.9"
services:
  api:
    image: ${API_IMG}:${TAG}
    container_name: paylanka-nano-api-1
    ports:
      - "8000:8000"
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
    ports:
      - "80:80"
EOF

            # Smoke SSH
            ssh -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
                -i "$SSH_KEY" "$SSH_USER@${APP_HOST}" "hostname && whoami"

            # Copy compose
            scp -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -i "$SSH_KEY" \
                docker-compose.yml "$SSH_USER@${APP_HOST}:/tmp/docker-compose.yml"

            # Deploy remotely (use sudo in case ubuntu isn't in docker group)
            ssh -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
                -i "$SSH_KEY" "$SSH_USER@${APP_HOST}" bash -lc '
              set -euo pipefail
              sudo mkdir -p /opt/paylanka-nano
              sudo mv /tmp/docker-compose.yml /opt/paylanka-nano/docker-compose.yml
              echo "${DH_PASS}" | sudo docker login -u "${DH_USER}" --password-stdin
              sudo docker compose -f /opt/paylanka-nano/docker-compose.yml pull
              sudo docker compose -f /opt/paylanka-nano/docker-compose.yml up -d
              curl -fsS http://localhost/api/health || curl -fsS http://localhost:8000/health
            '
          '''
        }
      }
    }

    stage('Health Check (from Jenkins)') {
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: 'appvm-ssh-key', keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER')]) {
          sh '''
            ssh -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
                -i "$SSH_KEY" "$SSH_USER@${APP_HOST}" "curl -fsS http://localhost/api/health || curl -fsS http://localhost:8000/health"
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
