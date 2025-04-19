const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Janus server configuration
const JANUS_SERVER = process.env.JANUS_SERVER || 'http://localhost:8088/janus';

// API route to create a streaming mountpoint for RTSP
app.post('/api/create-stream', async (req, res) => {
  try {
    const { rtspUrl, streamName, streamId } = req.body;
    
    if (!rtspUrl || !streamName || !streamId) {
      return res.status(400).json({ error: 'RTSP URL, stream name, and stream ID are required' });
    }
    
    // Create a session with Janus
    const sessionResponse = await axios.post(JANUS_SERVER, {
      janus: 'create',
      transaction: generateTransactionId()
    });
    
    const sessionId = sessionResponse.data.data.id;
    
    // Attach to the streaming plugin
    const attachResponse = await axios.post(`${JANUS_SERVER}/${sessionId}`, {
      janus: 'attach',
      plugin: 'janus.plugin.streaming',
      transaction: generateTransactionId()
    });
    
    const handleId = attachResponse.data.data.id;
    
    // Create the streaming mountpoint
    const createStreamResponse = await axios.post(`${JANUS_SERVER}/${sessionId}/${handleId}`, {
      janus: 'message',
      body: {
        request: 'create',
        type: 'rtsp',
        name: streamName,
        id: parseInt(streamId),
        audio: true,
        video: true,
        url: rtspUrl,
        rtsp_reconnect: true
      },
      transaction: generateTransactionId()
    });
    
    if (createStreamResponse.data.janus === 'success') {
      res.json({ 
        success: true, 
        message: 'Stream created successfully',
        streamId: streamId,
        streamName: streamName
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to create stream', 
        details: createStreamResponse.data 
      });
    }
  } catch (error) {
    console.error('Error creating stream:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Route to list available streams
app.get('/api/streams', async (req, res) => {
  try {
    // Create a session with Janus
    const sessionResponse = await axios.post(JANUS_SERVER, {
      janus: 'create',
      transaction: generateTransactionId()
    });
    
    const sessionId = sessionResponse.data.data.id;
    
    // Attach to the streaming plugin
    const attachResponse = await axios.post(`${JANUS_SERVER}/${sessionId}`, {
      janus: 'attach',
      plugin: 'janus.plugin.streaming',
      transaction: generateTransactionId()
    });
    
    const handleId = attachResponse.data.data.id;
    
    // List streams
    const listResponse = await axios.post(`${JANUS_SERVER}/${sessionId}/${handleId}`, {
      janus: 'message',
      body: {
        request: 'list'
      },
      transaction: generateTransactionId()
    });
    
    if (listResponse.data.plugindata && listResponse.data.plugindata.data) {
      res.json(listResponse.data.plugindata.data.list || []);
    } else {
      res.status(500).json({ error: 'Failed to get stream list' });
    }
  } catch (error) {
    console.error('Error listing streams:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Helper function to generate transaction IDs
function generateTransactionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
