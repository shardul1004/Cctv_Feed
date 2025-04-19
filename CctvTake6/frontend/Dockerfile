FROM nginx:alpine

# Copy the HTML file to the nginx html directory
COPY index.html /usr/share/nginx/html/index.html

# Expose port 80
EXPOSE 8501

# Start nginx
CMD ["nginx", "-g", "daemon off;"]