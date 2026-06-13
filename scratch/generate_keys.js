import crypto from 'crypto';

const secret = 'b667818cc637297d38d5a5631649e537412c552185c7965e914e4702bdccb752';

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeJwt(role) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    role: role,
    iss: 'supabase',
    iat: 1600000000,
    exp: 2600000000
  };

  const unsignedToken = `${base64url(header)}.${base64url(payload)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(unsignedToken)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${signature}`;
}

console.log('ANON_KEY =', makeJwt('anon'));
console.log('SERVICE_ROLE_KEY =', makeJwt('service_role'));
