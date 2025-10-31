pipeline {
  agent any
  options { timestamps(); ansiColor('xterm'); skipDefaultCheckout() }

  environment {
    DOCKERHUB_CREDS = 'docker-hub'            // Jenkins creds: username/password
    DOCKER_USER     = 'dinithan'
    API_IMG         = "${DOCKER_USER}/paylanka-nano-api"
    WEB_IMG         = "${DOCKER_USER}/paylanka-nano-web"
    MAIN_BRANCH     = 'main'
    // For triggering CD
    GH_PAT_CRED     = 'github-pat'            // Jenkins secret text: PAT with repo/workflow scopes
    CD_OWNER        = 'DinithaNawanjana'      // your GitHub user/org
    CD_REPO         = 'paylanka-ansible'      // infra/deploy repo
    CD_WORKFLOW     = 'deploy.yml'            // Actions workflow filename in paylanka-ansible
  }

  stages {
    stage('Checkout') {
      steps {
        git branch: "${env.MAIN_BRANCH}",
            url: 'https://github.com/DinithaNawanjana/paylanka-nano.git',
            credentialsId: 'github-https'     // or remove if public
      }
    }

    stage('Compute Tag') {
      steps {
        script {
          env.SHORT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.BUILD_TAG = "${SHORT_SHA}"
        }
      }
    }

    stage('Build & Test') {
      steps {
        sh '''bash <<'BASH'
set -euo pipefail
# build
docker build -t ${API_IMG}:${BUILD_TAG} -t ${API_IMG}:latest services/api
docker build -t ${WEB_IMG}:${BUILD_TAG} -t ${WEB_IMG}:latest services/web

# (optional) quick API container test
docker run --rm -d --name t_api -p 18000:8000 ${API_IMG}:${BUILD_TAG}
for i in {1..30}; do curl -fsS http://127.0.0.1:18000/health && ok=1 && break || sleep 1; done
docker rm -f t_api >/dev/null 2>&1 || true
[ "${ok:-}" = "1" ]
BASH
'''
      }
    }

    stage('Login & Push') {
      steps {
        withCredentials([usernamePassword(credentialsId: "${DOCKERHUB_CREDS}", usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh '''bash <<BASH
set -euo pipefail
echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
docker push ${API_IMG}:${BUILD_TAG}
docker push ${API_IMG}:latest
docker push ${WEB_IMG}:${BUILD_TAG}
docker push ${WEB_IMG}:latest
docker logout || true
BASH
'''
        }
      }
    }

    stage('Trigger CD (GitHub Actions)') {
      when { branch 'main' }
      steps {
        withCredentials([string(credentialsId: "${GH_PAT_CRED}", variable: 'GH_PAT')]) {
          sh '''bash <<BASH
set -euo pipefail
# Trigger Actions workflow_dispatch and pass tag to deploy
curl -sS -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GH_PAT}" \
  https://api.github.com/repos/${CD_OWNER}/${CD_REPO}/actions/workflows/${CD_WORKFLOW}/dispatches \
  -d "{\"ref\":\"main\",\"inputs\":{\"image_tag\":\"${BUILD_TAG}\"}}" | cat
BASH
'''
        }
      }
    }
  }

  post {
    success { echo "✅ CI done. Images: ${API_IMG}:${BUILD_TAG}, ${WEB_IMG}:${BUILD_TAG}. CD triggered." }
    failure { echo "❌ CI failed. See logs." }
  }
}
