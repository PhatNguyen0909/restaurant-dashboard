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
    // Prepare headers - copy from incoming request
    const headers = {};
    
    // Forward content-type from client (important for multipart/form-data with boundary)
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }
    
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    
    // Get raw body for multipart/form-data or JSON
    let body = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      // Vercel provides req.body as parsed object for JSON
      // For multipart/form-data, we need raw body
      const contentType = req.headers['content-type'] || '';
      
      if (contentType.includes('multipart/form-data')) {
        // For multipart, pass through the raw request body
        // Vercel Edge doesn't provide raw body easily, so we reconstruct from req.body
        console.log('[proxy] FormData detected - using raw body pass-through');
        body = req; // Pass the request itself for streaming
      } else if (req.body) {
        // For JSON, stringify if needed
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }
    }
    
    console.log('[proxy] Content-Type:', req.headers['content-type']);
    console.log('[proxy] Body type:', typeof body);
    
    // For FormData, use different approach
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Use native fetch with request body stream
      const response = await fetch(backendUrl, {
        method: req.method,
        headers: {
          'Authorization': headers['Authorization'],
          'Content-Type': headers['Content-Type'],
        },
        body: req.body, // Vercel might have this as Buffer or stream
        duplex: 'half',
      });
      
      const contentType = response.headers.get('content-type') || '';
      let data;
      
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      console.log('[proxy] Response status:', response.status);
      res.setHeader('Content-Type', contentType || 'application/json');
      return res.status(response.status).json(data);
    }
    
    // For regular JSON requests
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
