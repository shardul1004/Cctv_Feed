import cv2
import streamlit as st
import numpy as np
import threading
import time
from streamlit_webrtc import webrtc_streamer, VideoProcessorBase, WebRtcMode

RTSP_URL = "rtsp://admin:123456@192.168.1.2:554/media/video1"

class RTSPProcessor(VideoProcessorBase):
    def __init__(self) -> None:
        self.rtsp_frame = None
        self.thread = threading.Thread(target=self._rtsp_thread, daemon=True)
        self.thread.start()
        
    def _rtsp_thread(self):
        # GStreamer pipeline
        gst_pipeline = (
            f"rtspsrc location={RTSP_URL} latency=0 ! "
            "rtph265depay ! h265parse ! avdec_h265 ! videoconvert ! appsink"
        )
        
        cap = cv2.VideoCapture(gst_pipeline, cv2.CAP_GSTREAMER)
        
        if not cap.isOpened():
            st.error("Failed to open RTSP stream")
            return
            
        while True:
            ret, frame = cap.read()
            if ret:
                self.rtsp_frame = frame
            else:
                # Try to reconnect
                cap.release()
                time.sleep(1)
                cap = cv2.VideoCapture(gst_pipeline, cv2.CAP_GSTREAMER)
                
    def recv(self, frame):
        if self.rtsp_frame is not None:
            img = self.rtsp_frame.copy()
            # Convert to RGB for WebRTC
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            # Return the RTSP frame instead of the webcam frame
            return av.VideoFrame.from_ndarray(img, format="rgb24")
        return frame

st.title("🔴 RTSP Camera Viewer")

# The critical change is here - use SERVER_OFFER mode
webrtc_streamer(
    key="rtsp",
    mode=WebRtcMode.SENDRECV,  # Use this mode to override browser camera
    rtc_configuration={"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]},
    video_processor_factory=RTSPProcessor,
    async_processing=True,
)