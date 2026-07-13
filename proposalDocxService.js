const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    HeadingLevel,
    AlignmentType,
    VerticalAlign,
    Header,
    Footer,
    PageNumber,
    ImageRun
} = require('docx');

function numberToTurkishText(num) {
    if (!num || isNaN(num) || num === 0) return 'Sıfır';
    num = Math.floor(num);
    const ones = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
    const tens = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];
    const thousands = ['', 'Bin', 'Milyon', 'Milyar'];
    function convertHundreds(n) {
        let str = '';
        if (n > 99) {
            const h = Math.floor(n / 100);
            str += (h === 1 ? 'Yüz' : ones[h] + ' Yüz') + ' ';
            n = n % 100;
        }
        if (n > 9) {
            str += tens[Math.floor(n / 10)] + ' ';
            n = n % 10;
        }
        if (n > 0) {
            str += ones[n] + ' ';
        }
        return str.trim();
    }
    let result = '';
    let t = 0;
    while (num > 0) {
        const chunk = num % 1000;
        if (chunk > 0) {
            let chunkStr = convertHundreds(chunk);
            if (t === 1 && chunk === 1) chunkStr = 'Bin';
            else if (t > 0) chunkStr += ' ' + thousands[t];
            result = chunkStr + ' ' + result;
        }
        num = Math.floor(num / 1000);
        t++;
    }
    return result.trim();
}

const { generateDrawingSVG } = require('./drawingEngine');

/**
 * Creates a Proposal DOCX buffer.
 * @param {Object} proposalData - Data from the frontend table
 * @param {Object} res - Express response object to send the stream
 */
