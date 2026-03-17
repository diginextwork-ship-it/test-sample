#!/bin/bash

echo "🚀 Setting up JD Parser - Recruiting Platform"
echo "=============================================="
echo ""

# Backend setup
echo "📦 Setting up Backend..."
cd backend
npm install
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Please configure backend/.env with your database and API credentials"
fi
cd ..

echo ""

# Frontend setup
echo "📦 Setting up Frontend..."
cd frontend
npm install
if [ ! -f .env ]; then
    cp .env.example .env
    echo "ℹ️  Frontend .env created with default values"
fi
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Configure backend/.env with your MySQL database credentials"
echo "2. Add your Gemini API key to backend/.env"
echo "3. Start backend: cd backend && npm start"
echo "4. Start frontend: cd frontend && npm run dev"
echo ""
echo "🌐 Frontend will be available at: http://localhost:3000"
echo "🔌 Backend API will be available at: http://localhost:5000"
