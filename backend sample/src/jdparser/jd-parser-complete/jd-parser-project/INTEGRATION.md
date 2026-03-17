# JD Parser - Integration Guide

## Overview
This guide will help you integrate the JD Parser into your existing recruiting platform.

---

## Architecture Overview

```
┌─────────────────┐
│   React UI      │ ← User uploads JD files
│   (Frontend)    │
└────────┬────────┘
         │ HTTP/REST
         ▼
┌─────────────────┐
│  Express API    │ ← File processing & AI parsing
│   (Backend)     │
└────────┬────────┘
         │
    ┌────┼────┐
    │         │
    ▼         ▼
┌───────┐ ┌──────────┐
│ MySQL │ │ Gemini   │
│  DB   │ │   AI     │
└───────┘ └──────────┘
```

---

## Quick Integration Steps

### Step 1: Install Dependencies

**Backend:**
```bash
cd backend
npm install express cors mysql2 dotenv multer @google/generative-ai pdf-parse mammoth uuid
```

**Frontend:**
```bash
cd frontend
npm install axios lucide-react
```

### Step 2: Configure Environment Variables

**Backend `.env`:**
```env
DB_HOST=your-mysql-host
DB_USER=your-mysql-user
DB_PASSWORD=your-mysql-password
DB_NAME=recruiting_db
DB_PORT=3306
GEMINI_API_KEY=your-gemini-api-key
PORT=5000
NODE_ENV=development
```

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:5000
```

### Step 3: Database Setup

Run this SQL to create or verify your jobs table:

```sql
CREATE TABLE IF NOT EXISTS jobs (
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
  revenue INT NOT NULL DEFAULT 0,
  points_per_joining INT,
  INDEX idx_recruiter (recruiter_rid),
  INDEX idx_created (created_at),
  INDEX idx_access (access_mode)
);
```

### Step 4: Add Routes to Your Backend

If you have an existing Express server, add these routes:

```javascript
// In your main server file
const jdParserRoutes = require('./routes/jdParser');
const jdParserAdvancedRoutes = require('./routes/jdParserAdvanced');

app.use('/api/jd', jdParserRoutes);
app.use('/api/jd-advanced', jdParserAdvancedRoutes);
```

### Step 5: Add Components to Your Frontend

**Single File Upload:**
```jsx
import JDParser from './components/JDParser';

// In your routing or main component
<Route path="/jd-parser" element={<JDParser />} />
```

**Batch Upload:**
```jsx
import BatchJDUploader from './components/BatchJDUploader';

<Route path="/batch-upload" element={<BatchJDUploader />} />
```

---

## Integration with Existing Recruiters System

### Option 1: Using Local Storage
```javascript
// Store recruiter ID when they log in
localStorage.setItem('recruiter_rid', recruiterData.rid);

// It's automatically used by JDParser component
```

### Option 2: Pass as Prop
```jsx
<JDParser recruiterId={currentUser.rid} />
```

Then modify JDParser.jsx:
```javascript
const JDParser = ({ recruiterId }) => {
  // ...
  const handleSaveJob = async () => {
    const response = await axios.post(`${API_URL}/api/jd/save`, {
      recruiter_rid: recruiterId || localStorage.getItem('recruiter_rid'),
      parsedData: parsedData
    });
    // ...
  };
};
```

### Option 3: Context API
```jsx
// AuthContext.js
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [recruiter, setRecruiter] = useState(null);
  
  return (
    <AuthContext.Provider value={{ recruiter, setRecruiter }}>
      {children}
    </AuthContext.Provider>
  );
};

