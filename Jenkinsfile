pipeline {
  agent any
  options { timestamps(); ansiColor('xterm') }
  environment {
    DOCKER_USER = 'dinithan'
    API_IMG = "${DOCKER_USER}/paylanka-nano-api"
    WEB_IMG = "${DOCKER_USER}/paylanka-nano-web"
    APP_HOST = '172.31.9.216'
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
        script { env.TAG = sh(script:'git rev-parse --short HEAD', returnStdout:true).trim() }
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
            echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
            docker push ${API_IMG}:${TAG}; docker push ${API_IMG}:latest
            docker push ${WEB_IMG}:${TAG}; docker push ${WEB_IMG}:latest
            docker logout || true
          """
        }
      }
    }

    stage('Deploy to App VM') {
      steps {
        sshagent(credentials: ['appvm-ssh-key']) {
          sh """
            ssh -o StrictHostKeyChecking=accept-new ${APP_USER}@${APP_HOST} '
              set -e
              mkdir -p ${APP_DIR} && cd ${APP_DIR}
              cat > docker-compose.yml <<EOF2
              name: paylanka-nano
              services:
                api:
                  image: ${API_IMG}:latest
                  environment: [ "PORT=8000" ]
                  healthcheck:
                    test: ["CMD-SHELL","wget -qO- http://localhost:8000/health || exit 1"]
                    interval: 5s
                    timeout: 3s
                    retries: 20
                  networks: [appnet]
                web:
                  image: ${WEB_IMG}:latest
                  depends_on:
                    api: { condition: service_healthy }
                  ports: ["80:80"]
                  networks: [appnet]
              networks: { appnet: {} }
              EOF2
              docker compose pull
              docker compose up -d
            '
          """
        }
      }
    }

    stage('Health Check') {
      steps {
        sshagent(credentials: ['appvm-ssh-key']) {
          sh 'ssh ${APP_USER}@${APP_HOST} "curl -fsS http://localhost/api/health"'
        }
      }
    }
  }

  post {
    success { echo "✅ Deployment successful! Visit http://${APP_HOST}" }
    failure { echo "❌ Build failed. Check logs for details." }
  }
}
