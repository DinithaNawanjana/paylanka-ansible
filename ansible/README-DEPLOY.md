# Ansible Deploy (inside paylanka-nano)

- Inventory: ansible/inventory.ini
- Playbook : ansible/deploy.yml
- Role     : ansible/roles/app

## Run manually
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml --private-key ~/.ssh/id_appvm

## Run from Jenkins (Deploy stage)
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml --private-key /var/lib/jenkins/.ssh/id_appvm