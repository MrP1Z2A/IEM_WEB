import { AccessToken, TrackSource, RoomServiceClient } from 'livekit-server-sdk';

/**
 * Netlify Serverless Function to securely generate LiveKit tokens.
 * Located at "/netlify/functions/get-livekit-token.js".
 */
export async function handler(event, context) {
  // CORS Headers to allow frontend access
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PATCH, DELETE, PUT',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  const { userId, userName, roomId, isTeacher } = event.queryStringParameters || {};

  if (!userId || !roomId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing userId or roomId' }),
    };
  }

  // Load from Netlify environment variables, fallback to your Contabo keys
  const API_KEY = process.env.LIVEKIT_API_KEY || 'API5hBaiUqUpxax';
  const API_SECRET = process.env.LIVEKIT_API_SECRET || '54zPSnSf0PW4bqsmnWS34SlfAUYOCIhoQ6AxDOlyuBt';
  
  // Dynamically convert wss:// to https:// for RoomServiceClient connection
  let livekitUrl = process.env.VITE_LIVEKIT_WS_URL || process.env.LIVEKIT_URL || 'ws://84.247.149.188:7880';
  if (livekitUrl.startsWith('wss://')) {
    livekitUrl = livekitUrl.replace('wss://', 'https://');
  } else if (livekitUrl.startsWith('ws://')) {
    livekitUrl = livekitUrl.replace('ws://', 'http://');
  }

  try {
    // Connect to LiveKit Cloud to list active rooms
    const roomService = new RoomServiceClient(livekitUrl, API_KEY, API_SECRET);
    
    // SECURITY: Students cannot join until Teacher starts the room
    if (isTeacher !== 'true') {
      const rooms = await roomService.listRooms();
      const roomExists = rooms.some(r => r.name === roomId);
      if (!roomExists) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error: 'The teacher has not started this meeting yet. Please wait for them to begin.'
          }),
        };
      }
    }

    const at = new AccessToken(API_KEY, API_SECRET, {
      identity: userId,
      name: userName || 'Anonymous',
      ttl: 3600,
    });

    const grants = { 
      roomJoin: true, 
      room: roomId, 
      canSubscribe: true, 
      canPublishData: true, 
      canPublish: true 
    };

    if (isTeacher === 'true') {
      grants.canPublishSources = [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE];
    } else {
      grants.canPublishSources = [TrackSource.CAMERA, TrackSource.MICROPHONE];
    }

    at.addGrant(grants);
    
    const token = await at.toJwt();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
