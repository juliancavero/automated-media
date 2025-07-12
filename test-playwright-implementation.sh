#!/bin/bash

# Test script for the new Playwright implementation
# This script demonstrates how to use the new endpoints

echo "=== Testing Playwright Quiz Recording ==="
echo ""

# Example 1: Record a quiz by ID using the existing endpoint
echo "1. Recording quiz by ID using QuizzTest controller:"
echo "POST /quizzes/:id/record"
echo "Body: { \"baseUrl\": \"http://localhost:5173\" }"
echo ""

# Example 2: Record using the new Playwright controller directly
echo "2. Recording using Playwright controller directly:"
echo "POST /playwright/record-quiz/:id"
echo "Body: { \"baseUrl\": \"http://localhost:5173\" }"
echo ""

# Example 3: Record with custom URL
echo "3. Recording with custom URL:"
echo "POST /playwright/record"
echo "Body: { \"url\": \"http://localhost:5173/quizz/YOUR_QUIZ_ID\" }"
echo ""

echo "=== Implementation Features ==="
echo ""
echo "✅ Vertical mobile format: 1080x1920"
echo "✅ High quality MP4 output"
echo "✅ Automatic webm to mp4 conversion using FFmpeg"
echo "✅ Waits for start-quizz element before recording"
echo "✅ Waits for end-quizz element to stop recording"
echo "✅ Clean integration with NestJS"
echo "✅ Error handling and logging"
echo "✅ Automatic file cleanup"
echo ""

echo "=== File Structure ==="
echo ""
echo "📁 src/quizz/"
echo "  📁 playwright/"
echo "    📄 playwright.service.ts     - Main recording logic"
echo "    📄 playwright.controller.ts  - REST endpoints"
echo "    📄 playwright.module.ts      - NestJS module"
echo "  📁 helpers/"
echo "    📄 ffmpeg-converter.ts       - WebM to MP4 conversion"
echo "  📁 quizztest/"
echo "    📄 quizztest.controller.ts   - Updated to use Playwright"
echo "    📄 quizztest.module.ts       - Updated imports"
echo ""

echo "=== Output Files ==="
echo ""
echo "Videos are saved as: public/videos/quiz-{quizId}.mp4"
echo ""
