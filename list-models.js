// List available Gemini models
const { GoogleGenerativeAI } = require('@google/generative-ai')

const API_KEY = 'AIzaSyAZB4-tLhnTF6SArSM6i5WyWsQ95Hi1Bws'

async function listModels() {
  try {
    console.log('🔍 Listing available Gemini models...')
    
    const genAI = new GoogleGenerativeAI(API_KEY)
    const models = await genAI.listModels()
    
    console.log('📋 Available models:')
    models.forEach(model => {
      console.log(`- ${model.name} (${model.displayName})`)
      console.log(`  Supported: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}`)
    })
    
  } catch (error) {
    console.error('❌ Error listing models:', error.message)
    
    // Let's try some common model names that might work
    const commonModels = [
      'models/gemini-pro',
      'models/gemini-1.5-flash',
      'models/gemini-1.5-pro',
      'gemini-pro',
      'gemini-1.0-pro',
      'text-bison-001'
    ]
    
    console.log('\n🔄 Testing common model names...')
    
    for (const modelName of commonModels) {
      try {
        console.log(`Testing: ${modelName}`)
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent("Hello")
        const response = await result.response
        const text = response.text()
        
        console.log(`✅ SUCCESS with ${modelName}:`, text.slice(0, 100))
        break
        
      } catch (err) {
        console.log(`❌ Failed: ${modelName}`)
      }
    }
  }
}

listModels()