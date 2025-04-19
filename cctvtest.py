import cv2
cap = cv2.VideoCapture("rtsp://admin:123456@192.168.1.2:554/media/video2")
if not cap.isOpened():
    print("Could not open stream")
while True:
    ret, frame = cap.read()
    if not ret:
        break
    cv2.imshow("RTSP Stream", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break
cap.release()
cv2.destroyAllWindows()