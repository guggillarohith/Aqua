current ip for RPi: 192.168.0.142
cannot access /dev/ttyUSB0 : sudo chmod 666 /dev/ttyUSB0

to login in Pi from ubuntu
  ssh pi@192.168.0.142
  password: raspberry

#to run the task as shell in background: (use '&' in last)
  node /home/pi/aqua-do/server.js &

# To Know the pid:
  ps -aux | grep server.js
  or
  ps -ef | grep server.js

# To kill the background process :
  sudo kill -9 <pid>

# read this link for understanding cron :
  https://www.raspberrypi.org/documentation/linux/usage/cron.md

# some crontab cmd
  service crond restart
  sudo crontab -l
  sudo crontab -e
  export VISUAL=nano; crontab -e (to open in nano editor)

log file in  &>/tmp/mycommand.log
to reboot / shutdown raspberry pi
  sudo shutdown -h now (or sudo halt) OR
  sudo shutdown -r now (or sudo reboot)

# Node inspector web terminal
  node-debug --web-host 127.0.0.2 server.js{app location}

------ Change wifi connection--
  #1 sscan wifi networks
    sudo iwlist wlan0 scan
  #2 add your Wi-Fi settings to the wpa-supplicant configuration file
    sudo nano /etc/wpa_supplicant/wpa_supplicant.conf

    network={
      ssid="The_ESSID_from_earlier"
      psk="Your_wifi_password"
  }


--- Setting up new network :----
  1. followlink : https://www.digikey.com/en/maker/blogs/raspberry-pi-3-how-to-configure-wi-fi-and-bluetooth/03fcd2a252914350938d8c5471cf3b63

  2. For knowing the Ip:
connect rpi to router and install fing app in android mobile and see the dynamic ip for raspberry.with the help of this ip we can login to rpi.

  3. to set a fixed ip : https://www.modmypi.com/blog/how-to-give-your-raspberry-pi-a-static-ip-address-update

--- In Rspi
allow-hotplug wlan0
iface wlan0 inet manual
    wpa-conf /etc/wpa_supplicant/wpa_supplicant.conf

----VNC server on R Pi
  ref : https://www.raspberrypi.org/documentation/remote-access/vnc/