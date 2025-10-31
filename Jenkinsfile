pipeline {
  agent any
  options { timestamps() }
  parameters {
    string(name: 'APP_HOST', defaultValue: '', description: 'App VM IP (overrides inventory if set)')
    string(name: 'API_IMAGE', defaultValue: 'dinithan/paylanka-nano-api:latest', description: 'API image:tag')
    string(name: 'WEB_IMAGE', defaultValue: 'dinithan/paylanka-nano-web:latest', description: 'WEB image:tag')
    string(name: 'DB_HOST', defaultValue: 'RDS_ENDPOINT_OR_LOCALHOST', description: 'DB host')
    string(name: 'DB_USER', defaultValue: 'postgres', description: 'DB user')
    password(name: 'DB_PASSWORD', defaultValue: 'postgres', description: 'DB password')
    string(name: 'DB_NAME', defaultValue: 'paylanka', description: 'DB name')
    string(name: 'API_PORT', defaultValue: '8000', description: 'API host port')
    string(name: 'WEB_PORT', defaultValue: '80', description: 'WEB host port')
  }
  environment { SSH_KEY_ID = 'appvm-ssh' }
  stages {
    stage('Checkout'){ steps { checkout scm } }
    stage('Deploy with Ansible') {
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: env.SSH_KEY_ID, keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER')]) {
          sh '''
            set -euo pipefail
            sudo apt-get update -y && sudo apt-get install -y ansible
            if [ -n "" ]; then
              echo "[app]" > infra/ansible/inventory.override.ini
              echo "appvm ansible_host= ansible_user=" >> infra/ansible/inventory.override.ini
              INV="infra/ansible/inventory.override.ini"
            else
              INV="infra/ansible/inventory.ini"
            fi
            ansible-playbook -i "" infra/ansible/deploy.yml \
              --private-key "" \
              --extra-vars "docker_api_image= docker_web_image= api_port= web_port= env_vars={'DB_HOST':'','DB_PORT':'5432','DB_USER':'','DB_PASSWORD':'','DB_NAME':'','NODE_ENV':'production','API_BASE_URL':'http://localhost:'}"
          '''
        }
      }
    }
  }
}
