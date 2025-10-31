## Deploying PayLanka with Ansible via Jenkins

- Inventory: infra/ansible/inventory.ini
- Playbook:  infra/ansible/deploy.yml
- Role:      infra/ansible/roles/app
- Jenkins:   Pipeline uses this repo to run Ansible on the App VM.

**Quick test (local):**
ansible-playbook -i infra/ansible/inventory.ini infra/ansible/deploy.yml --private-key ~/.ssh/id_rsa
