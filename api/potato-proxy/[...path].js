// Vercel Serverless Function: Proxy to backend
// This allows same-origin requests from frontend to avoid CORS/cookie issues

export default async function handler(req, res) {
  const { path = [] } = req.query;
  const backendOrigin = process.env.BACKEND_ORIGIN || 'https://themselves-resolve-routing-ricky.trycloudflare.com';
  
  // Construct full backend URL
  const pathStr = Array.isArray(path) ? path.join('/') : path;
  const backendUrl = `${backendOrigin}/potato-api/${pathStr}`;
  
  try {
    // Forward request to backend
    const backendRes = await fetch(backendUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: new URL(backendOrigin).host, // Replace host header
        'x-forwarded-for': req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        'x-real-ip': req.headers['x-real-ip'] || req.socket.remoteAddress,
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // Forward response
    const data = await backendRes.text();
    
    // Copy response headers (but skip some that might cause issues)
    const skipHeaders = ['content-encoding', 'transfer-encoding', 'connection', 'keep-alive'];
    for (const [key, value] of backendRes.headers.entries()) {
      if (!skipHeaders.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }
    
    res.status(backendRes.status).send(data);
  } catch (error) {
    console.error('[potato-proxy] Error:', error);
    res.status(500).json({ 
      error: 'Proxy failed', 
      message: error.message,
      backendUrl: backendUrl.replace(/\/potato-api.*/, '/potato-api/***') // Hide sensitive path
    });
  }
}
