import streamlit as st
import cv2
from streamlit_autorefresh import st_autorefresh

st.markdown(
    """
    <style>
    .stApp {
        background: linear-gradient(135deg, #cad0ff, #e3e3e3);
        color: #333333;
    }
    .css-18e3th9 {
        padding: 0;
    }
    input, button {
        color: #333333;
        background-color: #f0f0f0;
        border: 1px solid #cccccc;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("Pund's Home Front door stream ;)")

# Password input
password = st.text_input("Enter password to access the stream", type="password")

if password == "humarapassword":
    st.success("Password correct. Starting video stream...")

    # Set up automatic refresh every 100 ms
    st_autorefresh(interval=100, limit=10000, key="stream_refresher")

    # Create a placeholder for the video stream
    frame_placeholder = st.empty()

    cap = cv2.VideoCapture('rtsp://admin:123456@192.168.1.2:554/media/video1')
    ret, frame = cap.read()

    if not ret:
        st.error("Error: Could not read frame from the stream.")
    else:
        frameRGB = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frame_placeholder.image(frameRGB, channels="RGB", use_column_width=True)

    cap.release()
else:
    st.warning("Please enter the correct password to start the stream.")
