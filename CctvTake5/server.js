// server.js
const kurento = require('kurento-client');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { execSync } = require('child_process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server: server, path: '/kurento' });

// Configure Kurento and RTSP URL endpoints via environment variables or defaults.
// Use the exact URLs without any trailing spaces
const KURENTO_WS_URL = process.env.KURENTO_WS_URL || 'ws://localhost:8888/kurento';
const RTSP_URL = process.env.RTSP_URL || 'rtsp://admin:123456@192.168.1.2:554/media/video2';

console.log(`Using Kurento Media Server at: ${KURENTO_WS_URL}`);
console.log(`Using RTSP URL: ${RTSP_URL}`);

// Test Kurento connectivity
function testKurentoConnectivity() {
  try {
    console.log("Testing network connectivity to Kurento server...");
    
    // Extract host and port from WebSocket URL
    const url = new URL(KURENTO_WS_URL);
    const host = url.hostname;
    const port = url.port || (url.protocol === 'wss:' ? 443 : 80);
    
    console.log(`Attempting to ping Kurento host: ${host}`);
    try {
      execSync(`ping -c 1 ${host}`);
      console.log(`✅ Ping to ${host} successful`);
    } catch (error) {
      console.error(`❌ Cannot ping ${host}: ${error.message}`);
    }
    
    console.log(`Checking if port ${port} is open on ${host}...`);
    try {
      const netcat = execSync(`nc -zv ${host} ${port} -w 5 2>&1 || echo "Connection failed"`);
      console.log(netcat.toString());
    } catch (error) {
      console.error(`❌ Port check error: ${error.message}`);
    }
    
    console.log("Network connectivity test completed");
  } catch (error) {
    console.error("Error in network connectivity test:", error);
  }
}

// Test the connectivity
testKurentoConnectivity();

let kurentoClient = null;
let reconnectInterval = null;

// Function to get (or create) a Kurento client instance
function getKurentoClient(callback) {
  if (kurentoClient) {
    return callback(null, kurentoClient);
  }
  
  console.log(`Attempting to connect to Kurento at ${KURENTO_WS_URL}`);
  
  // Connection options with timeout
  const options = {
    request_timeout: 30000,  // 30 seconds
    retry: {
      max: 5,
      timeout: 3000  // 3 seconds between retries
    }
  };
  
  kurento(KURENTO_WS_URL, options, (error, _kurentoClient) => {
    if (error) {
      console.error(`Could not find Kurento Media Server at ${KURENTO_WS_URL}`, error);
      return callback(`Could not connect to Kurento at ${KURENTO_WS_URL}: ${error}`);
    }
    
    console.log('✅ Successfully connected to Kurento Media Server');
    
    // Set up event listeners
    _kurentoClient.on('disconnected', () => {
      console.error('Disconnected from Kurento Media Server');
      kurentoClient = null;
      
      // Set up reconnection
      if (!reconnectInterval) {
        reconnectInterval = setInterval(() => {
          console.log('Attempting to reconnect to Kurento...');
          getKurentoClient((error, client) => {
            if (!error && client) {
              console.log('Reconnected to Kurento Media Server');
              clearInterval(reconnectInterval);
              reconnectInterval = null;
            }
          });
        }, 5000); // Try to reconnect every 5 seconds
      }
    });
    
    kurentoClient = _kurentoClient;
    callback(null, kurentoClient);
  });
}

// Object to keep session-specific information
let sessions = {};

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    stopSession(ws);
  });
  
  ws.on('message', (message) => {
    try {
      let msg = JSON.parse(message);
      console.log('Received message:', msg.id);
      
      switch (msg.id) {
        case 'start':
          startSession(ws, msg.sdpOffer);
          break;
        case 'stop':
          stopSession(ws);
          break;
        case 'onIceCandidate': {
          // Handle ICE candidate message
          let candidate = kurento.getComplexType('IceCandidate')(msg.candidate);
          if (sessions[ws] && sessions[ws].webRtcEndpoint) {
            console.log('Adding ICE candidate');
            sessions[ws].webRtcEndpoint.addIceCandidate(candidate, (error) => {
              if (error) {
                console.error("Error adding ICE candidate:", error);
                ws.send(JSON.stringify({ id: 'error', message: error.message || error }));
              }
            });
          } else {
            console.error('No WebRtcEndpoint found for ICE candidate');
            ws.send(JSON.stringify({ id: 'error', message: 'No WebRtcEndpoint found for ICE candidate' }));
          }
          break;
        }
        default:
          ws.send(JSON.stringify({ id: 'error', message: `Invalid message: ${msg.id}` }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ id: 'error', message: `Error processing message: ${error.message || error}` }));
    }
  });
});

