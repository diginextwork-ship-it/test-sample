import React, { useState } from 'react';
import { Upload, FileText, Loader2, CheckCircle, XCircle, Save, Trash2, Database } from 'lucide-react';
import axios from 'axios';

const BatchJDUploader = () => {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedResults, setParsedResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [saveStatus, setSaveStatus] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setParsedResults([]);
    setErrors([]);
    setSaveStatus(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(droppedFiles);
    setParsedResults([]);
    setErrors([]);
    setSaveStatus(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleBatchUpload = async () => {
    if (files.length === 0) {
      alert('Please select files first');
      return;
    }

    setIsProcessing(true);
    setParsedResults([]);
    setErrors([]);
    setSaveStatus(null);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('jdFiles', file);
      });

      const response = await axios.post(`${API_URL}/api/jd/batch-upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setParsedResults(response.data.results || []);
      setErrors(response.data.errors || []);
    } catch (err) {
      setErrors([{ 
        fileName: 'System Error', 
        error: err.response?.data?.error || 'Failed to process files' 
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAll = async () => {
    if (parsedResults.length === 0) {
      alert('No parsed data to save');
      return;
    }

    setIsProcessing(true);
    setSaveStatus(null);

    try {
      const recruiterRid = localStorage.getItem('recruiter_rid') || null;
      const batchData = parsedResults.map(result => result.data);

      const response = await axios.post(`${API_URL}/api/jd/batch-save`, {
        recruiter_rid: recruiterRid,
        batchData: batchData
      });

      setSaveStatus({
        success: true,
        message: `Successfully saved ${response.data.saved} jobs!`,
        details: response.data
      });

      // Reset after success
      setTimeout(() => {
        setFiles([]);
        setParsedResults([]);
        setErrors([]);
        setSaveStatus(null);
      }, 3000);
    } catch (err) {
      setSaveStatus({
        success: false,
        message: err.response?.data?.error || 'Failed to save jobs'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
  };

  const removeResult = (index) => {
    const newResults = parsedResults.filter((_, i) => i !== index);
    setParsedResults(newResults);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-8 text-white">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Database className="w-8 h-8" />
              Batch JD Upload
            </h1>
            <p className="mt-2 text-purple-100">
              Upload multiple job descriptions and process them all at once
            </p>
          </div>

          <div className="p-8">
            {/* Upload Area */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-purple-400 transition-colors cursor-pointer bg-gray-50 mb-6"
            >
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.docx,.txt"
                multiple
                className="hidden"
                id="batch-file-upload"
              />
              <label htmlFor="batch-file-upload" className="cursor-pointer">
                <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  Drop multiple JD files here or click to browse
                </p>
                <p className="text-sm text-gray-500">
                  Supports PDF, DOCX, and TXT files (Max 10 files, 10MB each)
                </p>
              </label>
            </div>

            {/* Selected Files */}
            {files.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Selected Files ({files.length})</h3>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                          <p className="text-xs text-gray-600">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Process Button */}
            {files.length > 0 && parsedResults.length === 0 && (
              <button
                onClick={handleBatchUpload}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mb-6"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing {files.length} files...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Process All Files with AI
                  </>
                )}
              </button>
            )}

            {/* Parsed Results */}
            {parsedResults.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    Successfully Parsed ({parsedResults.length})
                  </h3>
                  <button
                    onClick={handleSaveAll}
                    disabled={isProcessing}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save All to Database
                      </>
                    )}
                  </button>
                </div>
                
                <div className="space-y-4">
                  {parsedResults.map((result, index) => (
                    <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                          <p className="font-medium text-green-900">{result.fileName}</p>
                        </div>
                        <button
                          onClick={() => removeResult(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Company:</span>
                          <p className="font-medium">{result.data.company_name}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Role:</span>
                          <p className="font-medium">{result.data.role_name}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Location:</span>
                          <p className="font-medium">
                            {result.data.city && result.data.state 
                              ? `${result.data.city}, ${result.data.state}`
                              : result.data.state || result.data.city || 'Not specified'}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Experience:</span>
                          <p className="font-medium">{result.data.experience}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Salary:</span>
                          <p className="font-medium">{result.data.salary}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Positions:</span>
                          <p className="font-medium">{result.data.positions_open}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-red-700">
                  Failed ({errors.length})
                </h3>
                <div className="space-y-2">
                  {errors.map((error, index) => (
                    <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-900">{error.fileName}</p>
                        <p className="text-sm text-red-700">{error.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save Status */}
            {saveStatus && (
              <div className={`rounded-lg p-4 flex items-start gap-3 ${
                saveStatus.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                {saveStatus.success ? (
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`font-medium ${saveStatus.success ? 'text-green-800' : 'text-red-800'}`}>
                    {saveStatus.message}
                  </p>
                  {saveStatus.details && (
                    <p className="text-sm mt-1 text-gray-700">
                      Saved: {saveStatus.details.saved} | Failed: {saveStatus.details.failed}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchJDUploader;
