import streamlit as st
import cv2
from time import sleep
import queue
import threading
# Inject custom CSS for a gradient background and responsive layout
st.markdown(
    """
    <style>
    /* Apply full-screen gradient background with specified colors */
    .stApp {
        background: linear-gradient(135deg, #cad0ff, #e3e3e3);
        color: #333333;  /* Darker text color for contrast */
    }
    /* Adjusting container padding for a clean look */
    .css-18e3th9 {
        padding: 0;
    }
    /* Optional: Style the input and button elements */ 
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

# Create a password field
password = st.text_input("Enter password to access the stream", type="password")
frameQueue = queue.Queue(maxsize=10)
if password == "humarapassword":
    # Create a placeholder for the video stream
    frame_placeholder = st.empty()

    # Open the RTSP camera (change index or URL if needed)
    cap = cv2.VideoCapture('rtsp://admin:123456@192.168.1.13:554/media/video1')

    # Check if camera opened successfully
    if not cap.isOpened():
        st.error("Error: Could not open stream Ahh shit here we go again")
    else:
        def rtsp_reader():
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    st.error("Internal Error: Ahh!! shit here we go again ")
                    break

                if frameQueue.full():
                    try:
                        frameQueue.get_nowait()
                    except Exception:
                        pass
                
                frameQueue.put(frame)
        
        thread = threading.Thread(target=rtsp_reader, daemon=True)
        thread.start()
        st.success("Password correct. Starting video stream...")
        framePlaceholder = st.empty()

        while True:
            if not frameQueue.empty():
                frame = frameQueue.get()
                frameRGB = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                framePlaceholder.image(frameRGB, channels="RGB")
            else:
                sleep(0.01)
    # Release the camera resource (this line may not execute if the loop is stopped manually)
    cap.release()
else:
    st.warning("Please enter the correct password to start the stream.")
