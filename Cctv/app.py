import os
import cv2
import asyncio
import numpy as np
from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from av import VideoFrame

# RTSP URL from environment variable or use default
RTSP_URL = os.getenv("RTSP_URL", "rtsp://admin:123456@192.168.1.2:554/media/video1")

pcs = set()  # Keep track of PeerConnections


class CameraVideoStream(VideoStreamTrack):
    """
    A video stream track that reads frames from an RTSP stream using OpenCV.
    If a frame is not obtained, it sends a blank frame.
    """
    def __init__(self):
        super().__init__()  # don't forget this!
        self.cap = cv2.VideoCapture(RTSP_URL)

    async def recv(self):
        pts, time_base = await self.next_timestamp()
        ret, frame = self.cap.read()
        if not ret:
            # If reading fails, provide a blank frame
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
        # Convert BGR (OpenCV default) to RGB (expected by aiortc)
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        video_frame = VideoFrame.from_ndarray(frame, format="rgb24")
        video_frame.pts = pts
        video_frame.time_base = time_base
        return video_frame


async def offer(request):
    """
    Handler for /offer route.
    Receives a WebRTC offer from the client, attaches the camera stream,
    and responds with an answer.
    """
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    pc = RTCPeerConnection()
    pcs.add(pc)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print("Connection state is %s" % pc.connectionState)
        if pc.connectionState in ["failed", "closed"]:
            await pc.close()
            pcs.discard(pc)

    # Attach the camera video track to this PeerConnection.
    pc.addTrack(CameraVideoStream())

    # Handle the offer/answer negotiation
    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.json_response({
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type
    })


async def index(request):
    """
    Handler for / route.
    Serves the index.html file that creates the video element and initiates the WebRTC connection.
    """
    with open("templates/index.html", "r") as f:
        content = f.read()
    return web.Response(content_type="text/html", text=content)


async def on_shutdown(app):
    """
    Gracefully close all peer connections when the app shuts down.
    """
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)


if __name__ == "__main__":
    app = web.Application()
    app.on_shutdown.append(on_shutdown)
    app.router.add_get("/", index)
    app.router.add_post("/offer", offer)
    web.run_app(app, port=5002)
