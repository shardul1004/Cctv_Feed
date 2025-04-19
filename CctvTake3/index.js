const rtspStream = require('node-rtsp-stream');

var ip_address = "192.168.1.2";  // Replace with your camera's IP address
var username = "admin";          // Replace with your camera's username
var password = "password";          // Replace with your camera's password

var stream = new rtspStream({
    streamUrl: 'rtsp://admin:123456@192.168.1.2:554/media/video1',
    wsPort: 9999,
    ffmpegOptions: { // Add options for FFmpeg
        '-rtsp_transport': 'tcp',
    '-f': 'mpegts',
    '-codec:v': 'mpeg1video',
    '-pix_fmt': 'yuv420p',
    '-b:v': '1000k',
    '-r': '25'
    }
});