async function createProposalDOCX(proposalData, res) {
    const { customerName, projectName, date, unitPrices, vatRate, rows, archData } = proposalData;

    // Formatting helpers
    const formatMoney = (val) => val.toLocaleString('tr-TR');
    
    let totBrut = 0, totBodrum = 0, totToplamBrut = 0, totBedel = 0, totBodrumBedel = 0, totToplamInsaat = 0, totDestek = 0, totOdenecek = 0;

    const tableRows = [];

    // Header row
    tableRows.push(new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ text: "Kat / Nitelik", alignment: AlignmentType.CENTER })], shading: { fill: "f3f4f6" }, verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [new Paragraph({ text: "Bölüm No", alignment: AlignmentType.CENTER })], shading: { fill: "f3f4f6" }, verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [new Paragraph({ text: "Brüt Alan (m²)", alignment: AlignmentType.CENTER })], shading: { fill: "f3f4f6" }, verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [new Paragraph({ text: "Sığınak / Teknik Hacimler Payı (m²)", alignment: AlignmentType.CENTER })], shading: { fill: "f3f4f6" }, verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [new Paragraph({ text: "Toplam Brüt Alan (m²)", alignment: AlignmentType.CENTER })], shading: { fill: "f3f4f6" }, verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [new Paragraph({ text: "İnşaat Bedeli (TL)", alignment: AlignmentType.CENTER })], shading: { fill: "f3f4f6" }, verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [new Paragraph({ text: "Sığınak / Teknik Hacimler Bedeli (TL)", alignment: AlignmentType.CENTER })], shading: { fill: "f3f4f6" }, verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [new Paragraph({ text: "Toplam İnşaat Bedeli (TL)", alignment: AlignmentType.CENTER })], shading: { fill: "f3f4f6" }, verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [new Paragraph({ text: "Devlet Desteği (TL)", alignment: AlignmentType.CENTER })], shading: { fill: "f3f4f6" }, verticalAlign: VerticalAlign.CENTER }),
            new TableCell({ children: [new Paragraph({ text: "Ödenecek Tutar (TL)", alignment: AlignmentType.CENTER })], shading: { fill: "f3f4f6" }, verticalAlign: VerticalAlign.CENTER }),
        ],
    }));

    // Data rows
    rows.forEach((row, i) => {
        const toplamBrut = (row.brut || 0) + (row.bodrum || 0);
        const toplamInsaat = (row.bedel || 0) + (row.bodrumBedel || 0);

        tableRows.push(new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ text: row.kat })] }),
                new TableCell({ children: [new Paragraph({ text: row.no.toString(), alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: row.brut.toString(), alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: row.bodrum.toString(), alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: formatMoney(toplamBrut), alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: formatMoney(row.bedel), alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ text: formatMoney(row.bodrumBedel || 0), alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ text: formatMoney(toplamInsaat), alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ text: formatMoney(row.destek), alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ text: formatMoney(row.odenecek), alignment: AlignmentType.RIGHT })] }),
            ],
        }));

        totBrut          += row.brut;
        totBodrum        += row.bodrum;
        totToplamBrut    += toplamBrut;
        totBedel         += row.bedel;
        totBodrumBedel   += (row.bodrumBedel || 0);
        totToplamInsaat  += toplamInsaat;
        totDestek        += row.destek;
        totOdenecek      += row.odenecek;
    });

    // Totals row
    tableRows.push(new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TOPLAM", bold: true })], alignment: AlignmentType.RIGHT })], columnSpan: 2, shading: { fill: "e5e7eb" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(totBrut), bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "e5e7eb" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(totBodrum), bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "e5e7eb" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(totToplamBrut), bold: true })], alignment: AlignmentType.CENTER })], shading: { fill: "e5e7eb" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(totBedel), bold: true })], alignment: AlignmentType.RIGHT })], shading: { fill: "e5e7eb" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(totBodrumBedel), bold: true })], alignment: AlignmentType.RIGHT })], shading: { fill: "e5e7eb" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(totToplamInsaat), bold: true })], alignment: AlignmentType.RIGHT })], shading: { fill: "e5e7eb" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(totDestek), bold: true })], alignment: AlignmentType.RIGHT })], shading: { fill: "e5e7eb" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMoney(totOdenecek), bold: true })], alignment: AlignmentType.RIGHT })], shading: { fill: "e5e7eb" } }),
        ],
    }));

    const paymentTable = new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
    });

    const otoparkBedel = (archData && archData.parkingCount && archData.parkingArea) ? (archData.parkingCount * archData.parkingArea) * (unitPrices ? unitPrices.otopark : 0) : 0;
    const araToplam = totOdenecek + otoparkBedel;

    let vatAmount = 0;
    let vatValText = '';

    if (vatRate === -1) {
        vatValText = 'KDV DAHİL';
    } else {
        vatAmount = araToplam * (vatRate / 100);
        vatValText = `${formatMoney(vatAmount)} TL`;
    }
    const grandTotal = araToplam + vatAmount;

    // PAGE 1: Architectural Drawing (SVG)
    const childrenPage1 = [
        new Paragraph({
            text: "TEKNİK ÇİZİM (MİMARİ KESİT)",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
        })
    ];

    if (archData) {
        const svgStr = generateDrawingSVG(archData);
        // MS Word (özellikle eski sürümleri) SVG'yi doğrudan açmakta sorun yaşayabilir. 
        // Bu yüzden SVG'yi PNG formatına çeviriyoruz.
        const sharp = require('sharp');
        const pngBuffer = await sharp(Buffer.from(svgStr)).png().toBuffer();
        
        // A4 landscape has roughly 800-900 px width. We'll set width 700 and maintain aspect ratio.
        childrenPage1.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new ImageRun({
                        data: pngBuffer,
                        transformation: { width: 700, height: 450 }
                    })
                ]
            })
        );
    }

    // PAGE 2: Area Analysis and Payment Table
    const childrenPage2 = [
        new Paragraph({ text: "", pageBreakBefore: true }),
        new Paragraph({
            text: "FİYAT TEKLİFİ - ALAN ANALİZİ VE ÖDEME TABLOSU",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
        }),
        new Paragraph({
            children: [
                new TextRun({ text: "Müşteri / Firma: ", bold: true }),
                new TextRun(customerName || ""),
            ]
        }),
        new Paragraph({
            children: [
                new TextRun({ text: "Proje Adı: ", bold: true }),
                new TextRun(projectName || ""),
            ]
        }),
        new Paragraph({
            children: [
                new TextRun({ text: "Tarih: ", bold: true }),
                new TextRun(new Date(date).toLocaleDateString('tr-TR')),
            ],
            spacing: { after: 200 }
        }),
        
        paymentTable,

        new Paragraph({ text: "" }),
        new Paragraph({
            children: [
                new TextRun({ text: "Bölümler Toplamı: ", bold: true }),
                new TextRun(`${formatMoney(totOdenecek)} TL`)
            ],
            alignment: AlignmentType.RIGHT
        }),
        new Paragraph({
            children: [
                new TextRun({ text: "Sığınak/Teknik Hacim Bedeli: ", bold: true }),
                new TextRun(`${formatMoney(totBodrumBedel)} TL`)
            ],
            alignment: AlignmentType.RIGHT
        }),
        new Paragraph({
            children: [
                new TextRun({ text: "Otopark Bedeli: ", bold: true }),
                new TextRun(`${formatMoney(otoparkBedel)} TL`)
            ],
            alignment: AlignmentType.RIGHT
        }),
        new Paragraph({
            children: [
                new TextRun({ text: "Ara Toplam (Ödenecek): ", bold: true }),
                new TextRun(`${formatMoney(araToplam)} TL`)
            ],
            alignment: AlignmentType.RIGHT
        }),
        new Paragraph({
            children: [
                new TextRun({ text: vatRate === -1 ? "KDV:" : `KDV (%${vatRate}): `, bold: true }),
                new TextRun(vatValText)
            ],
            alignment: AlignmentType.RIGHT
        }),
        new Paragraph({
            children: [
                new TextRun({ text: "GENEL TOPLAM: ", bold: true, size: 28 }),
                new TextRun({ text: `${formatMoney(grandTotal)} TL`, bold: true, size: 28, color: "e63946" })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 200 }
        }),
    ];

    const doc = new Document({
        creator: "Kılıç İnşaat",
        title: "Mimari Kesit ve Teklif",
        description: "Mimari Çizim ve Ödeme Tablosu",
        sections: [
            {
                properties: {
                    page: {
                        size: {
                            orientation: "landscape"
                        },
                        margin: {
                            top: 700,
                            right: 700,
                            bottom: 700,
                            left: 700,
                        },
                    },
                },
                children: [
                    ...childrenPage1,
                    ...childrenPage2
                ],
            },
        ],
    });

    try {
        const b64string = await Packer.toBase64String(doc);
        const buffer = Buffer.from(b64string, 'base64');
        res.end(buffer);
    } catch (err) {
        console.error("Error creating DOCX:", err);
        res.status(500).json({ error: 'Sunucu hatasi (Internal Server Error)' });
    }
}

module.exports = {
    createProposalDOCX
};
