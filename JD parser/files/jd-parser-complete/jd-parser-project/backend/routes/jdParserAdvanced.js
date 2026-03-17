const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Configure multer for batch uploads
const storage = multer.memoryStorage();
const batchUpload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
    }
  }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Extract text from file
async function extractTextFromFile(file) {
  try {
    if (file.mimetype === 'application/pdf') {
      const data = await pdfParse(file.buffer);
      return data.text;
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value;
    } else if (file.mimetype === 'text/plain') {
      return file.buffer.toString('utf-8');
    }
    throw new Error('Unsupported file type');
  } catch (error) {
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

// Enhanced AI parsing with retry logic
async function parseJDWithAI(jdText, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `You are an expert HR data extraction system. Extract the following information from the job description below and return it as valid JSON only (no markdown, no explanation).

Required fields:
- company_name (string): Extract company name if mentioned, otherwise return "Not Specified"
- role_name (string): Job title/designation
- city (string): City location
- state (string): State location
- pincode (string): PIN code if mentioned, otherwise "000000"
- positions_open (number): Number of openings, default to 1 if not specified
- skills (string): Comma-separated list of required skills
- experience (string): Experience required (e.g., "1-3 years", "Fresher")
- salary (string): Salary range mentioned
- qualification (string): Educational qualifications required
- benefits (string): Any benefits/perks mentioned
- job_description (string): Full detailed job description preserving all important information

Rules:
1. If a field is not found, use sensible defaults (empty string for text, 1 for positions_open, "000000" for pincode)
2. For location fields, if only state is mentioned, leave city as empty string
3. Extract skills from both explicit skills sections and job responsibilities
4. Preserve formatting in job_description but keep it clean
5. Return ONLY valid JSON, no additional text

Job Description:
${jdText}

Return the extracted data as JSON:`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      let cleanedText = text.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
      }
      
      const parsedData = JSON.parse(cleanedText);
      
      return {
        company_name: parsedData.company_name || 'Not Specified',
        role_name: parsedData.role_name || 'Not Specified',
        city: parsedData.city || '',
        state: parsedData.state || '',
        pincode: parsedData.pincode || '000000',
        positions_open: parseInt(parsedData.positions_open) || 1,
        skills: parsedData.skills || '',
        experience: parsedData.experience || 'Not Specified',
        salary: parsedData.salary || 'Not Specified',
        qualification: parsedData.qualification || '',
        benefits: parsedData.benefits || '',
        job_description: parsedData.job_description || jdText,
        revenue: 0,
        access_mode: 'open'
      };
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`Failed to parse JD after ${retries} attempts: ${error.message}`);
      }
      console.log(`Parse attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
    }
  }
}

// Route: Batch upload and parse multiple JD files
router.post('/batch-upload', batchUpload.array('jdFiles', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        const jdText = await extractTextFromFile(file);
        
        if (!jdText || jdText.trim().length === 0) {
          errors.push({
            fileName: file.originalname,
            error: 'Could not extract text from file'
          });
          continue;
        }

        const parsedData = await parseJDWithAI(jdText);
        
        results.push({
          fileName: file.originalname,
          data: parsedData,
          status: 'success'
        });
      } catch (error) {
        errors.push({
          fileName: file.originalname,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      processed: results.length,
      failed: errors.length,
      results: results,
      errors: errors
    });
  } catch (error) {
    console.error('Batch Upload Error:', error);
    res.status(500).json({ 
      error: 'Failed to process batch upload', 
      details: error.message 
    });
  }
});

// Route: Save batch parsed JDs
router.post('/batch-save', async (req, res) => {
  try {
    const db = req.app.get('db');
    const { recruiter_rid, batchData } = req.body;

    if (!batchData || !Array.isArray(batchData) || batchData.length === 0) {
      return res.status(400).json({ error: 'No batch data provided' });
    }

    const savedJobs = [];
    const failedJobs = [];

    for (let i = 0; i < batchData.length; i++) {
      const parsedData = batchData[i];
      
      try {
        const jid = `JOB${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        const query = `
          INSERT INTO jobs (
            jid, recruiter_rid, city, state, pincode, company_name, 
            role_name, positions_open, skills, job_description, 
            experience, salary, qualification, benefits, revenue, access_mode
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
          jid,
          recruiter_rid || null,
          parsedData.city,
          parsedData.state,
          parsedData.pincode,
          parsedData.company_name,
          parsedData.role_name,
          parsedData.positions_open,
          parsedData.skills,
          parsedData.job_description,
          parsedData.experience,
          parsedData.salary,
          parsedData.qualification,
          parsedData.benefits,
          parsedData.revenue || 0,
          parsedData.access_mode || 'open'
        ];

        await db.execute(query, values);
        
        savedJobs.push({
          jid: jid,
          role_name: parsedData.role_name,
          status: 'saved'
        });
      } catch (error) {
        failedJobs.push({
          role_name: parsedData.role_name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      saved: savedJobs.length,
      failed: failedJobs.length,
      savedJobs: savedJobs,
      failedJobs: failedJobs
    });
  } catch (error) {
    console.error('Batch Save Error:', error);
    res.status(500).json({ 
      error: 'Failed to save batch jobs', 
      details: error.message 
    });
  }
});

// Route: Get parsing statistics
router.get('/stats', async (req, res) => {
  try {
    const db = req.app.get('db');
    
    const [totalJobs] = await db.execute('SELECT COUNT(*) as count FROM jobs');
    const [recentJobs] = await db.execute(
      'SELECT COUNT(*) as count FROM jobs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    const [byAccessMode] = await db.execute(
      'SELECT access_mode, COUNT(*) as count FROM jobs GROUP BY access_mode'
    );
    const [topCompanies] = await db.execute(
      'SELECT company_name, COUNT(*) as count FROM jobs GROUP BY company_name ORDER BY count DESC LIMIT 10'
    );

    res.json({
      success: true,
      stats: {
        totalJobs: totalJobs[0].count,
        recentJobs: recentJobs[0].count,
        byAccessMode: byAccessMode,
        topCompanies: topCompanies
      }
    });
  } catch (error) {
    console.error('Stats Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics', 
      details: error.message 
    });
  }
});

// Route: Search jobs
router.get('/search', async (req, res) => {
  try {
    const db = req.app.get('db');
    const { keyword, city, state, experience, limit = 20, offset = 0 } = req.query;

    let query = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];

    if (keyword) {
      query += ' AND (role_name LIKE ? OR skills LIKE ? OR company_name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (city) {
      query += ' AND city = ?';
      params.push(city);
    }

    if (state) {
      query += ' AND state = ?';
      params.push(state);
    }

    if (experience) {
      query += ' AND experience LIKE ?';
      params.push(`%${experience}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [jobs] = await db.execute(query, params);

    res.json({
      success: true,
      count: jobs.length,
      jobs: jobs
    });
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ 
      error: 'Failed to search jobs', 
      details: error.message 
    });
  }
});

