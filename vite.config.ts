import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import url from 'url';

// Force server restart to reload .env again

// Simple in-memory rate limiting map
// Maps IP addresses to an object containing the request count and the reset timestamp
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 20; // Allow 20 requests per minute per IP

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'livekit-token-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Apply rate limiting to all /api/ endpoints
          if (req.url && req.url.startsWith('/api/')) {
            const ip = req.socket?.remoteAddress || 'unknown-ip';
            const now = Date.now();
            const limit = rateLimit.get(ip);

            if (limit) {
              if (now > limit.resetTime) {
                // Window expired, reset count
                rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
              } else {
                if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
                  res.writeHead(429, { 
                    'Content-Type': 'application/json',
                    'Retry-After': Math.ceil((limit.resetTime - now) / 1000).toString()
                  });
                  res.end(JSON.stringify({ error: 'Too many requests, please try again later.' }));
                  return; // Stop processing this request
                }
                limit.count++;
              }
            } else {
              rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
            }
          }

          if (req.url && req.url.startsWith('/api/get-livekit-token')) {
            const parsedUrl = url.parse(req.url, true);
            const query = parsedUrl.query;

            const userId = (query.userId as string) || 'dev-user';
            const userName = (query.userName as string) || 'Dev User';
            const roomId = (query.roomId as string) || 'dev-room';
            const isTeacher = query.isTeacher === 'true';

            // Load env vars properly using Vite's loadEnv to get keys from .env
            const env = loadEnv('', process.cwd(), '');
            const apiKey = env.LIVEKIT_API_KEY || process.env.LIVEKIT_API_KEY || 'devkey';
            const apiSecret = env.LIVEKIT_API_SECRET || process.env.LIVEKIT_API_SECRET || 'secret';
            const livekitUrl = env.LIVEKIT_URL || process.env.LIVEKIT_URL || 'ws://localhost:7880';

            const generateToken = () => {
              try {
                const at = new AccessToken(apiKey, apiSecret, {
                  identity: userId,
                  name: userName,
                  ttl: 60 * 60,
                });

                const grants: any = {
                  roomJoin: true,
                  room: roomId,
                  canSubscribe: true,
                  canPublishData: true,
                  canPublish: true,
                };

                // Student should only have camera & microphone, Teacher can screen share
                grants.canPublishSources = isTeacher 
                  ? [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE]
                  : [TrackSource.CAMERA, TrackSource.MICROPHONE];

                at.addGrant(grants);
                
                at.toJwt().then((token) => {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ token }));
                }).catch((err) => {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: err.message }));
                });
              } catch (err: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
              }
            };

            if (!isTeacher) {
              const livekitHttpUrl = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
              
              const adminToken = new AccessToken(apiKey, apiSecret, {
                identity: 'api-admin',
                ttl: 60,
              });
              adminToken.addGrant({ roomList: true });

              adminToken.toJwt().then((jwtToken) => {
                fetch(`${livekitHttpUrl}/twirp/livekit.RoomService/ListRooms`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({})
                })
                .then(r => {
                  if (!r.ok) throw new Error(`ListRooms responded with ${r.status}`);
                  return r.json();
                })
                .then(data => {
                  const roomExists = data.rooms && data.rooms.some((r: any) => r.name === roomId);
                  if (!roomExists) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'The teacher has not started this meeting yet. Please wait for them to begin.' }));
                  } else {
                    generateToken();
                  }
                })
                .catch(err => {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: `Failed to verify room existence: ${err.message}` }));
                });
              });
            } else {
              generateToken();
            }
          } else {
            next();
          }
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
