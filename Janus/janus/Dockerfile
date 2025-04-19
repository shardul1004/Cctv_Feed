# janus/Dockerfile
FROM canyan/janus-gateway:latest

# Install additional dependencies for RTSP
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libavformat-dev \
    libavcodec-dev \
    libavutil-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create configuration directory
RUN mkdir -p /usr/local/etc/janus

# Expose ports
EXPOSE 8088 8188 8989 8989/udp 10000-10200/udp

# Set working directory
WORKDIR /usr/local/etc/janus

# Start Janus
CMD ["/usr/local/bin/janus"]