# Deployment Guide - JD Parser Platform

## Quick Start (Local Development)

### Prerequisites
- Node.js v16+
- MySQL database
- Gemini API key

### Setup
```bash
# Run setup script
chmod +x setup.sh
./setup.sh

# Configure backend/.env
nano backend/.env
# Add your DB credentials and Gemini API key

# Start backend
cd backend
npm start

# In new terminal, start frontend
cd frontend
npm run dev
```

Visit `http://localhost:3000`

---

## Production Deployment

### Option 1: Railway (Recommended for Backend)

#### Backend Deployment on Railway

1. **Create New Project**
   - Go to [Railway](https://railway.app)
   - Click "New Project"
   - Choose "Deploy from GitHub repo"
   - Select your repository

2. **Add MySQL Database**
   - In your project, click "New"
   - Select "Database" → "MySQL"
   - Railway will provision a MySQL instance

3. **Configure Environment Variables**
   - Click on your backend service
   - Go to "Variables" tab
   - Add the following:
   ```
   DB_HOST=${{MySQL.MYSQL_HOST}}
   DB_USER=${{MySQL.MYSQL_USER}}
   DB_PASSWORD=${{MySQL.MYSQL_PASSWORD}}
   DB_NAME=${{MySQL.MYSQL_DATABASE}}
   DB_PORT=${{MySQL.MYSQL_PORT}}
   GEMINI_API_KEY=your-gemini-api-key
   PORT=5000
   NODE_ENV=production
   ```

4. **Configure Build Settings**
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Watch Paths: `/backend/**`

5. **Create Database Schema**
   ```bash
   # Connect to Railway MySQL
   railway connect MySQL
   
   # Run schema creation
   CREATE TABLE jobs (
     jid VARCHAR(20) PRIMARY KEY,
     recruiter_rid VARCHAR(20),
     city VARCHAR(100) NOT NULL,
     state VARCHAR(100) NOT NULL,
     pincode VARCHAR(10) NOT NULL,
     company_name VARCHAR(150) NOT NULL,
     role_name VARCHAR(150) NOT NULL,
     positions_open INT NOT NULL DEFAULT 1,
     skills TEXT,
     job_description TEXT,
     experience VARCHAR(50),
     salary VARCHAR(50),
     qualification LONGTEXT,
     benefits TEXT,
     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     access_mode ENUM('open','restricted') NOT NULL DEFAULT 'open',
     revenue INT NOT NULL,
     points_per_joining INT,
     INDEX idx_recruiter (recruiter_rid),
     INDEX idx_created (created_at),
     INDEX idx_access (access_mode)
   );
   ```

6. **Deploy**
   - Push to GitHub
   - Railway auto-deploys
   - Get your backend URL from Railway dashboard

---

### Option 2: Vercel (Recommended for Frontend)

#### Frontend Deployment on Vercel

1. **Install Vercel CLI** (optional)
   ```bash
   npm install -g vercel
   ```

2. **Deploy via Dashboard**
   - Go to [Vercel](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure:
     - Framework Preset: Vite
     - Root Directory: `frontend`
     - Build Command: `npm run build`
     - Output Directory: `dist`

3. **Configure Environment Variables**
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add:
   ```
   VITE_API_URL=https://your-railway-backend-url.railway.app
   ```

4. **Deploy**
   - Vercel auto-deploys on push to main branch
   - Get your frontend URL from Vercel dashboard

---

### Option 3: Render (Alternative All-in-One)

#### Backend on Render

1. **Create Web Service**
   - Go to [Render](https://render.com)
   - New → Web Service
   - Connect GitHub repo
   - Configure:
     - Name: recruiting-backend
     - Root Directory: `backend`
     - Environment: Node
     - Build Command: `npm install`
     - Start Command: `npm start`

2. **Add PostgreSQL/MySQL**
   - New → PostgreSQL (or use external MySQL)
   - Link to your web service

3. **Environment Variables**
   ```
   DB_HOST=your-db-host
   DB_USER=your-db-user
   DB_PASSWORD=your-db-password
   DB_NAME=recruiting_db
   DB_PORT=3306
   GEMINI_API_KEY=your-api-key
   PORT=5000
   NODE_ENV=production
   ```

#### Frontend on Render

1. **Create Static Site**
   - New → Static Site
   - Connect GitHub repo
   - Configure:
     - Name: recruiting-frontend
     - Root Directory: `frontend`
     - Build Command: `npm run build`
     - Publish Directory: `dist`

2. **Environment Variables**
   ```
   VITE_API_URL=https://your-backend-url.onrender.com
   ```

---

## Database Migration for Existing Systems

If you already have a recruiting database, add the JD parser functionality:

```sql
-- Check if jobs table exists
SHOW TABLES LIKE 'jobs';

-- If it doesn't exist, create it
-- (Use the schema from Railway section above)

-- If it exists but missing columns, add them:
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS access_mode ENUM('open','restricted') NOT NULL DEFAULT 'open';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS revenue INT NOT NULL DEFAULT 0;
```

---

## Environment Variables Reference

### Backend (.env)
```env
# Database
DB_HOST=localhost              # Production: your-db-host
DB_USER=root                   # Production: your-db-user
DB_PASSWORD=password           # Production: your-db-password
DB_NAME=recruiting_db
DB_PORT=3306

# Gemini AI
GEMINI_API_KEY=AIza...        # Get from Google AI Studio

# Server
PORT=5000
NODE_ENV=production           # development for local
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000  # Production: your-backend-url
```

---

## Post-Deployment Checklist

### Backend
- [ ] Database connection successful
- [ ] Jobs table created with correct schema
- [ ] Gemini API key configured and working
- [ ] File upload endpoint accessible
- [ ] CORS configured for frontend domain
- [ ] Health check endpoint returns 200

### Frontend
- [ ] API connection to backend successful
- [ ] File upload works
- [ ] Parsed data displays correctly
- [ ] Save functionality works
- [ ] UI responsive on mobile

### Testing
```bash
# Test backend health
curl https://your-backend-url/health

# Test file upload (replace with actual file)
curl -X POST https://your-backend-url/api/jd/upload \
  -F "jdFile=@sample.pdf"
```

---

## Monitoring & Logs

### Railway
- View logs: Dashboard → Service → Logs
- Metrics: Dashboard → Service → Metrics

### Vercel
- View logs: Dashboard → Deployments → Select deployment → Logs
- Analytics: Dashboard → Analytics

### Render
- View logs: Dashboard → Service → Logs
- Metrics: Dashboard → Service → Metrics

---

## Scaling Considerations

### Backend Scaling
- **Horizontal**: Add more Railway/Render instances
- **Vertical**: Upgrade plan for more CPU/RAM
- **Database**: Consider read replicas for heavy read workloads

### File Storage
- Current: In-memory (via Multer)
- Production: Consider AWS S3 or Cloudinary for file storage
- Implementation:
  ```javascript
  // Install aws-sdk
  npm install aws-sdk
  
  // Configure S3 in backend
  const AWS = require('aws-sdk');
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY
  });
  ```

### API Rate Limiting
Add rate limiting for production:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/jd/upload', limiter);
```

---

## Security Best Practices

### Production Checklist
- [ ] Use HTTPS everywhere
- [ ] Enable CORS only for your frontend domain
- [ ] Implement authentication/authorization
- [ ] Sanitize all user inputs
- [ ] Use environment variables for secrets
- [ ] Enable request rate limiting
- [ ] Set up monitoring and alerts
- [ ] Regular dependency updates
- [ ] Database backups configured

### Recommended Security Additions

1. **Authentication Middleware**
```javascript
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Apply to routes
router.post('/save', authenticate, async (req, res) => { ... });
```

2. **Input Validation**
```javascript
const { body, validationResult } = require('express-validator');

router.post('/save', [
  body('parsedData.company_name').trim().notEmpty(),
  body('parsedData.role_name').trim().notEmpty(),
  // ... more validations
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // ... save logic
});
```

---

## Troubleshooting Deployment Issues

### Backend won't start
```bash
# Check logs
railway logs
# or
render logs

# Common issues:
- Missing environment variables
- Database connection failed
- Port binding issue (use 0.0.0.0)
```

### Frontend can't connect to backend
```bash
# Check:
1. VITE_API_URL is set correctly
2. Backend is running and accessible
3. CORS is configured for frontend domain
4. No typos in API endpoint URLs
```

### Database connection timeout
```bash
# Check:
1. Database credentials are correct
2. Database is accessible from backend server
3. Firewall rules allow connection
4. Connection string format is correct
```

### File upload fails in production
```bash
# Check:
1. Memory limits in hosting platform
2. Request size limits
3. File type restrictions
4. Multer configuration
```

---

## Costs Estimate

### Railway
- Hobby Plan: $5/month
- MySQL: $5/month
- **Total: ~$10/month**

### Vercel
- Free tier sufficient for most use cases
- Pro: $20/month if needed

### Render
- Free tier available (limited)
- Starter: $7/month
- **Total: ~$14/month**

### Recommended for Production
- **Railway**: Backend + MySQL ($10/mo)
- **Vercel**: Frontend (Free tier)
- **Total: ~$10/month**

---

## Support & Maintenance

### Regular Tasks
- Weekly: Check error logs
- Monthly: Review and update dependencies
- Quarterly: Security audit
- As needed: Scale resources based on usage

### Monitoring Setup
```javascript
// Add error tracking (e.g., Sentry)
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});

// Use in error middleware
app.use(Sentry.Handlers.errorHandler());
```

---

## Backup Strategy

### Database Backups
- Railway: Automatic daily backups
- Manual export:
  ```bash
  mysqldump -h host -u user -p database > backup.sql
  ```

### Code Backups
- GitHub repository serves as backup
- Tag releases: `git tag -a v1.0.0 -m "Release 1.0.0"`

---

Ready to deploy! 🚀
