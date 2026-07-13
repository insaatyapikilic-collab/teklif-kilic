/**
 * @file pdfService.js
 * @description Generates a PDF containing an architectural title block and the SVG drawing.
 */

const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * Creates a PDF stream with the SVG drawing and a title block.
 * @param {string} svgString - The SVG content
 * @param {Object} params - Building parameters for the title block
 * @param {stream.Writable} outputStream - The stream to write the PDF to
 */
function createPDF(svgString, params, outputStream) {
    // A4 Portrait
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, left: 50, right: 50, bottom: 30 } });
    
    doc.pipe(outputStream);

    const { width, height } = doc.page;

    // --- SVG Çizimini Ekleme ---
    // SVG'yi antet çizimlerinden ÖNCE ekliyoruz ki PDFKit sayfa sonuna geldiğini zannedip yeni sayfa açmasın.
    const svgOptions = {
        x: 50,
        y: 60,
        width: width - 100, // Çerçeve içine sığdır (Fit into frame width)
        height: height - 190, // Antet kısmına taşmaması için yüksekliği kısıtla
        assumePt: true,
        preserveAspectRatio: 'xMidYMid meet'
    };
    SVGtoPDF(doc, svgString, svgOptions.x, svgOptions.y, svgOptions);

    // --- Antet (Title Block) Çizimi ---
    doc.rect(50, 50, width - 100, height - 100).stroke(); // Dış Çerçeve
    doc.rect(50, height - 120, width - 100, 70).stroke(); // Alt Antet Kutusu

    // Antet İçi Çizgiler
    doc.moveTo(width / 2, height - 120).lineTo(width / 2, height - 50).stroke();

    // Logo Ekleme (Eğer logo.png varsa)
    const logoPath = path.join(__dirname, 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 60, height - 115, { fit: [90, 60] });
    }

    // Sol Taraf (Proje Bilgileri)
    doc.font('Helvetica-Bold').fontSize(12).text('MIMARI KESIT / GORUNUS', 160, height - 110, { lineBreak: false });
    doc.font('Helvetica').fontSize(10);
    doc.text(`Cizen: KILIC INSAAT`, 160, height - 90, { lineBreak: false });
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 160, height - 75, { lineBreak: false });

    // Sağ Taraf (Parametreler)
    let totalArea = 0;
    if (params.floors) totalArea += params.floors.reduce((sum, f) => sum + f.areas.reduce((a,b)=>a+b, 0), 0);
    if (params.basements) totalArea += params.basements.reduce((sum, b) => sum + b.areas.reduce((a,b)=>a+b, 0), 0);
    if (params.roof && params.roof.areas) totalArea += params.roof.areas.reduce((a,b)=>a+b, 0);

    const floorCount = params.floors ? params.floors.length : 0;
    const basementCount = params.basements ? params.basements.length : 0;
    const parkingCount = params.parkingCount || 0;

    const duplexText = params.isDuplex ? 'Evet' : 'Hayir';
    doc.text(`Kati: ${floorCount} | Bodrum: ${basementCount} | Otopark: ${parkingCount} (${params.parkingArea || 100} m2)`, width / 2 + 10, height - 110, { lineBreak: false });
    doc.text(`Cati Tipi: ${params.roofType} | Dubleks: ${duplexText}`, width / 2 + 10, height - 90, { lineBreak: false });
    doc.text(`Toplam Alan: ${totalArea} m2`, width / 2 + 10, height - 75, { lineBreak: false });
    doc.font('Helvetica-Bold').text(`Olcek: NTS`, width / 2 + 10, height - 60, { lineBreak: false });

    doc.end();
}

module.exports = {
    createPDF
};
