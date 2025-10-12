import { GoogleGenerativeAI } from '@google/generative-ai'

interface GeminiConfig {
  apiKey: string
  model: string
}

interface AIAnalysisResult {
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'email' | 'database' | 'storage' | 'auth' | 'performance' | 'general'
  solution: string
  autoFixable: boolean
  steps: string[]
}

export class GeminiService {
  private genAI: GoogleGenerativeAI
  private model: any
  public enabled: boolean
  private defaultModel: string

  constructor(config: GeminiConfig) {
    this.enabled = !!config.apiKey
    this.defaultModel = config.model
    if (this.enabled) {
      this.genAI = new GoogleGenerativeAI(config.apiKey)
      this.model = this.genAI.getGenerativeModel({ model: config.model })
    } else {
  // Placeholder to avoid undefined references; calls will use fallbacks
  this.genAI = {} as GoogleGenerativeAI
  this.model = null
      console.warn('⚠️ Gemini disabled: GEMINI_API_KEY is not set')
    }
  }

  getStatus() {
    return {
      enabled: this.enabled,
      model: this.defaultModel,
      apiKeyPresent: this.enabled,
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, tag: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout after ${ms}ms in ${tag}`))
      }, ms)
      promise
        .then((v) => {
          clearTimeout(timer)
          resolve(v)
        })
        .catch((e) => {
          clearTimeout(timer)
          reject(e)
        })
    })
  }

  async analyzeIssue(
    issueDescription: string,
    systemHealth: any,
    userContext: { userId: string; role: string }
  ): Promise<AIAnalysisResult> {
    try {
      if (!this.enabled) {
        console.log('ℹ️ Gemini disabled, returning intelligent fallback analysis')
        return this.getIntelligentAnalysis(issueDescription, systemHealth)
      }
      const systemContext = this.buildSystemContext(systemHealth)
      
      // Try multiple models
      const modelNames = [
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash',
        'gemini-1.5-pro-latest', 
        'gemini-1.5-pro',
        'gemini-pro-latest',
        'gemini-pro'
      ]

      for (const modelName of modelNames) {
        try {
          console.log(`🔍 Analyzing issue with model: ${modelName}`)
          const model = this.genAI.getGenerativeModel({ model: modelName })
          
          const prompt = `
You are an expert system administrator for a secure file vault application. Analyze this issue and provide actionable solutions.

SYSTEM CONTEXT:
${systemContext}

USER ISSUE: "${issueDescription}"

USER CONTEXT:
- User ID: ${userContext.userId}
- Role: ${userContext.role}

Please analyze this issue and respond with ONLY a JSON object in this exact format:
{
  "severity": "low|medium|high|critical",
  "category": "email|database|storage|auth|performance|general",
  "solution": "Clear, actionable solution description",
  "autoFixable": true|false,
  "steps": ["Step 1", "Step 2", "Step 3"]
}

Focus on:
1. Security implications
2. User experience impact
3. Safe configuration fixes (no code changes)
4. Prevention strategies

Be concise but thorough. Prioritize user safety and system stability.
`

          const result = await this.withTimeout(model.generateContent(prompt), 15000, `analyzeIssue:${modelName}`)
          const response = await result.response
          const text = response.text()

          // Parse JSON response
          try {
            const analysis = JSON.parse(text.trim())
            console.log(`✅ Successfully analyzed with model: ${modelName}`)
            return this.validateAnalysis(analysis)
          } catch (parseError) {
            console.error(`Failed to parse response from ${modelName}:`, text)
            continue
          }
          
        } catch (modelError) {
          console.log(`❌ Failed analysis with model: ${modelName}`)
          continue
        }
      }
      
      // If all models fail, return intelligent fallback
      throw new Error('All Gemini models failed for analysis')
      
    } catch (error) {
      console.error('Gemini API error:', error)
      return this.getIntelligentAnalysis(issueDescription, systemHealth)
    }
  }

  private getIntelligentAnalysis(issueDescription: string, systemHealth: any): AIAnalysisResult {
    const lowerDescription = issueDescription.toLowerCase()
    
    // Email issues
    if (lowerDescription.includes('email') || lowerDescription.includes('mail')) {
      return {
        severity: systemHealth?.email?.status === 'down' ? 'critical' : 'medium',
        category: 'email',
        solution: 'Email service issue detected. Check SMTP configuration and email service status.',
        autoFixable: systemHealth?.email?.status === 'healthy',
        steps: [
          'Check email service status in admin panel',
          'Verify SMTP configuration settings',
          'Test email connectivity',
          'Check email logs for errors',
          'Contact system administrator if issue persists'
        ]
      }
    }
    
    // Database issues
    if (lowerDescription.includes('database') || lowerDescription.includes('data') || lowerDescription.includes('save')) {
      return {
        severity: systemHealth?.database?.status === 'down' ? 'critical' : 'high',
        category: 'database',
        solution: 'Database connectivity or performance issue detected.',
        autoFixable: false,
        steps: [
          'Check database connection status',
          'Monitor database performance metrics',
          'Review database logs',
          'Restart database service if needed',
          'Contact database administrator'
        ]
      }
    }
    
    // Authentication issues
    if (lowerDescription.includes('login') || lowerDescription.includes('auth') || lowerDescription.includes('password')) {
      return {
        severity: 'high',
        category: 'auth',
        solution: 'Authentication system issue. Check user credentials and auth service status.',
        autoFixable: true,
        steps: [
          'Reset user password if needed',
          'Clear authentication cache',
          'Check auth service logs',
          'Verify user account status',
          'Test authentication flow'
        ]
      }
    }
    
    // File/Storage issues
    if (lowerDescription.includes('file') || lowerDescription.includes('upload') || lowerDescription.includes('download') || lowerDescription.includes('storage')) {
      return {
        severity: systemHealth?.storage?.status === 'down' ? 'critical' : 'medium',
        category: 'storage',
        solution: 'File system or storage issue detected.',
        autoFixable: systemHealth?.storage?.status === 'healthy',
        steps: [
          'Check storage space availability',
          'Verify file permissions',
          'Test file upload/download functionality',
          'Check storage service logs',
          'Clean up temporary files if needed'
        ]
      }
    }
    
    // Performance issues
    if (lowerDescription.includes('slow') || lowerDescription.includes('performance') || lowerDescription.includes('loading')) {
      return {
        severity: 'medium',
        category: 'performance',
        solution: 'Performance degradation detected. Check system resources and optimize configuration.',
        autoFixable: true,
        steps: [
          'Monitor system resource usage',
          'Check for memory leaks',
          'Optimize database queries',
          'Clear application cache',
          'Review server performance metrics'
        ]
      }
    }
    
    // Default analysis
    return {
      severity: 'medium',
      category: 'general',
      solution: 'General system issue detected. Requires investigation based on system health metrics.',
      autoFixable: false,
      steps: [
        'Review system health dashboard',
        'Check application logs for errors',
        'Monitor system performance',
        'Contact technical support with details',
        'Document issue for further analysis'
      ]
    }
  }

  async generateChatResponse(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemHealth: any,
    userContext: { userId: string; role: string }
  ): Promise<string> {
    try {
      if (!this.enabled) {
        console.log('ℹ️ Gemini disabled, using intelligent chat fallback')
        return this.getIntelligentFallback(message, systemHealth)
      }
      const systemContext = this.buildSystemContext(systemHealth)
      const chatHistory = this.buildChatHistory(conversationHistory)

      // Try multiple model names
      const modelNames = [
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash',
        'gemini-1.5-pro-latest', 
        'gemini-1.5-pro',
        'gemini-pro-latest',
        'gemini-pro'
      ]

      for (const modelName of modelNames) {
        try {
          console.log(`🤖 Trying Gemini model: ${modelName}`)
          const model = this.genAI.getGenerativeModel({ model: modelName })

          const prompt = `
You are an AI assistant for a secure file vault application. Help users with technical issues, questions, and troubleshooting.

SYSTEM STATUS:
${systemContext}

CONVERSATION HISTORY:
${chatHistory}

USER: "${message}"

Guidelines:
- Be helpful, concise, and professional
- Focus on security and data protection
- Suggest safe solutions (configuration only, no code changes)
- If you detect issues, offer to analyze them in detail
- Provide step-by-step instructions when needed
- Always prioritize user safety and system stability

Respond naturally as a helpful technical assistant. Keep responses under 200 words unless detailed steps are needed.
`

          const result = await this.withTimeout(model.generateContent(prompt), 15000, `generateChatResponse:${modelName}`)
          const response = await result.response
          const text = response.text().trim()
          
          console.log(`✅ Success with model: ${modelName}`)
          return text
          
        } catch (modelError) {
          console.log(`❌ Failed with model: ${modelName}`)
          continue
        }
      }
      
      // If all models fail, return a helpful fallback
      throw new Error('All Gemini models failed')
      
    } catch (error) {
      console.error('Gemini chat error:', error)
      
      // Provide intelligent fallback based on message content
      return this.getIntelligentFallback(message, systemHealth)
    }
  }

  private getIntelligentFallback(message: string, systemHealth: any): string {
    const lowerMessage = message.toLowerCase()
    
    // Email-related issues
    if (lowerMessage.includes('email') || lowerMessage.includes('mail')) {
      return `📧 **Email System Status**: ${systemHealth?.email?.status || 'Unknown'}

I can help with email issues! Here are some common solutions:

1. **Check Email Configuration**: Verify SMTP settings in admin panel
2. **Test Email Service**: Try sending a test email
3. **Check Spam Folder**: Sometimes emails end up in spam
4. **Contact Support**: If issues persist, contact system administrator

The AI system is temporarily unavailable, but I can still provide basic assistance based on system health data.`
    }
    
    // Authentication issues
    if (lowerMessage.includes('login') || lowerMessage.includes('auth') || lowerMessage.includes('password')) {
      return `🔐 **Authentication Help**

Having trouble logging in? Here's what you can try:

1. **Reset Password**: Use the "Forgot Password" link on login page
2. **Clear Browser Cache**: Clear cookies and cached data
3. **Check Caps Lock**: Ensure caps lock is off
4. **Try Different Browser**: Sometimes browser-specific issues occur
5. **Contact Support**: If nothing works, reach out to admin

System Status: Database ${systemHealth?.database?.status || 'Unknown'}`
    }
    
    // Performance issues
    if (lowerMessage.includes('slow') || lowerMessage.includes('loading') || lowerMessage.includes('performance')) {
      return `⚡ **Performance Issues**

App running slowly? Here are some quick fixes:

1. **Refresh Page**: Simple page refresh often helps
2. **Check Internet**: Verify your connection speed
3. **Close Other Tabs**: Free up browser memory
4. **Clear Cache**: Clear browser data and cookies
5. **Try Incognito**: Test in private/incognito mode

Current System Health: Overall ${systemHealth?.overall || 'Unknown'}`
    }
    
    // File-related issues
    if (lowerMessage.includes('file') || lowerMessage.includes('upload') || lowerMessage.includes('download')) {
      return `📁 **File Management Help**

Having file issues? Here's what to check:

1. **File Size**: Ensure file isn't too large (check limits)
2. **File Type**: Verify file type is supported
3. **Storage Space**: Check if storage quota is reached
4. **Browser Permissions**: Allow file access if prompted
5. **Try Again**: Sometimes temporary network issues occur

Storage Status: ${systemHealth?.storage?.status || 'Unknown'}`
    }
    
    // General greeting/help
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('help')) {
      return `👋 **Hello! I'm your AI Debug Assistant**

I can help you with:
- 📧 Email configuration and troubleshooting
- 🔐 Login and authentication issues  
- 📁 File upload/download problems
- ⚡ Performance and speed issues
- 🛠️ General app troubleshooting

**Current System Status:**
- Overall: ${systemHealth?.overall || 'Unknown'}
- Email: ${systemHealth?.email?.status || 'Unknown'}
- Database: ${systemHealth?.database?.status || 'Unknown'}
- Storage: ${systemHealth?.storage?.status || 'Unknown'}

Just describe your issue and I'll provide helpful guidance!`
    }
    
    // Default fallback
    return `🤖 **AI Assistant (Fallback Mode)**

I'm experiencing some technical difficulties with the advanced AI features, but I can still help!

**What I can assist with:**
- System status information
- Basic troubleshooting steps
- Configuration guidance
- General support

**Current System Health:**
- Overall Status: ${systemHealth?.overall || 'Checking...'}
- Email Service: ${systemHealth?.email?.status || 'Checking...'}
- Database: ${systemHealth?.database?.status || 'Checking...'}
- Storage: ${systemHealth?.storage?.status || 'Checking...'}

Please describe your issue in more detail, and I'll provide the best guidance I can with the available system information.`
  }

