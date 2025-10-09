#!/usr/bin/env sh
cp scripts/saito.service /etc/systemd/system/
sudo sed -i "s|working_dir|$(pwd)|g" /etc/systemd/system/saito.service
sudo systemctl daemon-reload
sudo systemctl enable saito.service
sudo systemctl start saito.service
