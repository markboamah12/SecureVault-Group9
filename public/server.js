require('dotenv').config(); 
const express = require('express'); 
const mysql = require('mysql2'); 
const multer = require('multer'); 
const multerS3 = require('multer-s3'); 
const { S3Client } = require('@aws-sdk/client-s3'); 
const path = require('path'); 

const app = express(); 
const port = process.env.PORT || 80; 

// Serve the frosted glass frontend 
app.use(express.static(path.join(__dirname, 'public'))); 

// Database Connection to Amazon RDS 
const db = mysql.createConnection({ 
    host: process.env.DB_HOST, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASS || process.env.DB_PASSWORD, 
    database: process.env.DB_NAME 
}); 

db.connect((err) => { 
    if (err) { 
        console.error('Database connection failed: ' + err.stack); 
        return; 
    } 
    console.log('Successfully connected to Amazon RDS MySQL Database.'); 
}); 

// AWS S3 Configuration via IAM Role 
const s3 = new S3Client({ region: 'eu-north-1' }); 

// Multer-S3 Direct Upload Routing (Zero Local Storage) 
const upload = multer({ 
    storage: multerS3({ 
        s3: s3, 
        bucket: process.env.S3_BUCKET || process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME, 
        metadata: function (req, file, cb) { 
            cb(null, { fieldName: file.fieldname }); 
        }, 
        key: function (req, file, cb) { 
            cb(null, Date.now().toString() + '-' + file.originalname); 
        } 
    }) 
}); 

// Reusable CSS string for backend success/error pages to maintain the glass UI 
const glassStyle = ` 
    <style> 
        body { 
            margin: 0; 
            padding: 0; 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: url('https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=2070&auto=format&fit=crop') no-repeat center center fixed; 
            background-size: cover; 
            height: 100vh; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            color: #ffffff; 
            text-align: center;
        } 
        .glass-panel { 
            background: rgba(15, 23, 42, 0.75); 
            backdrop-filter: blur(16px); 
            -webkit-backdrop-filter: blur(16px); 
            border: 1px solid rgba(255, 255, 255, 0.12); 
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6); 
            border-radius: 20px; 
            padding: 50px 40px; 
            width: 100%; 
            max-width: 450px; 
            margin: 0 auto;
        }
        h2 { margin-top: 0; color: #4ade80; font-size: 26px; margin-bottom: 10px; }
        p { margin-bottom: 25px; color: #cbd5e1; }
        .data-box { background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: left; word-wrap: break-word; font-size: 14px; } 
        .data-box p { margin: 8px 0; color: #e2e8f0; }
        a { color: #2dd4bf; text-decoration: none; font-weight: bold; } 
        a:hover { text-decoration: underline; }
        .btn-return { display: inline-block; margin-top: 20px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; transition: 0.3s; } 
        .btn-return:hover { background: rgba(255,255,255,0.25); } 
    </style> 
`; 

// Upload Endpoint 
app.post('/upload', upload.single('secureFile'), (req, res) => { 
    if (!req.file) { 
        return res.status(400).send(`<html><head>${glassStyle}</head><body><div class="glass-panel"><h2>Error</h2><p>No file detected.</p><a href="/" class="btn-return">Try Again</a></div></body></html>`); 
    } 

    const fileUrl = req.file.location; 
    const fileName = req.file.originalname; 

    // Save metadata to RDS 
    const sql = "INSERT INTO Documents (user_id, file_name, s3_url) VALUES (1, ?, ?)"; 
    db.query(sql, [fileName, fileUrl], (err, result) => { 
        if (err) { 
            console.error(err); 
            return res.status(500).send(`<html><head>${glassStyle}</head><body><div class="glass-panel"><h2>Database Error</h2><p>Failed to index document.</p><a href="/" class="btn-return">Return</a></div></body></html>`); 
        } 
        
        // Serve a beautifully styled success response 
        res.send(` 
            <!DOCTYPE html> 
            <html> 
            <head> 
                <title>Upload Success</title> 
                ${glassStyle} 
            </head> 
            <body> 
                <div class="glass-panel"> 
                    <h2>✓ Secure Upload Complete</h2> 
                    <p>Your file has been encrypted and routed directly to S3.</p> 
                    <div class="data-box"> 
                        <p><strong>File:</strong> ${fileName}</p> 
                        <p><strong>Location:</strong> <br><a href="${fileUrl}" target="_blank">View Raw S3 Object</a></p> 
                    </div> 
                    <a href="/" class="btn-return">Upload Another Document</a> 
                </div> 
            </body> 
            </html> 
        `); 
    }); 
}); 

app.listen(port, () => { 
    console.log(`SecureVault App active and listening on HTTP Port ${port}`); 
});