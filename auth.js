export async function handler(event, context) {
  const auth = event.headers.authorization || '';
  const base64Credentials = auth.split(' ')[1] || '';
  const [user, pass] = Buffer.from(base64Credentials, 'base64').toString().split(':');

  if (user !== 'sspline2' || pass !== 'sctreport2025') {
    return {
      statusCode: 401,
      headers: { 'WWW-Authenticate': 'Basic' },
      body: 'Unauthorized'
    };
  }

  return {
    statusCode: 200,
    body: 'Welcome to the site!'
  };
}
