# Use the official MediaMTX image
FROM bluenviron/mediamtx:latest

# Copy our configuration file
COPY mediamtx.yml /mediamtx.yml

# MediaMTX exposes several ports
EXPOSE 8501 8554 8888 8889 1935

# The entrypoint is already set in the base image