// Test script to verify Gemini API integration
const { GoogleGenerativeAI } = require('@google/generative-ai')

const API_KEY = 'AIzaSyAZB4-tLhnTF6SArSM6i5WyWsQ95Hi1Bws'

async function testGemini() {
  try {
    console.log('🔍 Testing Gemini API integration...')
    
    const genAI = new GoogleGenerativeAI(API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
    
    const prompt = "Hello! Please respond with a brief greeting."
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    console.log('✅ Gemini API Response:', text)
    console.log('🎉 Gemini integration is working!')
    
  } catch (error) {
    console.error('❌ Gemini API Error:', error.message)
    
    // Try with different model names
    const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro-vision']
    
    for (const modelName of models) {
      try {
        console.log(`🔄 Trying model: ${modelName}`)
        const genAI = new GoogleGenerativeAI(API_KEY)
        const model = genAI.getGenerativeModel({ model: modelName })
        
        const result = await model.generateContent("Test")
        const response = await result.response
        const text = response.text()
        
        console.log(`✅ Success with model: ${modelName}`)
        console.log('Response:', text)
        break
        
      } catch (modelError) {
        console.log(`❌ Failed with model: ${modelName} - ${modelError.message}`)
      }
    }
  }
}

testGemini()