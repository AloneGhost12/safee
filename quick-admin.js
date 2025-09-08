const { MongoClient } = require('mongodb');
require('dotenv').config({ path: './server/.env' });

async function promoteUser() {
  // Use environment variable for MongoDB connection
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/vault';
  const client = new MongoClient(mongoUri);
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('test'); // Using the default database name for MongoDB Atlas
    const users = db.collection('users');
    
    // Get admin email from environment variable or prompt
    const email = process.env.ADMIN_EMAIL || 'gff130170@gmail.com';
    console.log(`🔍 Looking for user: ${email}`);
    
    const user = await users.findOne({ email });
    if (!user) {
      console.log('❌ User not found. Please create an account first at your frontend URL');
      console.log('💡 Set ADMIN_EMAIL environment variable to specify which user to promote');
      return;
    }
    
    console.log(`👤 User found: ${user.username} (${user.email})`);
    console.log(`   Created: ${user.createdAt}`);
    console.log(`   Current role: ${user.role || 'user'}`);
    
    if (user.role === 'super_admin') {
      console.log('✅ User is already a super admin!');
      return;
    }
    
    // Promote to super admin
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          role: 'super_admin',
          adminPermissions: [
            'user_management',
            'security_monitoring',
            'system_admin',
            'audit_logs',
            'user_unlock',
            'data_export',
            'system_config'
          ],
          adminCreatedAt: new Date(),
          adminCreatedBy: 'system',
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`🎉 Successfully promoted ${email} to super_admin`);
    console.log('📋 Granted all admin permissions');
    console.log('🔗 Admin panel access:');
    console.log('   Local: http://localhost:5179/admin/login');
    console.log('   Production: https://your-domain.com/admin/login');
    console.log(`🔑 Use your regular login credentials for: ${email}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Make sure MongoDB is running on localhost:27017');
    }
  } finally {
    await client.close();
    console.log('🔌 Database connection closed');
  }
}

promoteUser().catch(console.error);
