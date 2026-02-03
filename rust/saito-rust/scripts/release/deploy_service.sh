#!/usr/bin/env sh
cp scripts/release/saito.service /etc/systemd/system/
sudo sed -i "s|working_dir|$(pwd)|g" /etc/systemd/system/saito.service
cp scripts/release/config.template.json config/config.json
sudo systemctl daemon-reload
sudo systemctl enable saito.service
echo "Configure the config file at config/config.json and start the service !"
