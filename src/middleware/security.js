import winston from 'winston';
import geoip from 'geoip-lite';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/access.log' })
  ]
});

export function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const ip = req.ip || req.connection.remoteAddress;
    const geo = geoip.lookup(ip);
    
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip,
      country: geo?.country,
      city: geo?.city,
      userAgent: req.get('User-Agent'),
      userId: req.session?.user?.id,
      userEmail: req.session?.user?.email,
      timestamp: new Date().toISOString()
    });
  });
  
  next();
}

export function securityMiddleware(req, res, next) {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Rate limiting headers
  if (req.rateLimit) {
    res.setHeader('X-RateLimit-Limit', req.rateLimit.limit);
    res.setHeader('X-RateLimit-Remaining', req.rateLimit.remaining);
    res.setHeader('X-RateLimit-Reset', req.rateLimit.resetTime);
  }
  
  next();
}
