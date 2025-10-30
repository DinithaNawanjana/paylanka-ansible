pipeline {
  agent any
  options { timestamps(); ansiColor('xterm') }
  environment {
    DOCKER_USER = 'dinithan'
    API_IMG = "\/paylanka-nano-api"
    WEB_IMG = "\/paylanka-nano-web"
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
          docker build -t \:\ -t \:latest services/api
          docker build -t \:\ -t \:latest services/web
        """
      }
    }
    stage('Docker Push') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh """
            echo "\" | docker login -u "\" --password-stdin
            docker push \:\; docker push \:latest
            docker push \:\; docker push \:latest
            docker logout || true
          """
        }
      }
    }
    stage('Deploy') {
      steps {
        sshagent(credentials: ['appvm-ssh-key']) {
          sh """
            ssh -o StrictHostKeyChecking=accept-new \@\ '
              set -e
              mkdir -p \ && cd \
              cat > docker-compose.yml <<EOF2
              name: paylanka-nano
              services:
                api:
                  image: \:latest
                  environment: [ "PORT=8000" ]
                  healthcheck:
                    test: ["CMD-SHELL","wget -qO- http://localhost:8000/health || exit 1"]
                    interval: 5s
                    timeout: 3s
                    retries: 20
                  networks: [appnet]
                web:
                  image: \:latest
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
          sh 'ssh \@\ "curl -fsS http://localhost/api/health"'
        }
      }
    }
  }
  post {
    success { echo "✅ Live: http://\  (try /api/health)" }
  }
}