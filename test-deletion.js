const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:4002/api';

async function testDeletion() {
  try {
    console.log('🔐 Testing login...');
    
    // Login
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Login successful');
    
    // Create a test note
    console.log('📝 Creating test note...');
    const createResponse = await fetch(`${BASE_URL}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'Test Deletion Note',
        content: 'This note will be deleted',
        tags: ['test']
      })
    });
    
    if (!createResponse.ok) {
      throw new Error(`Create note failed: ${createResponse.status}`);
    }
    
    const noteData = await createResponse.json();
    const noteId = noteData.id;
    console.log(`✅ Note created with ID: ${noteId}`);
    
    // Verify note exists
    console.log('🔍 Verifying note exists...');
    const getResponse = await fetch(`${BASE_URL}/notes`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const allNotes = await getResponse.json();
    const noteExists = allNotes.some(note => note.id === noteId);
    console.log(`✅ Note exists in database: ${noteExists}`);
    
    // Delete the note permanently
    console.log('🗑️ Deleting note permanently...');
    const deleteResponse = await fetch(`${BASE_URL}/notes/${noteId}/permanent`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      throw new Error(`Delete failed: ${deleteResponse.status} - ${errorText}`);
    }
    
    console.log('✅ Delete request completed');
    
    // Verify note is gone
    console.log('🔍 Verifying note is deleted...');
    const verifyResponse = await fetch(`${BASE_URL}/notes`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const remainingNotes = await verifyResponse.json();
    const noteStillExists = remainingNotes.some(note => note.id === noteId);
    
    if (noteStillExists) {
      console.log('❌ FAIL: Note still exists in database after deletion');
      return false;
    } else {
      console.log('✅ SUCCESS: Note properly deleted from database');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

testDeletion().then(success => {
  process.exit(success ? 0 : 1);
});
