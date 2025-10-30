pipeline {
  agent any
  options { timestamps(); ansiColor('xterm') }

  environment {
    DOCKER_USER = 'dinithan'
    API_IMG     = "${DOCKER_USER}/paylanka-nano-api"
    WEB_IMG     = "${DOCKER_USER}/paylanka-nano-web"
    APP_HOST    = '172.31.9.216'    // your App VM private IP
    APP_USER    = 'ubuntu'
    PRIVATE_KEY = '''ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFSZum3ih+i0WrRNJoJPX8qPcMMRV275nUQYvXUDV8oa jenkins@appvm'''
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
        script {
          env.TAG = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
        }
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
    withCredentials([usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
      sshagent(credentials: ['appvm-ssh-key']) {
        sh '''
          set -e
          ssh -o StrictHostKeyChecking=accept-new ${APP_USER}@${APP_HOST} "hostname && whoami"
          ssh -o StrictHostKeyChecking=accept-new ${APP_USER}@${APP_HOST} bash -lc '
            set -e
            sudo mkdir -p /opt/paylanka-nano
            cat > /opt/paylanka-nano/docker-compose.yml <<EOF
version: "3.9"
services:
  api:
    image: ${API_IMG}:latest
    container_name: paylanka-nano-api-1
    ports: ["8000:8000"]
    healthcheck:
      test: ["CMD-SHELL","wget -qO- http://localhost:8000/health || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 20
  web:
    image: ${WEB_IMG}:latest
    container_name: paylanka-nano-web-1
    depends_on:
      api:
        condition: service_healthy
    ports: ["80:80"]
EOF
            echo "${DH_PASS}" | sudo docker login -u "${DH_USER}" --password-stdin
            sudo docker compose -f /opt/paylanka-nano/docker-compose.yml pull
            sudo docker compose -f /opt/paylanka-nano/docker-compose.yml up -d
            curl -fsS http://localhost/api/health
          '
        '''
      }
    }
  }
}


    stage('Health Check (from Jenkins)') {
      steps {
        sshagent(credentials: ['appvm-ssh-key']) {
          sh 'ssh -o StrictHostKeyChecking=accept-new ${APP_USER}@${APP_HOST} "curl -fsS http://localhost/api/health"'
        }
      }
    }
  }

  post {
    success { echo "✅ Deployment successful! Visit: http://${APP_HOST}" }
    failure { echo "❌ Build failed — check the stage logs above." }
  }
}
