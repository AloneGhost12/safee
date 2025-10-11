const fetch = require('node-fetch');

(async () => {
  try {
    const res = await fetch('http://localhost:4004/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'lockouttest456', password: 'WrongPassword123!' })
    })

    console.log('Status:', res.status)
    const text = await res.text()
    try {
      console.log('Body:', JSON.parse(text))
    } catch (e) {
      console.log('Body (raw):', text)
    }
  } catch (e) {
    console.error('Request failed:', e.message)
  }
})()