// In JDParser.jsx
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const JDParser = () => {
  const { recruiter } = useContext(AuthContext);
  
  const handleSaveJob = async () => {
    const response = await axios.post(`${API_URL}/api/jd/save`, {
      recruiter_rid: recruiter?.rid,
      parsedData: parsedData
    });
  };
};
```

---

## API Integration Examples

### 1. Single File Upload

```javascript
// Upload and parse a JD file
const uploadJD = async (file) => {
  const formData = new FormData();
  formData.append('jdFile', file);
  
  const response = await fetch('http://localhost:5000/api/jd/upload', {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  return data.data; // Parsed JD data
};
```

### 2. Parse Text Directly

```javascript
// Parse JD from text string
const parseJDText = async (jdText) => {
  const response = await fetch('http://localhost:5000/api/jd/parse-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jdText })
  });
  
  const data = await response.json();
  return data.data;
};
```

### 3. Save Parsed JD

```javascript
// Save parsed data to database
const saveJD = async (parsedData, recruiterId) => {
  const response = await fetch('http://localhost:5000/api/jd/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recruiter_rid: recruiterId,
      parsedData: parsedData
    })
  });
  
  const data = await response.json();
  return data.jid; // Returns generated JID
};
```

### 4. Batch Upload

```javascript
// Upload multiple files
const batchUpload = async (files) => {
  const formData = new FormData();
  files.forEach(file => formData.append('jdFiles', file));
  
  const response = await fetch('http://localhost:5000/api/jd-advanced/batch-upload', {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  return {
    results: data.results,
    errors: data.errors
  };
};
```

### 5. Search Jobs

```javascript
// Search for jobs
const searchJobs = async (filters) => {
  const params = new URLSearchParams(filters);
  
  const response = await fetch(`http://localhost:5000/api/jd-advanced/search?${params}`);
  const data = await response.json();
  return data.jobs;
};

// Example usage:
const jobs = await searchJobs({
  keyword: 'sales',
  city: 'Mumbai',
  experience: '1-3 years',
  limit: 20
});
```

### 6. Get Statistics

```javascript
// Get parsing statistics
const getStats = async () => {
  const response = await fetch('http://localhost:5000/api/jd-advanced/stats');
  const data = await response.json();
  return data.stats;
};
```

---

## Customizing the AI Parser

### Modify Parsing Logic

Edit `backend/routes/jdParser.js` or `backend/routes/jdParserAdvanced.js`:

```javascript
// Add custom fields to extraction
const prompt = `Extract the following information:
- company_name
- role_name
// ADD YOUR CUSTOM FIELDS HERE:
- work_mode (string): Remote/Hybrid/On-site
- industry (string): Industry sector
// ...rest of prompt
`;

// Then update the return object:
return {
  company_name: parsedData.company_name || 'Not Specified',
  role_name: parsedData.role_name || 'Not Specified',
  // ADD YOUR CUSTOM FIELDS:
  work_mode: parsedData.work_mode || 'Not Specified',
  industry: parsedData.industry || 'Not Specified',
  // ...rest of fields
};
```

### Change AI Model

```javascript
// Current: gemini-1.5-flash (fast, cost-effective)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Alternative: gemini-1.5-pro (more accurate, slower)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
```

---

## Adding to Existing Navigation

### React Router Example

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import JDParser from './components/JDParser';
import BatchJDUploader from './components/BatchJDUploader';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Your existing routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* JD Parser routes */}
        <Route path="/jd-parser" element={<JDParser />} />
        <Route path="/batch-upload" element={<BatchJDUploader />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### Navigation Menu

```jsx
<nav>
  {/* Your existing menu items */}
  <Link to="/dashboard">Dashboard</Link>
  <Link to="/jobs">Jobs</Link>
  
  {/* JD Parser menu items */}
  <Link to="/jd-parser">Upload JD</Link>
  <Link to="/batch-upload">Batch Upload</Link>
</nav>
```

---

## Testing the Integration

### 1. Test Backend Endpoints

```bash
# Health check
curl http://localhost:5000/health

# API info
curl http://localhost:5000/api

# Upload test (replace with actual file)
curl -X POST http://localhost:5000/api/jd/upload \
  -F "jdFile=@test-jd.pdf"
```

### 2. Test Frontend Integration

1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to `http://localhost:3000/jd-parser`
4. Upload a sample JD file
5. Verify parsing results
6. Save to database
7. Check MySQL for new record

### 3. Run Automated Tests

```bash
# Test AI parsing with sample JDs
cd backend
node test-parser.js
```

---

## Troubleshooting Common Issues

### Issue 1: CORS Errors
```javascript
// In backend server.js, add specific origin
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

### Issue 2: File Upload Fails
```javascript
// Check Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024, // Increase if needed
    files: 10 // Max files for batch
  }
});
```

### Issue 3: Database Connection Issues
```javascript
// Add connection retry logic
const createPool = async () => {
  for (let i = 0; i < 5; i++) {
    try {
      const pool = mysql.createPool({...config});
      await pool.getConnection();
      return pool;
    } catch (err) {
      if (i === 4) throw err;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
};
```

### Issue 4: Gemini API Rate Limits
```javascript
// Add retry with exponential backoff (already in jdParserAdvanced.js)
async function parseWithRetry(jdText, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await parseJDWithAI(jdText);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}
```

---

## Performance Optimization

### 1. Caching Parsed Results

```javascript
// Add Redis for caching (optional)
const redis = require('redis');
const client = redis.createClient();

router.post('/upload', async (req, res) => {
  const fileHash = crypto.createHash('md5').update(req.file.buffer).digest('hex');
  
  // Check cache
  const cached = await client.get(fileHash);
  if (cached) {
    return res.json({ success: true, data: JSON.parse(cached) });
  }
  
  // Parse and cache
  const parsed = await parseJDWithAI(text);
  await client.setex(fileHash, 3600, JSON.stringify(parsed));
  
  res.json({ success: true, data: parsed });
});
```

### 2. Background Job Processing

```javascript
// Use Bull for queue processing
const Queue = require('bull');
const jdQueue = new Queue('jd-parsing');

jdQueue.process(async (job) => {
  const { jdText } = job.data;
  return await parseJDWithAI(jdText);
});

// In route
router.post('/upload', async (req, res) => {
  const job = await jdQueue.add({ jdText: extractedText });
  res.json({ jobId: job.id });
});
```

---

## Security Considerations

### 1. Input Validation

```javascript
const { body, validationResult } = require('express-validator');

router.post('/save', [
  body('parsedData.company_name').trim().isLength({ min: 1, max: 150 }),
  body('parsedData.role_name').trim().isLength({ min: 1, max: 150 }),
  body('parsedData.positions_open').isInt({ min: 1, max: 1000 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Process...
});
```

### 2. File Type Validation

```javascript
// Verify file content, not just extension
const fileType = require('file-type');

const verifyFileType = async (buffer) => {
  const type = await fileType.fromBuffer(buffer);
  const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  return type && allowed.includes(type.mime);
};
```

### 3. Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50
});

app.use('/api/jd/', limiter);
```

---

## Next Steps

1. ✅ Complete basic integration
2. ✅ Test with sample JD files
3. ⬜ Add authentication/authorization
4. ⬜ Implement rate limiting
5. ⬜ Set up monitoring
6. ⬜ Deploy to production
7. ⬜ Train recruiters on the system

---

## Support & Resources

- **Gemini API Docs**: https://ai.google.dev/docs
- **Express.js Docs**: https://expressjs.com
- **React Docs**: https://react.dev
- **MySQL Docs**: https://dev.mysql.com/doc/

---

For questions or issues, check the main README.md or DEPLOYMENT.md files.