  private buildSystemContext(systemHealth: any): string {
    if (!systemHealth) return "System health data unavailable"

    const { email, database, storage, overall } = systemHealth
    
    return `
System Health Overview:
- Overall Status: ${overall?.status || 'unknown'}
- Email Service: ${email?.status || 'unknown'} (${email?.responseTime || 'N/A'}ms)
- Database: ${database?.status || 'unknown'} (${database?.responseTime || 'N/A'}ms)
- Storage: ${storage?.status || 'unknown'} (${storage?.responseTime || 'N/A'}ms)
- Last Check: ${systemHealth.timestamp || 'unknown'}

Issues Detected:
${systemHealth.issues?.length ? systemHealth.issues.join('\n') : 'None'}
`
  }

  private buildChatHistory(history: Array<{ role: string; content: string }>): string {
    if (!history?.length) return "No previous conversation"
    
    return history
      .slice(-5) // Keep last 5 messages for context
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n')
  }

  private validateAnalysis(analysis: any): AIAnalysisResult {
    // Validate and sanitize the analysis response
    const validSeverities = ['low', 'medium', 'high', 'critical']
    const validCategories = ['email', 'database', 'storage', 'auth', 'performance', 'general']

    return {
      severity: validSeverities.includes(analysis.severity) ? analysis.severity : 'medium',
      category: validCategories.includes(analysis.category) ? analysis.category : 'general',
      solution: typeof analysis.solution === 'string' ? analysis.solution : 'Issue requires manual investigation',
      autoFixable: typeof analysis.autoFixable === 'boolean' ? analysis.autoFixable : false,
      steps: Array.isArray(analysis.steps) ? analysis.steps.slice(0, 10) : ['Contact system administrator']
    }
  }

  private getFallbackAnalysis(issueDescription: string): AIAnalysisResult {
    // Fallback analysis when AI is unavailable
    const isEmailRelated = /email|smtp|send|mail/i.test(issueDescription)
    const isDatabaseRelated = /database|mongo|connection|data/i.test(issueDescription)
    const isAuthRelated = /login|auth|password|token/i.test(issueDescription)

    let category: AIAnalysisResult['category'] = 'general'
    if (isEmailRelated) category = 'email'
    else if (isDatabaseRelated) category = 'database'
    else if (isAuthRelated) category = 'auth'

    return {
      severity: 'medium',
      category,
      solution: 'This issue requires manual investigation. Please check system logs and contact support if needed.',
      autoFixable: false,
      steps: [
        'Check system status dashboard',
        'Review recent error logs',
        'Contact system administrator if issue persists'
      ]
    }
  }
}

// Create singleton instance
const geminiService = new GeminiService({
  apiKey: process.env.GEMINI_API_KEY || '',
  model: 'gemini-pro' // Use the standard model name
})

export default geminiService