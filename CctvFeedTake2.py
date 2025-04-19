# app.py - Flask server for RTSP stream processing
import cv2
import threading
import time
from flask import Flask, Response, render_template
import logging
import os
from dotenv import load_dotenv
import numpy as np

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("app.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)

# Configuration
class Config:
    RTSP_URL = os.getenv('RTSP_URL', 'rtsp://your-camera-ip:554/stream')
    FRAME_RATE = int(os.getenv('FRAME_RATE', 30))
    RETRY_INTERVAL = int(os.getenv('RETRY_INTERVAL', 5))
    RECONNECT_ATTEMPTS = int(os.getenv('RECONNECT_ATTEMPTS', 5))

class RTSPStream:
    def __init__(self, url):
        self.url = url
        self.cap = None
        self.frame = None
        self.stopped = False
        self.connected = False
        self.lock = threading.Lock()
        self.connect_attempts = 0

    def connect(self):
        """Connect to the RTSP stream"""
        if self.cap is not None:
            self.cap.release()
        
        logger.info(f"Connecting to RTSP stream: {self.url}")
        
        try:
            self.cap = cv2.VideoCapture(self.url)
            if not self.cap.isOpened():
                logger.error("Failed to open RTSP stream")
                self.connected = False
                return False
                
            logger.info("Successfully connected to RTSP stream")
            self.connected = True
            self.connect_attempts = 0
            return True
        except Exception as e:
            logger.error(f"Error connecting to RTSP stream: {str(e)}")
            self.connected = False
            return False

    def start(self):
        """Start the thread to read frames from the RTSP stream"""
        self.stopped = False
        threading.Thread(target=self.update, daemon=True).start()
        return self

    def update(self):
        """Continuously read frames from the stream"""
        while not self.stopped:
            if not self.connected:
                self.connect_attempts += 1
                if self.connect_attempts > Config.RECONNECT_ATTEMPTS:
                    logger.error(f"Maximum reconnection attempts ({Config.RECONNECT_ATTEMPTS}) reached")
                    self.stopped = True
                    break
                    
                if self.connect():
                    logger.info("Reconnected to RTSP stream")
                else:
                    logger.info(f"Reconnection attempt {self.connect_attempts} failed. Retrying in {Config.RETRY_INTERVAL} seconds")
                    time.sleep(Config.RETRY_INTERVAL)
                    continue

            try:
                ret, frame = self.cap.read()
                if not ret:
                    logger.warning("Failed to read frame from RTSP stream")
                    self.connected = False
                    continue
                
                # Process the frame (you can add any image processing here)
                # For example: convert to grayscale, apply filters, detect objects, etc.
                # frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                
                with self.lock:
                    self.frame = frame
                    
                # Control the frame rate
                time.sleep(1 / Config.FRAME_RATE)
                    
            except Exception as e:
                logger.error(f"Error reading from RTSP stream: {str(e)}")
                self.connected = False
                
    def read(self):
        """Return the most recent frame"""
        with self.lock:
            if self.frame is None:
                return False, None
            return True, self.frame.copy()
            
    def stop(self):
        """Stop the streaming thread and release resources"""
        self.stopped = True
        if self.cap is not None:
            self.cap.release()
        logger.info("RTSP stream stopped")
        
# Initialize RTSP stream
stream = RTSPStream(Config.RTSP_URL)

def generate_frames():
    """Generate MJPEG frames for streaming"""
    stream.start()
    
    while True:
        ret, frame = stream.read()
        if not ret:
            # If no frame is available, return a blank frame
            blank_frame = np.zeros((480, 640, 3), np.uint8)
            _, buffer = cv2.imencode('.jpg', blank_frame)
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            time.sleep(0.5)
            continue
            
        # Encode frame as JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    """Stream the video feed"""
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/health')
def health_check():
    """Health check endpoint"""
    if stream.connected:
        return {'status': 'healthy', 'message': 'RTSP stream active'}, 200
    else:
        return {'status': 'unhealthy', 'message': 'RTSP stream disconnected'}, 503

def cleanup():
    """Clean up resources when the application exits"""
    stream.stop()

# Register cleanup function to be called on exit
import atexit
atexit.register(cleanup)

if __name__ == '__main__':
    # Start the Flask server
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)