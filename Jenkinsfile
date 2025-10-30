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
        // Repo is public; you can remove credentialsId to silence the warning
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

    stage('Checkout') {
  steps {
    git branch: 'main',
        url: 'https://github.com/DinithaNawanjana/paylanka-nano.git'
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

        # build compose locally so vars expand here
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

        # sanity ssh
        ssh -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
            -i "$SSH_KEY" "$SSH_USER@${APP_HOST}" "hostname && whoami"

        # copy compose
        scp -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -i "$SSH_KEY" \
            docker-compose.yml "$SSH_USER@${APP_HOST}:/tmp/docker-compose.yml"

        # deploy remotely
        ssh -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
            -i "$SSH_KEY" "$SSH_USER@${APP_HOST}" bash -lc '
          set -euo pipefail
          mkdir -p ~/paylanka-nano
          mv /tmp/docker-compose.yml ~/paylanka-nano/docker-compose.yml
          echo "${DH_PASS}" | docker login -u "${DH_USER}" --password-stdin
          docker compose -f ~/paylanka-nano/docker-compose.yml pull
          docker compose -f ~/paylanka-nano/docker-compose.yml up -d
          curl -fsS http://localhost/api/health
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
            -i "$SSH_KEY" "$SSH_USER@${APP_HOST}" "curl -fsS http://localhost/api/health"
      '''
    }
  }
}

  post {
    success { echo "✅ Deployment successful! Visit: http://${APP_HOST}" }
    failure { echo "❌ Build failed — check the stage logs above." }
  }
}
