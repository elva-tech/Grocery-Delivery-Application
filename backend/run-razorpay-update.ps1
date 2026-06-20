$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$env:MONGO_URI = "mongodb+srv://admin:s%24gh85r46@apnakart.pqdchef.mongodb.net/?appName=apnaKart"
$env:RAZORPAY_KEY_ID = "rzp_test_SaHmJpDs42QvIp"
$env:RAZORPAY_KEY_SECRET = "YHBaSBN6vHpzL13SN8zHXNdC"
$env:RAZORPAY_WEBHOOK_SECRET = "your_razorpay_webhook_secret"
$env:MASTER_ENCRYPTION_KEY = "elva-vendor-secrets-change-in-production"

Write-Output "=== Upserting sales ==="
node scripts/upsert-vendor-razorpay.js sales

Write-Output "=== Upserting enandi ==="
node scripts/upsert-vendor-razorpay.js enandi

Write-Output "=== Verification ==="
node -e 'const mongoose=require("mongoose"); mongoose.connect("mongodb+srv://admin:s%24gh85r46@apnakart.pqdchef.mongodb.net/?appName=apnaKart").then(async()=>{ const rows=await mongoose.connection.db.collection("vendors").find({tenantId:{$in:["sales","enandi"]}}).project({tenantId:1,"razorpay.keyId":1,"razorpay.onboardingStatus":1,"razorpay.accountStatus":1}).toArray(); console.log(JSON.stringify(rows,null,2)); await mongoose.disconnect(); }).catch(e=>{console.error(e); process.exit(1);});'