// Route: Get job by JID
router.get('/:jid', async (req, res) => {
  try {
    const db = req.app.get('db');
    const { jid } = req.params;

    const [jobs] = await db.execute('SELECT * FROM jobs WHERE jid = ?', [jid]);

    if (jobs.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      success: true,
      job: jobs[0]
    });
  } catch (error) {
    console.error('Get Job Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch job', 
      details: error.message 
    });
  }
});

// Route: Update job
router.put('/:jid', async (req, res) => {
  try {
    const db = req.app.get('db');
    const { jid } = req.params;
    const updateData = req.body;

    // Build dynamic update query
    const allowedFields = [
      'city', 'state', 'pincode', 'company_name', 'role_name', 
      'positions_open', 'skills', 'job_description', 'experience', 
      'salary', 'qualification', 'benefits', 'access_mode', 'revenue'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(updateData[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(jid);
    const query = `UPDATE jobs SET ${updates.join(', ')} WHERE jid = ?`;

    const [result] = await db.execute(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      success: true,
      message: 'Job updated successfully',
      jid: jid
    });
  } catch (error) {
    console.error('Update Job Error:', error);
    res.status(500).json({ 
      error: 'Failed to update job', 
      details: error.message 
    });
  }
});

// Route: Delete job
router.delete('/:jid', async (req, res) => {
  try {
    const db = req.app.get('db');
    const { jid } = req.params;

    const [result] = await db.execute('DELETE FROM jobs WHERE jid = ?', [jid]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Delete Job Error:', error);
    res.status(500).json({ 
      error: 'Failed to delete job', 
      details: error.message 
    });
  }
});

module.exports = router;
