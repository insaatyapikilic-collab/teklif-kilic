/**
 * @file server.js
 * @description Express.js backend server handling the API requests for drawing generation.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { generateDrawingSVG } = require('./drawingEngine');
const { createPDF } = require('./pdfService');

const app = express();
const PORT = process.env.PORT || 3000;

// Subdomain dinlemesi veya spesifik origin'ler için CORS ayarı
const corsOptions = {
    origin: '*', // Production'da 'http://cizim.domain.com' olarak güncellenmelidir.
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Frontend'in canlı önizleme için drawingEngine'e erişebilmesi için:
app.get('/drawingEngine.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'drawingEngine.js'));
});

// API Endpoint: Çizim Oluştur ve PDF İndir
app.post('/api/generate-pdf', (req, res) => {
    try {
        const { roofType, floors, basements, roof, parkingCount, parkingArea, isDuplex } = req.body;

        // Validasyon (Validation)
        if (!roofType || !floors || !Array.isArray(floors)) {
            return res.status(400).json({ error: 'Eksik parametreler (Missing parameters)' });
        }

        const params = {
            roofType,
            floors: floors,
            basements: basements || [],
            roof: roof || { areas: [] },
            parkingCount: parseInt(parkingCount || 0, 10),
            parkingArea: parseFloat(parkingArea || 100),
            isDuplex: !!isDuplex
        };

        // 1. SVG Üretimi
        const svgString = generateDrawingSVG(params);

        // 2. PDF İndirme Başlıkları (Headers for Download)
        const filename = `cizim_${uuidv4().substring(0,8)}.pdf`;
        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');

        // 3. PDF'i Doğrudan Response (Stream) Olarak Gönder
        createPDF(svgString, params, res);

    } catch (error) {
        console.error('PDF uretimi sirasinda hata (Error generating PDF):', error);
        res.status(500).json({ error: 'Sunucu hatasi (Internal Server Error)' });
    }
});

const { createProposalPDF } = require('./proposalPdfService');
const { createProposalDOCX } = require('./proposalDocxService');

// API Endpoint: Teklif PDF İndir
app.post('/api/generate-proposal', (req, res) => {
    try {
        const proposalData = req.body;
        
        if (!proposalData || !proposalData.rows || !Array.isArray(proposalData.rows)) {
            return res.status(400).json({ error: 'Eksik veya hatali veri (Missing or invalid data)' });
        }

        let projectName = proposalData.projectName || `teklif_${uuidv4().substring(0,8)}`;
        // Dosya adı için geçersiz olabilecek karakterleri temizle ve boşlukları alt çizgi yap
        projectName = projectName.replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_');
        
        const filename = `${projectName}.pdf`;
        // Türkçe karakterlerin dosya adında doğru görünmesi için UTF-8 formatında başlık ayarlanır
        res.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Content-type', 'application/pdf');

        createProposalPDF(proposalData, res);

    } catch (error) {
        console.error('Teklif uretimi sirasinda hata:', error);
        res.status(500).json({ error: 'Sunucu hatasi (Internal Server Error)' });
    }
});

// API Endpoint: Teklif DOCX İndir
app.post('/api/generate-proposal-docx', async (req, res) => {
    try {
        const proposalData = req.body;
        
        if (!proposalData || !proposalData.rows || !Array.isArray(proposalData.rows)) {
            return res.status(400).json({ error: 'Eksik veya hatali veri (Missing or invalid data)' });
        }

        let projectName = proposalData.projectName || `teklif_${uuidv4().substring(0,8)}`;
        projectName = projectName.replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_');
        
        const filename = `${projectName}.docx`;
        res.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

        await createProposalDOCX(proposalData, res);

    } catch (error) {
        console.error('Word uretimi sirasinda hata:', error);
        res.status(500).json({ error: 'Sunucu hatasi (Internal Server Error)' });
    }
});

app.listen(PORT, () => {
    console.log(`Cizim servisi calisiyor (Drawing service running on port ${PORT})`);
    
    // Uygulama exe olarak açıldığında tarayıcıyı otomatik başlat
    const { exec } = require('child_process');
    const os = require('os');
    if (os.platform() === 'win32') {
        exec(`start http://localhost:${PORT}`);
    }
});
