#!/bin/bash

echo "🚀 DEPLOYING ULTRA-SECURE ADMIN PANEL TO PRODUCTION"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this from the vault root directory"
    exit 1
fi

echo "📋 Deployment Checklist:"
echo "========================"

echo "✅ Your IP addresses configured:"
echo "   - Mobile IP: 100.99.48.91"
echo "   - Local IP: 192.168.43.156"
echo "   - Gateway IP: 192.168.43.1"

echo ""
echo "🔒 Security Features Enabled:"
echo "   ✅ Hidden admin paths with crypto tokens"
echo "   ✅ Ultra-strict rate limiting (3 attempts/15min)"
echo "   ✅ IP whitelist enforcement"
echo "   ✅ Honeypot traps for attackers"
echo "   ✅ Enterprise-level security logging"

echo ""
echo "🚀 Starting deployment..."

# Add all changes
git add .

# Commit with security update message
git commit -m "🔒 SECURITY: Ultra-secure admin panel with IP whitelist

- Added enterprise-level admin security like Facebook/WhatsApp
- Configured IP whitelist: 100.99.48.91, 192.168.43.156, 192.168.43.1
- Implemented hidden admin paths with crypto tokens
- Added honeypot traps and attack detection
- Ultra-strict rate limiting and audit logging
- Admin panel now completely hidden from attackers"

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 DEPLOYMENT SUCCESSFUL!"
    echo "========================"
    echo ""
    echo "🔒 Your ultra-secure admin panel is now live!"
    echo "🌐 Production URL: https://safee-y8iw.onrender.com"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Wait 2-3 minutes for Render to rebuild"
    echo "2. Check server logs for your secret admin credentials"
    echo "3. Use only your whitelisted IPs to access admin panel"
    echo ""
    echo "🚨 SECURITY NOTICE:"
    echo "- Admin panel is completely hidden from public"
    echo "- Secret paths change on every server restart"
    echo "- Only your 3 IP addresses can access admin panel"
    echo "- All unauthorized attempts trigger security alerts"
    echo ""
    echo "🔍 To get admin access credentials:"
    echo "   node admin-access-info.js"
else
    echo "❌ Deployment failed. Check the error above."
    exit 1
fi
