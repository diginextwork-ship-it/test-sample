import React, { useState } from 'react';
import { Upload, FileText, Loader2, CheckCircle, XCircle, Eye, Save } from 'lucide-react';
import axios from 'axios';

const JDParser = () => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('upload');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setParsedData(null);
      setSuccess(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError(null);
      setParsedData(null);
      setSuccess(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleUploadAndParse = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setIsParsing(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('jdFile', file);

      const response = await axios.post(`${API_URL}/api/jd/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setParsedData(response.data.data);
      setSuccess('JD parsed successfully!');
      setActiveTab('review');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload and parse file');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      setIsParsing(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setParsedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveJob = async () => {
    if (!parsedData) {
      setError('No parsed data to save');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const recruiterRid = localStorage.getItem('recruiter_rid') || null;

      const response = await axios.post(`${API_URL}/api/jd/save`, {
        recruiter_rid: recruiterRid,
        parsedData: parsedData
      });

      setSuccess(`Job posting created successfully! JID: ${response.data.jid}`);
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setFile(null);
        setParsedData(null);
        setSuccess(null);
        setActiveTab('upload');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save job posting');
      console.error('Save error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FileText className="w-8 h-8" />
              JD Parser
            </h1>
            <p className="mt-2 text-blue-100">
              Upload job descriptions and let AI extract structured data automatically
            </p>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('upload')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'upload'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Upload JD
              </button>
              <button
                onClick={() => setActiveTab('review')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'review'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                disabled={!parsedData}
              >
                Review & Edit
              </button>
            </div>
          </div>

          <div className="p-8">
            {/* Upload Tab */}
            {activeTab === 'upload' && (
              <div className="space-y-6">
                {/* File Upload Area */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-400 transition-colors cursor-pointer bg-gray-50"
                >
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      Drop your JD file here or click to browse
                    </p>
                    <p className="text-sm text-gray-500">
                      Supports PDF, DOCX, and TXT files (Max 10MB)
                    </p>
                  </label>
                </div>

                {/* Selected File Display */}
                {file && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-6 h-6 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-600">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <XCircle className="w-6 h-6" />
                    </button>
                  </div>
                )}

                {/* Action Button */}
                <button
                  onClick={handleUploadAndParse}
                  disabled={!file || isUploading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Parsing with AI...
                    </>
                  ) : (
                    <>
                      <Eye className="w-5 h-5" />
                      Parse JD with AI
                    </>
                  )}
                </button>

                {/* Messages */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-green-800">{success}</p>
                  </div>
                )}
              </div>
            )}

            {/* Review Tab */}
            {activeTab === 'review' && parsedData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Company Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={parsedData.company_name}
                      onChange={(e) => handleFieldChange('company_name', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Role Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role / Designation
                    </label>
                    <input
                      type="text"
                      value={parsedData.role_name}
                      onChange={(e) => handleFieldChange('role_name', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={parsedData.city}
                      onChange={(e) => handleFieldChange('city', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={parsedData.state}
                      onChange={(e) => handleFieldChange('state', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Pincode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pincode
                    </label>
                    <input
                      type="text"
                      value={parsedData.pincode}
                      onChange={(e) => handleFieldChange('pincode', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Positions Open */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Positions Open
                    </label>
                    <input
                      type="number"
                      value={parsedData.positions_open}
                      onChange={(e) => handleFieldChange('positions_open', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Experience */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Experience Required
                    </label>
                    <input
                      type="text"
                      value={parsedData.experience}
                      onChange={(e) => handleFieldChange('experience', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Salary */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Salary Range
                    </label>
                    <input
                      type="text"
                      value={parsedData.salary}
                      onChange={(e) => handleFieldChange('salary', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skills Required (comma-separated)
                  </label>
                  <textarea
                    value={parsedData.skills}
                    onChange={(e) => handleFieldChange('skills', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Qualification */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Qualification
                  </label>
                  <textarea
                    value={parsedData.qualification}
                    onChange={(e) => handleFieldChange('qualification', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Benefits */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Benefits & Perks
                  </label>
                  <textarea
                    value={parsedData.benefits}
                    onChange={(e) => handleFieldChange('benefits', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Job Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Job Description
                  </label>
                  <textarea
                    value={parsedData.job_description}
                    onChange={(e) => handleFieldChange('job_description', e.target.value)}
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>

                {/* Save Button */}
                <div className="flex gap-4">
                  <button
                    onClick={handleSaveJob}
                    disabled={isUploading}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Save Job Posting
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setParsedData(null);
                      setActiveTab('upload');
                    }}
                    className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                </div>

                {/* Messages */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-green-800">{success}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JDParser;
