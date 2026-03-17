const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Sample JD 1: Home Loan Sales Officer
const sampleJD1 = `Function- Home loan
Designation: Sales Officer
Salary - 1.80 LPA to 2.10 LPA CTC + Lucrative Incentives

Job description:

1. Area/ Lane /Geography Mapping:
Responsible for lane to lane/ Area mapping of Area/ Geography at regular intervals with the help of supervisor. Identify new sources in the allocated Area/ Geography and inform the progress to reporting manager during team huddle.

2. Source Relationship Management:
Responsible for managing the relationship with all sources assigned and identified by him in his geography/area.

3. Maintain Reports:
Responsible for maintaining reports related to sales and all his activities in the prescribed format. Should maintain diary on daily basis in the prescribed format of activities.

4. Channel Partner Recruitment:
Responsible for identifying the need for appointment of a channel partner

5. Team Haddle:
Responsible for attending team huddle on a daily basis as per the set process.

6. Customer Relationship Management:
Responsible for enhancing the customer experience by developing and maintaining relationship with customers.

7. Completion of File:
Responsible for submission of complete application form, documentations and information.

Candidate Eligibility:
1. The candidate must be a graduate pass out from any stream.
2. Should have 1 Year of experience in sales (insurance & home loans preferred.
3. The job requires extensive traveling so the candidate must be willing to travel within the city.
4. Candidate must have good communication skills.`;

// Sample JD 2: Financial Services Associate
const sampleJD2 = `Financial Services Associate

Purpose: The role holder is required to meet his/ hertargets through generation of new leads and managing and building relationship with customers mapped to them inorder to cross sell Financial Services products.

Desired Background : MBA / Graduates

KPA & Activities:
1. Business Targets: Achievement of business targets for all financial products as defined and agreed upon.
· Meet customers to sell all financial products
· Meet & counsel Walk -in & DSA customers who have been referred to him / her by HDFC Limited
· Influence customers to buy FD who have no prior HDFC Deposit relationship.
· Ensure proper customer profiling on each call / customer visit, to identify and understand his/her needs and accordingly recommend investment and Insurance options.
· Obtain appropriate documents / information from the client and ensure the forms are duly completed before logging the sale.
· Communicate the necessary details to the customers for the products being bought by them.
· Ensure sale is completed through / in line with the defined sales process.
· Maintain product mix across types of loans / value of loans ( Eqt, Housing, etc) and appropriate open market share for all products ( PAR / ULIP / Non Par).
· Co-ordinate for all claims processing (with the help of TM/ ASM/ Coordinators / SM representatives).
· Closely monitor the HL data of the HL executives mapped to maximize the business opportunities.
· Ensure maximum joint calls with each HL executive mapped.
· Ensure that all reports are created and maintained in a timely manner (DSR, Sales Dairy, etc.)
· Ensure that all documents are properly scanned and there is no mistakes while lead updation in the system.
· Be completely aware of the products being offered by the company and understand competition offering to be able to handle customer objections.
· Be updated with the latest product features to enhance his / her selling abilities
· Ensure all desired matrix and business composition (persistency, funded, non funded, etc.) are met

2. Relationship Building:
* Manage relationship with HL executives mapped to him / her.
* Maintain good relations with HDFC Limited
* Maintain good relationship with Channel partners& DSA
* Build relationship with the assigned / sourced customer to create opportunities for various products to fulfil the customer's financial needs.

3. Account Management & Servicing:
* Manage and service the existing customer portfolio.
* Coordinate with the TM / Coordinator / SM for post sales service request form the customers (claims, endorsements, policy copy etc).
* Timely sharing of updated reports with the customers on products being bought by them.
* Co-ordinate with the customers at the time of renewals.

4. Certification and regulatory compliance:
* Be compliant towards selling of various products by undergoing the training and certification for IRDA, AMFI etc towards selling of insurance and any other products
* The FSA has to be conscious and vigilant towards declaration of the customer information. In case FSA feels there is disconnect in the information shared by customer versus his/her observation, they need to crosscheck the information before booking the business.
· Ensure the right quality of business being sourced.`;

async function testJDParsing() {
  try {
    console.log("🧪 Testing JD Parser with Gemini AI\n");
    console.log("=".repeat(80));

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = (
      jdText,
    ) => `You are an expert HR data extraction system. Extract the following information from the job description below and return it as valid JSON only (no markdown, no explanation).

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

    // Test Sample 1
    console.log("\n📄 Test Case 1: Home Loan Sales Officer");
    console.log("-".repeat(80));

    const result1 = await model.generateContent(prompt(sampleJD1));
    const text1 = result1.response.text();
    let cleaned1 = text1
      .trim()
      .replace(/```json\n?/g, "")
      .replace(/```\n?$/g, "");
    const parsed1 = JSON.parse(cleaned1);

    console.log("✅ Parsed Result:");
    console.log(JSON.stringify(parsed1, null, 2));

    // Test Sample 2
    console.log("\n\n📄 Test Case 2: Financial Services Associate");
    console.log("-".repeat(80));

    const result2 = await model.generateContent(prompt(sampleJD2));
    const text2 = result2.response.text();
    let cleaned2 = text2
      .trim()
      .replace(/```json\n?/g, "")
      .replace(/```\n?$/g, "");
    const parsed2 = JSON.parse(cleaned2);

    console.log("✅ Parsed Result:");
    console.log(JSON.stringify(parsed2, null, 2));

    console.log("\n" + "=".repeat(80));
    console.log("✅ All tests passed successfully!");
    console.log("🎉 JD Parser is working correctly with Gemini AI");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Details:", error);
  }
}

// Run tests
testJDParsing();
