export async function handler(event, context) {
  const authHeader = event.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({ code: 401, msg: 'This endpoint requires a Bearer token' })
    };
  }

  const token = authHeader.replace('Bearer ', '');

  // Optionally verify token if needed

  return {
    statusCode: 200,
    body: JSON.stringify({ msg: 'Authorized access!' })
  };
}
