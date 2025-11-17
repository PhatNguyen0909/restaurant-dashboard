// Vercel Serverless Function: Proxy to backend
// This allows same-origin requests from frontend to avoid CORS/cookie issues

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Authorization,authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract path from URL: /api/potato-proxy/auth/log-in -> auth/log-in
  const urlPath = req.url.split('/api/potato-proxy/')[1] || req.query.path || '';
  const pathParam = urlPath.split('?')[0]; // Remove query string
  const backendOrigin = process.env.BACKEND_ORIGIN || 'https://themselves-resolve-routing-ricky.trycloudflare.com';
  
  // Construct full backend URL
  const backendUrl = `${backendOrigin}/potato-api/${pathParam}`;
  
  console.log('[potato-proxy] Request:', req.method, req.url, '→', backendUrl, 'Body:', req.body);
  
  try {
    // Prepare headers - forward authorization and content-type
    const forwardHeaders = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    
    // Forward Authorization header if present
    if (req.headers.authorization) {
      forwardHeaders['Authorization'] = req.headers.authorization;
    }
    
    // Prepare body - req.body is already parsed by Vercel
    let bodyData = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body && typeof req.body === 'object') {
        bodyData = JSON.stringify(req.body);
      } else if (req.body) {
        bodyData = req.body;
      }
    }
    
    // Forward request to backend
    const backendRes = await fetch(backendUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: bodyData,
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
