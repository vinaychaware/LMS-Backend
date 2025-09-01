#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up EduSphere LMS Backend with PostgreSQL...\n');

// Check Node.js version
try {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 16) {
    console.error('❌ Node.js version 16 or higher is required');
    console.error(`Current version: ${nodeVersion}`);
    process.exit(1);
  }
  
  console.log(`✅ Node.js version: ${nodeVersion}`);
} catch (error) {
  console.error('❌ Error checking Node.js version:', error.message);
  process.exit(1);
}

// Install dependencies
console.log('\n📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully');
} catch (error) {
  console.error('❌ Error installing dependencies:', error.message);
  process.exit(1);
}

// Create .env file
console.log('\n🔧 Creating environment configuration...');
try {
  const envExamplePath = path.join(__dirname, '..', 'env.example');
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envExamplePath)) {
    console.error('❌ env.example file not found');
    process.exit(1);
  }
  
  if (!fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envExamplePath, 'utf8');
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created from env.example');
    console.log('⚠️  Please update the .env file with your actual configuration values');
  } else {
    console.log('✅ .env file already exists');
  }
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
  process.exit(1);
}

// Create uploads directory
console.log('\n📁 Creating uploads directory...');
try {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Uploads directory created');
  } else {
    console.log('✅ Uploads directory already exists');
  }
} catch (error) {
  console.error('❌ Error creating uploads directory:', error.message);
  process.exit(1);
}

// Create logs directory
console.log('\n📝 Creating logs directory...');
try {
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('✅ Logs directory created');
  } else {
    console.log('✅ Logs directory already exists');
  }
} catch (error) {
  console.error('❌ Error creating logs directory:', error.message);
  process.exit(1);
}

// Check PostgreSQL connection
console.log('\n🗄️  Checking PostgreSQL connection...');
console.log('⚠️  Please ensure PostgreSQL is running and accessible');
console.log('⚠️  Update your .env file with correct database credentials');

// Display next steps
console.log('\n🎯 Next Steps:');
console.log('1. Install PostgreSQL if not already installed');
console.log('2. Create a database named "edusphere_lms"');
console.log('3. Update the .env file with your database credentials');
console.log('4. Run "npm run dev" to start the development server');
console.log('5. Run "npm run db:migrate" to create database tables');

// Check for missing environment variables
console.log('\n🔍 Checking required environment variables...');
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const requiredVars = [
      'DB_HOST',
      'DB_PORT', 
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD',
      'JWT_SECRET'
    ];
    
    const missingVars = requiredVars.filter(varName => {
      return !envContent.includes(`${varName}=`) || 
             envContent.includes(`${varName}=your_`) ||
             envContent.includes(`${varName}=password`);
    });
    
    if (missingVars.length > 0) {
      console.log('⚠️  Missing or default environment variables:');
      missingVars.forEach(varName => {
        console.log(`   - ${varName}`);
      });
      console.log('⚠️  Please update these in your .env file');
    } else {
      console.log('✅ All required environment variables are configured');
    }
  }
} catch (error) {
  console.error('❌ Error checking environment variables:', error.message);
}

console.log('\n🚀 Happy coding!');
console.log('📚 For more information, check the README.md file');
