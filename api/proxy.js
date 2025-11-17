// Simple proxy handler for all /potato-api/* requests
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get backend origin from env
  const backendOrigin = process.env.BACKEND_ORIGIN;
  
  if (!backendOrigin) {
    console.error('[proxy] BACKEND_ORIGIN not set!');
    return res.status(500).json({ 
      error: 'Configuration error',
      message: 'BACKEND_ORIGIN environment variable not set'
    });
  }

  // Extract path from original URL
  // URL format: /potato-api/auth/log-in -> extract "auth/log-in"
  const urlPath = req.url.replace(/^\/potato-api\/?/, '').split('?')[0];
  
  // Get query params
  const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
  
  // Build backend URL
  const backendUrl = `${backendOrigin}/potato-api/${urlPath}${queryString}`;
  
  console.log('[proxy] ===== REQUEST =====');
  console.log('[proxy] Method:', req.method);
  console.log('[proxy] Original URL:', req.url);
  console.log('[proxy] Extracted path:', urlPath);
  console.log('[proxy] Backend URL:', backendUrl);
  console.log('[proxy] Has Authorization:', !!req.headers.authorization);
  
  try {
    // Prepare headers
    const headers = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    
    // Prepare body for POST/PUT/PATCH
    let body = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (req.body) {
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }
    }
    
    console.log('[proxy] Request body:', body ? body.substring(0, 100) : 'none');
    
    // Forward request
    const response = await fetch(backendUrl, {
      method: req.method,
      headers: headers,
      body: body,
    });
    
    // Get response
    const contentType = response.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    console.log('[proxy] Response status:', response.status);
    console.log('[proxy] Response preview:', typeof data === 'string' ? data.substring(0, 100) : JSON.stringify(data).substring(0, 100));
    
    // Return response
    res.setHeader('Content-Type', contentType || 'application/json');
    return res.status(response.status).json(data);
    
  } catch (error) {
    console.error('[proxy] ERROR:', error.message);
    return res.status(500).json({ 
      error: 'Proxy failed', 
      message: error.message,
      backendUrl: backendUrl
    });
  }
}
