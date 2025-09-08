const { MongoClient } = require('mongodb');
const readline = require('readline');

/**
 * Script to promote a user to admin or create an admin user
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function promoteToAdmin() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/vault';
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const users = db.collection('users');
    
    console.log('\n📋 Admin User Management');
    console.log('=======================\n');
    
    const action = await question('What would you like to do?\n1. Promote existing user to admin\n2. List current admins\nChoose (1-2): ');
    
    if (action === '1') {
      // Promote existing user
      const email = await question('\nEnter the email address of the user to promote: ');
      
      const user = await users.findOne({ email });
      if (!user) {
        console.log('❌ User not found with that email address');
        return;
      }
      
      console.log(`\n👤 User found: ${user.username} (${user.email})`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Current role: ${user.role || 'user'}`);
      
      if (user.role === 'admin' || user.role === 'super_admin') {
        console.log('ℹ️  User is already an admin');
        return;
      }
      
      const roleChoice = await question('\nChoose admin role:\n1. Admin (standard admin privileges)\n2. Super Admin (full system access)\nChoose (1-2): ');
      
      const role = roleChoice === '2' ? 'super_admin' : 'admin';
      const permissions = [
        'user_management',
        'security_monitoring', 
        'audit_logs',
        'user_unlock'
      ];
      
      if (role === 'super_admin') {
        permissions.push('system_admin', 'data_export', 'system_config');
      }
      
      const confirm = await question(`\n⚠️  Confirm promotion of ${email} to ${role}? (yes/no): `);
      
      if (confirm.toLowerCase() === 'yes') {
        await users.updateOne(
          { _id: user._id },
          {
            $set: {
              role,
              adminPermissions: permissions,
              adminCreatedAt: new Date(),
              adminCreatedBy: 'system',
              updatedAt: new Date()
            }
          }
        );
        
        console.log(`✅ Successfully promoted ${email} to ${role}`);
        console.log(`📋 Granted permissions: ${permissions.join(', ')}`);
      } else {
        console.log('❌ Promotion cancelled');
      }
      
    } else if (action === '2') {
      // List current admins
      const admins = await users.find({
        role: { $in: ['admin', 'super_admin'] }
      }).project({
        email: 1,
        username: 1,
        role: 1,
        adminCreatedAt: 1,
        adminPermissions: 1,
        lastLoginAt: 1
      }).toArray();
      
      if (admins.length === 0) {
        console.log('📭 No admin users found');
      } else {
        console.log(`\n👥 Found ${admins.length} admin user(s):\n`);
        
        admins.forEach((admin, index) => {
          console.log(`${index + 1}. ${admin.email} (@${admin.username})`);
          console.log(`   Role: ${admin.role}`);
          console.log(`   Admin since: ${admin.adminCreatedAt || 'Unknown'}`);
          console.log(`   Last login: ${admin.lastLoginAt || 'Never'}`);
          console.log(`   Permissions: ${(admin.adminPermissions || []).join(', ') || 'Default'}`);
          console.log('');
        });
      }
    } else {
      console.log('❌ Invalid choice');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    rl.close();
  }
}

// Auto-promote if email provided as argument
const emailArg = process.argv[2];
if (emailArg) {
  console.log(`🚀 Quick promotion mode for: ${emailArg}`);
  
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/vault';
  const client = new MongoClient(mongoUri);
  
  client.connect().then(async () => {
    const db = client.db();
    const users = db.collection('users');
    
    const user = await users.findOne({ email: emailArg });
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
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
    
    console.log(`✅ Successfully promoted ${emailArg} to super_admin`);
    await client.close();
  }).catch(console.error);
} else {
  // Interactive mode
  promoteToAdmin().catch(console.error);
}
