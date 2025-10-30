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
    sshagent(credentials: ['appvm-ssh']) {
      sh '''
        set -e
        APP_HOST=172.31.9.216

        # Pull newest images on the app VM and (re)start containers
        ssh -o StrictHostKeyChecking=accept-new ubuntu@$APP_HOST '
          docker login -u dinithan -p "$DH_PASS"
          docker pull dinithan/paylanka-nano-api:${VERSION:-latest}
          docker pull dinithan/paylanka-nano-web:${VERSION:-latest}

          # stop old containers (ignore errors if not present)
          docker rm -f paylanka-nano-api-1 paylanka-nano-web-1 2>/dev/null || true

          # run API (example)
          docker run -d --name paylanka-nano-api-1 \
            -p 8000:8000 \
            dinithan/paylanka-nano-api:${VERSION:-latest}

          # run Web
          docker run -d --name paylanka-nano-web-1 \
            -p 80:80 \
            --link paylanka-nano-api-1:api \
            dinithan/paylanka-nano-web:${VERSION:-latest}
        '
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
