# Production Deployment Guide

## Pre-Deployment Checklist

### Security
- [ ] Environment variables configured (`.env` file)
- [ ] HTTPS enabled (reverse proxy or platform SSL)
- [ ] Rate limiting configured
- [ ] Security headers enabled (Helmet.js)
- [ ] Database file permissions secured
- [ ] No sensitive data in logs

### Performance
- [ ] Static file caching enabled
- [ ] Gzip compression configured
- [ ] Health check endpoint tested
- [ ] Graceful shutdown tested
- [ ] Memory and CPU limits set

### Monitoring
- [ ] Error tracking configured
- [ ] Request logging enabled
- [ ] Health monitoring setup
- [ ] Backup strategy implemented

## Deployment Options

### 1. Render.com (Recommended)

**Pros**: Zero-config, automatic HTTPS, CDN, easy scaling

1. Connect your GitHub repository
2. Use existing `render.yaml` configuration
3. Set environment variables in Render dashboard
4. Deploy automatically on git push

**Environment Variables**:
```
NODE_ENV=production
PORT=10000
DB_FILE=/opt/render/project/src/data/cryptexa.json
MAX_CONTENT_SIZE=1mb
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
LOG_LEVEL=info
```

### 2. Vercel

**Pros**: Global edge network, serverless, automatic scaling

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in project directory
3. Configure environment variables in Vercel dashboard
4. Deploy with `vercel --prod`

### 3. Docker Deployment

**Pros**: Consistent environment, easy scaling, platform agnostic

```bash
# Build image
docker build -t cryptexa .

# Run container
docker run -d \
  --name cryptexa \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e NODE_ENV=production \
  -e DB_FILE=/app/data/cryptexa.json \
  --restart unless-stopped \
  cryptexa
```

### 4. VPS/Cloud Server

**Pros**: Full control, cost-effective for high traffic

1. Install Node.js 18+
2. Clone repository
3. Install dependencies: `npm ci --production`
4. Configure environment variables
5. Use PM2 for process management:

```bash
npm install -g pm2
cp .env.example .env
# Edit .env with your settings
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

## Reverse Proxy Configuration

### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3000` | Server port |
| `DB_FILE` | `./data/cryptexa.json` | Database file path |
| `MAX_CONTENT_SIZE` | `1mb` | Maximum request size |
| `RATE_LIMIT_REQUESTS` | `1000` (dev), `100` (prod) | Requests per window |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `LOG_LEVEL` | `info` | Logging level |

## Security Best Practices

### 1. HTTPS Only
- Always use HTTPS in production
- Configure HSTS headers
- Use strong SSL/TLS configuration

### 2. Environment Security
- Never commit `.env` files
- Use strong, unique passwords
- Regularly rotate secrets
- Limit file system permissions

### 3. Network Security
- Use firewall rules
- Limit exposed ports
- Configure rate limiting
- Monitor for suspicious activity

### 4. Application Security
- Keep dependencies updated
- Monitor for vulnerabilities
- Use security headers
- Validate all inputs

## Monitoring and Maintenance

### Health Checks
```bash
# Check application health
curl https://your-domain.com/health

# Expected response
{"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

### Log Monitoring
- Monitor error rates
- Track response times
- Watch for unusual patterns
- Set up alerts for critical issues

### Backup Strategy
- Regular database backups
- Version control for code
- Environment configuration backup
- Disaster recovery plan

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

2. **Permission denied on database file**
   ```bash
   chmod 644 data/cryptexa.json
   chown app:app data/cryptexa.json
   ```

3. **High memory usage**
   - Check for memory leaks
   - Monitor request patterns
   - Consider scaling horizontally

4. **SSL certificate issues**
   - Verify certificate validity
   - Check certificate chain
   - Ensure proper renewal process

### Performance Optimization

1. **Enable compression**
   - Configure gzip in reverse proxy
   - Use Brotli for better compression

2. **Optimize caching**
   - Set appropriate cache headers
   - Use CDN for static assets
   - Implement application-level caching

3. **Database optimization**
   - Regular cleanup of old data
   - Monitor file size growth
   - Consider database alternatives for high load

## Support

For deployment issues:
1. Check application logs
2. Verify environment configuration
3. Test health endpoint
4. Review security settings
5. Monitor resource usage