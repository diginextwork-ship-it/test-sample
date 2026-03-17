# JD Parser - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js v16+ installed
- MySQL database running
- Gemini API key (get free at: https://makersuite.google.com/app/apikey)

### Step 1: Setup Backend (2 minutes)

```bash
# Create backend folder
mkdir -p backend/routes
cd backend

# Install dependencies
npm init -y
npm install express cors mysql2 dotenv multer @google/generative-ai pdf-parse mammoth uuid

# Create .env file
cat > .env << 'ENVEOF'
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=recruiting_db
DB_PORT=3306
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5000
NODE_ENV=development
ENVEOF

# Download the backend files from outputs:
# - jdParser.js -> put in backend/routes/
# - server.js -> put in backend/
```

### Step 2: Setup Database (1 minute)

```sql
CREATE DATABASE IF NOT EXISTS recruiting_db;
USE recruiting_db;

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
  revenue INT NOT NULL DEFAULT 0,
  points_per_joining INT,
  INDEX idx_recruiter (recruiter_rid),
  INDEX idx_created (created_at),
  INDEX idx_access (access_mode)
);
```

### Step 3: Setup Frontend (2 minutes)

```bash
# Create React app with Vite
npm create vite@latest frontend -- --template react
cd frontend

# Install dependencies
npm install
npm install axios lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Create .env file
echo "VITE_API_URL=http://localhost:5000" > .env

# Download frontend files from outputs:
# - JDParser.jsx -> put in frontend/src/components/
# - Update App.jsx to import JDParser
```

### Step 4: Run Everything

```bash
# Terminal 1 - Backend
cd backend
node server.js

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

### Step 5: Test It!

1. Open browser: `http://localhost:3000`
2. Upload a JD file (PDF/DOCX/TXT)
3. Click "Parse JD with AI"
4. Review extracted data
5. Click "Save Job Posting"
6. Check your database!

## 📁 File Structure You Need

```
your-project/
├── backend/
│   ├── routes/
│   │   └── jdParser.js       ← Download from outputs
│   ├── server.js              ← Download from outputs
│   ├── package.json
│   └── .env
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── JDParser.jsx   ← Download from outputs
    │   ├── App.jsx
    │   └── main.jsx
    ├── package.json
    └── .env
```

## 🎯 What Each File Does

**Backend:**
- `jdParser.js` - API routes for upload, parse, and save
- `server.js` - Express server setup with database connection

**Frontend:**
- `JDParser.jsx` - React component with upload UI and parsing logic

## ✅ Success Checklist

- [ ] Backend running on port 5000
- [ ] Frontend running on port 3000  
- [ ] Database table created
- [ ] Gemini API key configured
- [ ] Can upload a file
- [ ] AI parsing works
- [ ] Data saves to database

## 🐛 Common Issues

**"Database connection failed"**
- Check MySQL is running: `sudo service mysql status`
- Verify credentials in backend/.env

**"Gemini API error"**
- Check API key is correct
- Verify you have quota (free tier = 60 requests/minute)

**"File upload fails"**
- Check file is PDF/DOCX/TXT
- Check file is under 10MB

## 🎉 You're Done!

Your JD Parser is now ready to use. Upload your sample JDs and watch the AI extract all the data automatically!

Need the complete code? Download all files from the outputs folder.
