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
    withCredentials([
      sshUserPrivateKey(credentialsId: 'appvm-ssh-key', keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER'),
      usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')
    ]) {
      sh '''#!/bin/bash
	set -euxo pipefail
        APP_HOST=172.31.9.216

        # sanity: show who we are & reachability
        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$SSH_USER@$APP_HOST" "hostname && whoami"

        # Deploy (compose file lives on the VM; create/update it and run)
        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$SSH_USER@$APP_HOST" bash -lc "
          set -euxo pipefail
          sudo mkdir -p /opt/paylanka-nano
          sudo tee /opt/paylanka-nano/docker-compose.yml >/dev/null <<'EOF'
          version: '3.9'
          services:
            api:
              image: dinithan/paylanka-nano-api:latest
              container_name: paylanka-nano-api-1
              ports: ['8000:8000']
              healthcheck:
                test: ['CMD-SHELL','wget -qO- http://localhost:8000/health || exit 1']
                interval: 5s
                timeout: 3s
                retries: 20
            web:
              image: dinithan/paylanka-nano-web:latest
              container_name: paylanka-nano-web-1
              depends_on:
                api:
                  condition: service_healthy
              ports: ['80:80']
          EOF

          # docker login for pulls (uses your Jenkins creds)
          echo '${DH_PASS}' | sudo docker login -u '${DH_USER}' --password-stdin

          # pull & up
          cd /opt/paylanka-nano
          sudo docker compose pull
          sudo docker compose up -d
        "
      '''
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
