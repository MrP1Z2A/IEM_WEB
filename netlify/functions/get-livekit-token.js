import crypto from 'crypto';

/**
 * Netlify Serverless Function to securely generate LiveKit tokens.
 * Uses standard Node.js crypto to completely bypass Netlify module bundler bugs.
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
    return { statusCode: 200, headers, body: '' };
  }

  const { userId, userName, roomId, isTeacher } = event.queryStringParameters || {};

  if (!userId || !roomId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing userId or roomId' }),
    };
  }

  const API_KEY = process.env.LIVEKIT_API_KEY;
  const API_SECRET = process.env.LIVEKIT_API_SECRET;
  
  let livekitUrl = process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_WS_URL;
  if (!livekitUrl) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'LIVEKIT_URL or VITE_LIVEKIT_WS_URL environment variable is missing in Netlify' }),
    };
  }

  // Convert WebSocket URL to HTTP for API requests
  let livekitHttpUrl = livekitUrl;
  if (livekitHttpUrl.startsWith('wss://')) livekitHttpUrl = livekitHttpUrl.replace('wss://', 'https://');
  if (livekitHttpUrl.startsWith('ws://')) livekitHttpUrl = livekitHttpUrl.replace('ws://', 'http://');

  // Helper to generate standard LiveKit JWTs using native crypto
  function signJwt(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest('base64url');
    return `${signatureInput}.${signature}`;
  }

  try {
    // SECURITY: Students cannot join until Teacher starts the room
    if (isTeacher !== 'true') {
      // Create a short-lived admin token just to list rooms
      const adminToken = signJwt({
        exp: Math.floor(Date.now() / 1000) + 60,
        iss: API_KEY,
        video: { roomList: true }
      }, API_SECRET);

      const listRoomsRes = await fetch(`${livekitHttpUrl}/twirp/livekit.RoomService/ListRooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!listRoomsRes.ok) {
        throw new Error(`Failed to list rooms: ${listRoomsRes.statusText}`);
      }

      const data = await listRoomsRes.json();
      const roomExists = data.rooms && data.rooms.some(r => r.name === roomId);
      
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

    // Generate the actual participant token
    const token = signJwt({
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: API_KEY,
      sub: userId,
      name: userName || 'Anonymous',
      video: {
        roomJoin: true,
        room: roomId,
        canSubscribe: true,
        canPublishData: true,
        canPublish: true,
        canPublishSources: isTeacher === 'true' ? ['camera', 'microphone', 'screen_share'] : ['camera', 'microphone']
      }
    }, API_SECRET);

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
