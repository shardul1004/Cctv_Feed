#!/bin/bash

# Check if docker and docker-compose are installed
if ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
    echo "Docker or Docker Compose not found. Please install them first."
    exit 1
fi

# Check if user provided RTSP URL
if [ -z "$1" ]; then
    echo "Please provide your IP camera's RTSP URL as an argument."
    echo "Usage: $0 rtsp://username:password@camera-ip:port/stream"
    exit 1
fi

# Create a backup of the config file if it exists
if [ -f "mediamtx.yml" ]; then
    cp mediamtx.yml mediamtx.yml.backup
    echo "Backup of previous configuration created as mediamtx.yml.backup"
fi

# Update the config file with the provided RTSP URL
sed "s|rtsp://REPLACE_WITH_YOUR_IP_CAM_URL|$1|g" mediamtx.yml > mediamtx.yml.tmp
mv mediamtx.yml.tmp mediamtx.yml

echo "Configuration updated with your RTSP URL"
echo "Starting MediaMTX..."

# Starting the container
docker-compose up -d

# Check if container is running
if [ $? -eq 0 ] && docker ps | grep -q mediamtx; then
    echo "MediaMTX is now running!"
    echo ""
    echo "Access your stream at:"
    echo "- Web interface: http://localhost:8501"
    echo "- RTSP: rtsp://localhost:8554/ipcamera"
    echo "- HLS: http://localhost:8888/ipcamera"
    
    # Get the local IP for accessing from other devices
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    if [ ! -z "$LOCAL_IP" ]; then
        echo ""
        echo "Access from other devices on your network:"
        echo "- Web interface: http://$LOCAL_IP:8501"
        echo "- RTSP: rtsp://$LOCAL_IP:8554/ipcamera"
        echo "- HLS: http://$LOCAL_IP:8888/ipcamera"
    fi
else
    echo "Error: MediaMTX failed to start. Check the logs with 'docker-compose logs'"
fi