// Start a media streaming session
function startSession(ws, sdpOffer) {
  console.log('Starting session with SDP offer');
  
  getKurentoClient((error, kurentoClient) => {
    if (error) {
      console.error('Failed to get Kurento client:', error);
      return ws.send(JSON.stringify({ id: 'error', message: `Failed to get Kurento client: ${error}` }));
    }
    
    // Create a media pipeline for this session
    console.log('Creating media pipeline');
    kurentoClient.create('MediaPipeline', (error, pipeline) => {
      if (error) {
        console.error('Error creating MediaPipeline:', error);
        return ws.send(JSON.stringify({ id: 'error', message: `Error creating MediaPipeline: ${error.message || error}` }));
      }

      console.log('MediaPipeline created successfully');
      
      // Save the pipeline in the session (for later cleanup)
      sessions[ws] = { pipeline: pipeline };

      // Create a PlayerEndpoint to read from the RTSP URL
      console.log(`Creating PlayerEndpoint with URI: ${RTSP_URL}`);
      pipeline.create('PlayerEndpoint', { uri: RTSP_URL }, (error, playerEndpoint) => {
        if (error) {
          console.error('Error creating PlayerEndpoint:', error);
          return ws.send(JSON.stringify({ id: 'error', message: `Error creating PlayerEndpoint: ${error.message || error}` }));
        }

        console.log('PlayerEndpoint created successfully');

        // Create a WebRtcEndpoint to deliver media to the client via WebRTC
        console.log('Creating WebRtcEndpoint');
        pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
          if (error) {
            console.error('Error creating WebRtcEndpoint:', error);
            return ws.send(JSON.stringify({ id: 'error', message: `Error creating WebRtcEndpoint: ${error.message || error}` }));
          }

          console.log('WebRtcEndpoint created successfully');

          // Listen for ICE candidates generated on the server side
          webRtcEndpoint.on('OnIceCandidate', (event) => {
            console.log('Server-side ICE candidate generated');
            let candidate = kurento.getComplexType('IceCandidate')(event.candidate);
            ws.send(JSON.stringify({
              id: 'iceCandidate',
              candidate: candidate
            }));
          });

          // Store endpoints for cleanup if needed
          sessions[ws].playerEndpoint = playerEndpoint;
          sessions[ws].webRtcEndpoint = webRtcEndpoint;

          // Connect the PlayerEndpoint with the WebRtcEndpoint
          console.log('Connecting PlayerEndpoint to WebRtcEndpoint');
          playerEndpoint.connect(webRtcEndpoint, (error) => {
            if (error) {
              console.error('Error connecting endpoints:', error);
              return ws.send(JSON.stringify({ id: 'error', message: `Error connecting endpoints: ${error.message || error}` }));
            }

            console.log('Endpoints connected successfully');

            // Process the SDP offer received from the client
            console.log('Processing SDP offer');
            webRtcEndpoint.processOffer(sdpOffer, (error, sdpAnswer) => {
              if (error) {
                console.error('Error processing SDP offer:', error);
                return ws.send(JSON.stringify({ id: 'error', message: `Error processing SDP offer: ${error.message || error}` }));
              }

              console.log('SDP offer processed successfully');

              // Gather ICE candidates
              webRtcEndpoint.gatherCandidates((error) => {
                if (error) {
                  console.error('Error gathering ICE candidates:', error);
                  return ws.send(JSON.stringify({ id: 'error', message: `Error gathering ICE candidates: ${error.message || error}` }));
                }
                console.log('ICE candidates gathering initiated');
              });

              // Send back the SDP answer to the client
              console.log('Sending SDP answer to client');
              ws.send(JSON.stringify({ id: 'startResponse', sdpAnswer: sdpAnswer }));

              // Start playing the RTSP stream
              console.log('Starting PlayerEndpoint');
              playerEndpoint.play((error) => {
                if (error) {
                  console.error('Error playing stream:', error);
                  return ws.send(JSON.stringify({ id: 'error', message: `Error playing stream: ${error.message || error}` }));
                }
                console.log('PlayerEndpoint started successfully');
              });
            });
          });
        });
      });
    });
  });
}

// Stop the current session and release resources
function stopSession(ws) {
  if (sessions[ws]) {
    console.log('Stopping session and releasing resources');
    if (sessions[ws].pipeline) {
      sessions[ws].pipeline.release();
    }
    delete sessions[ws];
    try {
      ws.send(JSON.stringify({ id: 'stopResponse', message: 'Session stopped' }));
    } catch (error) {
      console.error('Error sending stop response:', error);
    }
  }
}

// Serve static files from the public folder
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});