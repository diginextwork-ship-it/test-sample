# JD Parser - Recruiting Platform

AI-powered Job Description Parser for third-party recruiting firms. Upload JD files (PDF, DOCX, TXT) and automatically extract structured data using Google's Gemini AI.

## 🚀 Features

- **AI-Powered Parsing**: Uses Google Gemini to intelligently extract job details
- **Multiple File Formats**: Supports PDF, DOCX, and TXT files
- **Smart Data Extraction**: Automatically identifies company name, role, location, salary, skills, etc.
- **Review & Edit**: Manual review interface to correct/edit parsed data before saving
- **Drag & Drop Upload**: Easy file upload with drag-and-drop support
- **Database Integration**: Saves parsed jobs directly to MySQL database

## 📋 Prerequisites

- Node.js (v16 or higher)
- MySQL Database
- Google Gemini API Key ([Get one here](https://makersuite.google.com/app/apikey))

## 🛠️ Installation

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from example:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
# Database Configuration
DB_HOST=your-database-host
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_NAME=recruiting_db
DB_PORT=3306

# Gemini API
GEMINI_API_KEY=your-gemini-api-key-here

# Server Configuration
PORT=5000
NODE_ENV=development
```

5. Ensure your MySQL database has the `jobs` table with the correct schema (see Database Schema section below)

6. Start the backend server:
```bash
npm start
# or for development with auto-reload
npm run dev
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from example:
```bash
cp .env.example .env
```

4. Configure API URL in `.env`:
```env
VITE_API_URL=http://localhost:5000
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 📊 Database Schema

Ensure your MySQL database has the following `jobs` table structure:

```sql
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

## 🎯 Usage

### 1. Upload JD File
- Drag and drop a JD file (PDF, DOCX, or TXT) or click to browse
- Supported formats: `.pdf`, `.docx`, `.txt`
- Max file size: 10MB

### 2. AI Parsing
- Click "Parse JD with AI" button
- The system will:
  - Extract text from the file
  - Send it to Gemini AI for structured extraction
  - Display parsed data in the Review tab

### 3. Review & Edit
- Switch to "Review & Edit" tab
- Review all extracted fields:
  - Company Name
  - Role/Designation
  - Location (City, State, Pincode)
  - Positions Open
  - Experience Required
  - Salary Range
  - Skills (comma-separated)
  - Qualification
  - Benefits
  - Full Job Description
- Edit any field as needed

### 4. Save to Database
- Click "Save Job Posting" button
- The system generates a unique JID
- Job posting is saved to MySQL database

## 🔌 API Endpoints

### POST `/api/jd/upload`
Upload and parse a JD file

**Request:**
- Content-Type: `multipart/form-data`
- Body: `jdFile` (file)

**Response:**
```json
{
  "success": true,
  "data": {
    "company_name": "XYZ Corp",
    "role_name": "Sales Officer",
    "city": "Mumbai",
    "state": "Maharashtra",
    ...
  },
  "originalFileName": "jd.pdf"
}
```

### POST `/api/jd/parse-text`
Parse JD text directly (for testing)

**Request:**
```json
{
  "jdText": "Job description text here..."
}
```

### POST `/api/jd/save`
Save parsed JD to database

**Request:**
```json
{
  "recruiter_rid": "REC123",
  "parsedData": {
    "company_name": "XYZ Corp",
    "role_name": "Sales Officer",
    ...
  }
}
```

**Response:**
```json
{
  "success": true,
  "jid": "JOB1710234567ABC",
  "message": "Job posting created successfully"
}
```

## 🧠 AI Parsing Logic

The system uses Google Gemini 1.5 Flash model to:
1. Identify job title and company name
2. Extract location details (city, state, pincode)
3. Parse experience requirements
4. Identify salary range
5. Extract required skills from responsibilities and requirements
6. Capture educational qualifications
7. Identify benefits and perks
8. Preserve complete job description

### Intelligent Defaults
- Company Name: "Not Specified" if not found
- Pincode: "000000" if not mentioned
- Positions Open: 1 if not specified
- Empty strings for missing text fields

## 📁 Project Structure

```
recruiting-platform/
├── backend/
│   ├── routes/
│   │   └── jdParser.js       # JD parsing routes
│   ├── server.js              # Express server
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── JDParser.jsx   # Main JD parser component
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── package.json
    ├── vite.config.js
    └── .env.example
```

## 🔧 Troubleshooting

### Backend Issues

**Database Connection Failed:**
- Verify MySQL is running
- Check DB credentials in `.env`
- Ensure database exists
- Check if port 3306 is accessible

**Gemini API Error:**
- Verify your API key is valid
- Check if you have available quota
- Ensure network connectivity

**File Upload Failed:**
- Check file size (max 10MB)
- Verify file format (PDF, DOCX, TXT only)
- Ensure multer middleware is configured

### Frontend Issues

**API Connection Failed:**
- Verify backend server is running on port 5000
- Check `VITE_API_URL` in `.env`
- Check browser console for CORS errors

**UI Not Loading:**
- Run `npm install` to ensure all dependencies are installed
- Clear browser cache
- Check console for JavaScript errors

## 🚀 Deployment

### Backend Deployment (Railway/Render)
1. Set environment variables in platform dashboard
2. Ensure MySQL database is accessible
3. Set `NODE_ENV=production`
4. Configure build command: `npm install`
5. Configure start command: `npm start`

### Frontend Deployment (Vercel/Netlify)
1. Set `VITE_API_URL` to your backend URL
2. Build command: `npm run build`
3. Output directory: `dist`
4. Install command: `npm install`

## 📝 Sample JD Files

The system has been tested with various JD formats including:
- Home Loan Sales Officer positions
- Financial Services Associate roles
- Technical positions with detailed requirements

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 📄 License

MIT License

## 🆘 Support

For issues or questions:
1. Check troubleshooting section
2. Review API endpoint documentation
3. Check browser/server console logs
4. Verify all environment variables are set correctly

## 🔐 Security Notes

- Never commit `.env` files
- Keep Gemini API key secure
- Use environment variables for all sensitive data
- Implement proper authentication for production
- Sanitize all user inputs
- Use HTTPS in production

## 🎓 Technical Stack

**Backend:**
- Node.js + Express
- MySQL (mysql2)
- Google Generative AI (Gemini)
- Multer (file uploads)
- pdf-parse (PDF extraction)
- mammoth (DOCX extraction)

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- Axios
- Lucide React (icons)

---

Built with ❤️ for recruiting teams
