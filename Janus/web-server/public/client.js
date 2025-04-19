document.addEventListener('DOMContentLoaded', function() {
    // Get Janus server from the browser's current URL
    const serverProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const serverHost = window.location.hostname;
    const JANUS_WS = `${serverProtocol}//${serverHost}:8989`;
    
    // DOM elements
    const videoElement = document.getElementById('videoElement');
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const streamStatus = document.getElementById('streamStatus');
    const streamForm = document.getElementById('streamForm');
    const refreshStreamsButton = document.getElementById('refreshStreams');
    const streamsList = document.getElementById('streamsList');
    
    // Global variables
    let janus = null;
    let streaming = null;
    let opaqueId = "rtspviewer-" + Janus.randomString(12);
    let selectedStreamId = null;
    
    // Initialize Janus
    Janus.init({
      debug: "all",
      dependencies: Janus.useDefaultDependencies(),
      callback: function() {
        // Make sure the browser supports WebRTC
        if(!Janus.isWebrtcSupported()) {
          updateStatus('Your browser does not support WebRTC, please use a different browser.', 'danger');
          return;
        }
        
        // Initialize the library
        initJanus();
      }
    });
    
    // Initialize Janus connection
    function initJanus() {
      janus = new Janus({
        server: JANUS_WS,
        success: function() {
          // Connect to the streaming plugin
          janus.attach({
            plugin: "janus.plugin.streaming",
            opaqueId: opaqueId,
            success: function(pluginHandle) {
              streaming = pluginHandle;
              updateStatus('Successfully connected to Janus server', 'success');
              startButton.disabled = false;
              
              // Load initial stream list
              loadStreams();
            },
            error: function(error) {
              updateStatus('Error attaching to streaming plugin: ' + error, 'danger');
              console.error("Error attaching to streaming plugin", error);
            },
            onmessage: function(msg, jsep) {
              handleMessage(msg, jsep);
            },
            onremotestream: function(stream) {
              Janus.attachMediaStream(videoElement, stream);
            },
            oncleanup: function() {
              updateStatus('Stream stopped', 'info');
              startButton.disabled = false;
              stopButton.disabled = true;
            }
          });
        },
        error: function(error) {
          updateStatus('Error connecting to Janus: ' + error, 'danger');
          console.error("Error connecting to Janus", error);
        },
        destroyed: function() {
          updateStatus('Janus session destroyed', 'warning');
        }
      });
    }
    
    // Handle incoming message from Janus
    function handleMessage(msg, jsep) {
      console.log("Got message", msg);
      
      if(msg && msg.result) {
        if(msg.result.status) {
          updateStatus('Stream status: ' + msg.result.status, 'info');
        }
      }
      
      if(jsep) {
        console.log("Got SDP!", jsep);
        streaming.createAnswer({
          jsep: jsep,
          media: { audioSend: false, videoSend: false, data: true },
          success: function(jsep) {
            console.log("Got SDP!", jsep);
            var body = { request: "start" };
            streaming.send({ message: body, jsep: jsep });
            stopButton.disabled = false;
          },
          error: function(error) {
            console.error("WebRTC error:", error);
            updateStatus('WebRTC error: ' + error, 'danger');
          }
        });
      }
    }
    
    // Update status message display
    function updateStatus(message, type = 'info') {
      streamStatus.className = 'alert alert-' + type;
      streamStatus.textContent = message;
    }
    
    // Start streaming
    startButton.addEventListener('click', function() {
      if(!selectedStreamId) {
        updateStatus('Please select a stream first', 'warning');
        return;
      }
      
      const body = { request: "watch", id: parseInt(selectedStreamId) };
      streaming.send({ message: body });
      startButton.disabled = true;
      updateStatus('Starting stream...', 'info');
    });
    
    // Stop streaming
    stopButton.addEventListener('click', function() {
      const body = { request: "stop" };
      streaming.send({ message: body });
      streaming.hangup();
      stopButton.disabled = true;
      startButton.disabled = false;
      updateStatus('Stopping stream...', 'info');
    });
    
    // Load available streams
    function loadStreams() {
      fetch('/api/streams')
        .then(response => response.json())
        .then(streams => {
          streamsList.innerHTML = '';
          
          if(streams.length === 0) {
            const noStreamsItem = document.createElement('div');
            noStreamsItem.className = 'list-group-item';
            noStreamsItem.textContent = 'No streams available. Create one using the form above.';
            streamsList.appendChild(noStreamsItem);
          } else {
            streams.forEach(stream => {
              const streamItem = document.createElement('button');
              streamItem.className = 'list-group-item list-group-item-action';
              streamItem.textContent = `${stream.name} (ID: ${stream.id})`;
              streamItem.dataset.streamId = stream.id;
              
              streamItem.addEventListener('click', function() {
                // Deselect previous selection
                document.querySelectorAll('.list-group-item-action.active').forEach(item => {
                  item.classList.remove('active');
                });
                
                // Select this stream
                this.classList.add('active');
                selectedStreamId = this.dataset.streamId;
                updateStatus(`Selected stream: ${stream.name}`, 'info');
                startButton.disabled = false;
              });
              
              streamsList.appendChild(streamItem);
            });
          }
        })
        .catch(error => {
          console.error('Error loading streams:', error);
          updateStatus('Error loading streams. Check console for details.', 'danger');
        });
    }
    
    // Refresh streams list
    refreshStreamsButton.addEventListener('click', loadStreams);
    
    // Create new stream
    streamForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const rtspUrl = document.getElementById('rtspUrl').value;
      const streamName = document.getElementById('streamName').value;
      const streamId = document.getElementById('streamId').value;
      
      fetch('/api/create-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rtspUrl: rtspUrl,
          streamName: streamName,
          streamId: streamId
        }),
      })
      .then(response => response.json())
      .then(data => {
        if(data.success) {
          updateStatus(`Stream created successfully: ${streamName}`, 'success');
          loadStreams(); // Refresh the list
        } else {
          updateStatus(`Failed to create stream: ${data.error}`, 'danger');
        }
      })
      .catch(error => {
        console.error('Error creating stream:', error);
        updateStatus('Error creating stream. Check console for details.', 'danger');
      });
    });
  });