// Vercel Serverless Function: Proxy to backend
// This allows same-origin requests from frontend to avoid CORS/cookie issues

export default async function handler(req, res) {
  // Enable CORS for local testing
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Authorization,authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path = [] } = req.query;
  const backendOrigin = process.env.BACKEND_ORIGIN || 'https://themselves-resolve-routing-ricky.trycloudflare.com';
  
  // Construct full backend URL
  const pathStr = Array.isArray(path) ? path.join('/') : path;
  const queryString = req.url.split('?')[1];
  const backendUrl = `${backendOrigin}/potato-api/${pathStr}${queryString ? '?' + queryString : ''}`;
  
  console.log('[potato-proxy] Forwarding:', req.method, backendUrl);
  
  try {
    // Prepare headers - forward authorization and content-type
    const forwardHeaders = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    
    // Forward Authorization header if present
    if (req.headers.authorization) {
      forwardHeaders['Authorization'] = req.headers.authorization;
    }
    
    // Forward request to backend
    const backendRes = await fetch(backendUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: req.method !== 'GET' && req.method !== 'HEAD' && req.body ? JSON.stringify(req.body) : undefined,
    });

    // Get response data
    const contentType = backendRes.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('application/json')) {
      data = await backendRes.json();
    } else {
      data = await backendRes.text();
    }
    
    console.log('[potato-proxy] Response:', backendRes.status, typeof data);
    
    // Set content type
    res.setHeader('Content-Type', contentType);
    
    // Return response
    return res.status(backendRes.status).json(data);
  } catch (error) {
    console.error('[potato-proxy] Error:', error.message, error.stack);
    return res.status(500).json({ 
      error: 'Proxy failed', 
      message: error.message,
      backendOrigin: backendOrigin,
      timestamp: new Date().toISOString()
    });
  }
}
