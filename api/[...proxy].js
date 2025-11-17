// Vercel Serverless Function: Proxy to backend
// Catch-all route: /api/* forwards to backend

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Authorization,authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Vercel provides catch-all path in req.query.proxy as array
  const { proxy = [], ...otherParams } = req.query;
  const pathParam = Array.isArray(proxy) ? proxy.join('/') : String(proxy);
  const backendOrigin = process.env.BACKEND_ORIGIN || 'https://themselves-resolve-routing-ricky.trycloudflare.com';
  
  // Construct full backend URL with query params
  const queryString = Object.keys(otherParams).length > 0 
    ? '?' + new URLSearchParams(otherParams).toString() 
    : '';
  const backendUrl = `${backendOrigin}/potato-api/${pathParam}${queryString}`;
  
  console.log('[proxy] Request:', req.method, pathParam, '→', backendUrl);
  
  try {
    // Prepare headers
    const forwardHeaders = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    
    if (req.headers.authorization) {
      forwardHeaders['Authorization'] = req.headers.authorization;
    }
    
    // Prepare body
    let bodyData = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body && typeof req.body === 'object') {
        bodyData = JSON.stringify(req.body);
      } else if (req.body) {
        bodyData = req.body;
      }
    }
    
    // Forward to backend
    const backendRes = await fetch(backendUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: bodyData,
    });

    // Parse response
    const contentType = backendRes.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('application/json')) {
      data = await backendRes.json();
    } else {
      data = await backendRes.text();
    }
    
    console.log('[proxy] Response:', backendRes.status);
    
    res.setHeader('Content-Type', contentType || 'application/json');
    return res.status(backendRes.status).json(data);
  } catch (error) {
    console.error('[proxy] Error:', error.message);
    return res.status(500).json({ 
      error: 'Proxy failed', 
      message: error.message,
      path: pathParam
    });
  }
}
