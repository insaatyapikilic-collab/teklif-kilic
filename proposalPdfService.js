/**
 * @file proposalPdfService.js
 * @description Generates a landscape A4 Proposal PDF with the Area Analysis and Payment Table.
 */

const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');
const path = require('path');
const fs = require('fs');
const { generateDrawingSVG } = require('./drawingEngine');

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

/**
 * Creates a Proposal PDF stream.
 * @param {Object} proposalData - Data from the frontend table
 * @param {stream.Writable} outputStream - The stream to write the PDF to
 */
function createProposalPDF(proposalData, outputStream) {
    const { customerName, projectName, date, unitPrices, vatRate, rows, contractInfo, archData } = proposalData;

    // A4 Landscape
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: 40, right: 40 }, bufferPages: true });
    doc.pipe(outputStream);

    const fontRegular = path.join(__dirname, 'public', 'Roboto-Regular.ttf');
    const fontBold = path.join(__dirname, 'public', 'Roboto-Bold.ttf');

    if (fs.existsSync(fontRegular) && fs.existsSync(fontBold)) {
        doc.registerFont('Regular', fontRegular);
        doc.registerFont('Bold', fontBold);
    } else {
        doc.registerFont('Regular', 'Helvetica');
        doc.registerFont('Bold', 'Helvetica-Bold');
    }

    const { width, height } = doc.page;

    // KAPAK SAYFASI (Cover Page)
    const coverPath = path.join(__dirname, 'public', 'cover.png');
    if (fs.existsSync(coverPath)) {
        // Görseli tüm sayfayı sıfır boşluk kalacak şekilde kaplamasını sağla (aspect-ratio koruyarak taşan kısmı gizler)
        doc.image(coverPath, 0, 0, { cover: [width, height], align: 'center', valign: 'center' });
        
        // Logonun sol tarafı (Alt Sol) için Proje Adı ortalanarak yazılıyor
        // İsim çok uzunsa sığması için font boyutunu dinamik ayarlayalım veya sabit büyük bir kutu verelim
        const nameLength = projectName.length;
        const dynamicFontSize = nameLength > 40 ? 24 : (nameLength > 20 ? 30 : 38);
        
        doc.font('Bold').fontSize(dynamicFontSize).fill('#ffffff'); // Beyaz renk
        // Yüksekliği ayarlayalım
        doc.text(projectName, 20, height - 160, { width: width / 2.1, align: 'center' });
        
        // Metin rengini sıfırla
        doc.fill('#000000');
    }

    // 2. SAYFA: TEKLİF MADDELERİ
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    const cWidth = doc.page.width - 120;
    
    doc.font('Bold').fontSize(18).text('TEKLİF', { align: 'center' });
    doc.moveDown(2);

    doc.font('Regular').fontSize(12);

    // Madde 1
    const ilce = contractInfo?.ilce || '.......';
    const ada = contractInfo?.ada || '.......';
    const parsel = contractInfo?.parsel || '.......';
    doc.text(`•  ${ilce} ilçesi, ${ada} ada, ${parsel} parselde bulunan Apartmanın inşaat işlerine dair ödeme taahhüt karşılığı tekliftir.`, { width: cWidth, align: 'justify', lineGap: 4 });
    doc.moveDown(1);

    // Madde 2
    doc.text(`•  Fiyat teklifimiz firmamız tarafından hazırlanan ekteki teknik şartnameye (1.sınıf malzeme ve 1.sınıf işçilik) göre oluşturulmuştur.`, { width: cWidth, align: 'justify', lineGap: 4 });
    doc.moveDown(1);

    // Madde 3
    const insaatSure = contractInfo?.insaatSure || '.......';
    const ruhsatSure = contractInfo?.ruhsatSure || '.......';
    const teslimTuru = contractInfo?.teslimTuru || 'ANAHTAR TESLİM';
    const cezaNum = parseFloat(contractInfo?.ceza) || 0;
    const cezaText = cezaNum > 0 ? numberToTurkishText(cezaNum) : '..............';
    const cezaDisplay = cezaNum > 0 ? cezaNum.toLocaleString('tr-TR') : '.......';
    
    const m3 = `•  Firmamız; yapı ruhsatının alınmasından itibaren ${insaatSure} ay içerisinde sözleşme yükümlülüklerini yerine getirerek inşaatı ${teslimTuru} olarak bitirerek kat maliklerine teslim etmeyi taahhüt eder. Yapı ruhsatına müracaat edildiği tarihten itibaren ${ruhsatSure} ay içerisinde alınacaktır. Belediyeden kaynaklı gecikme olması durumunda, geçen süre ruhsat süresine eklenecektir. İnşaatın anahtar teslim tamamlanmasından itibaren 3 (üç) ay içerisinde yapı kullanma izin belgesini (iskan) alacaktır. Binanın müteahhitten kaynaklanan gecikme olması durumunda, kat maliklerine geçen her ay için ${cezaDisplay}-TL (${cezaText} Türklirası) kira bedeli ödeyecektir.`;
    doc.text(m3, { width: cWidth, align: 'justify', lineGap: 4 });
    doc.moveDown(1);

    // Madde 4 (Dinamik Bina Bilgisi)
    let bB = [];
    let totApt = 0;
    if (archData) {
        if (archData.basements.length > 0) bB.push(`${archData.basements.length} bodrum`);
        if (archData.floors.length > 0) {
            bB.push('zemin');
            if (archData.floors.length > 1) {
                let norm = Array.from({length: archData.floors.length - 1}, (_, i) => i + 1).join('. ');
                bB.push(`${norm}. normal katlar`);
            }
        }
        if (archData.roof.aptCount > 0) bB.push('çatı katı');
        
        totApt = archData.floors.reduce((sum, f) => sum + f.areas.length, 0) + 
                 archData.basements.reduce((sum, b) => sum + b.areas.length, 0) + 
                 archData.roof.aptCount;
    }
    
    const buildDesc = bB.length > 0 ? bB.join(', ') : 'belirtilen katlar';
    const aptCountDesc = totApt > 0 ? totApt : '.......';
    doc.text(`•  Firmamız, ${buildDesc} olmak üzere toplam ${aptCountDesc} adet bağımsız bölümü kat maliklerine teslim edecektir.`, { width: cWidth, align: 'justify', lineGap: 4 });
    doc.moveDown(1);

    // Madde 5
    if (archData && archData.basements.length > 0) {
        doc.text(`•  Bodrum katta tüm bağımsız bölümlerin ortak kullanım alanı (sığınak, teknik hacimler) olacaktır. Bodrum kat imar planının müsaade ettiği maksimum alanda imal edilecektir.`, { width: cWidth, align: 'justify', lineGap: 4 });
        doc.moveDown(1);
    }

    // Sabit Maddeler
    doc.text(`•  Ekte ödeme tablosunda bağımsız bölüm başına düşen ödeme tutarları, bağımsız bölümlerin yeni alan analizleri bulunmaktadır.`, { width: cWidth, align: 'justify', lineGap: 4 });
    doc.moveDown(1);
    doc.text(`•  Her bağımsız bölümün ödemesi gereken tutar belediyece onaylanacak mimari projedeki brüt metrekare hesaplanarak kesinleşir.`, { width: cWidth, align: 'justify', lineGap: 4 });

    // 3. SAYFA: GİDER VE MASRAFLAR
    // Sığması için alt ve üst boşlukları 40'a indirdik
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: 60, right: 60 } });
    
    doc.font('Bold').fontSize(14).text('GİDER VE MASRAFLAR', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).text('•  MÜTEAHHİT yönünden;', { underline: true });
    doc.moveDown(0.5);

    // Tüm maddelerin tek sayfaya tam ve büyük sığması için font 10.5, lineGap 2.5 ve moveDown 0.4 yapıldı
    doc.font('Regular').fontSize(10.5);
    
    const giderMaddeleri = [
        "1.  Bu sözleşmenin akdine ilişkin (noter, vekalet ve tapu) tüm vergi, resim, damga, harç ve masrafları,",
        "2.  Sözleşmenin imzalanması sonrasında tapuya şerhi için gerekli bilumum masraflar ile vergi ve harçların tamamı,",
        "3.  İnşaat ruhsatı ve yapı izin belgesi ile ilgili harç ve masraflar,",
        "4.  Kat irtifakının kurulması için noterde ve tapuda ödenecek harç ve vergiler,",
        "5.  İnşaatta alınacak koruma ve emniyet tedbirlerinin gerektirdiği masraflar,",
        "6.  Plan, proje, etüt, danışmanlık, mimarlık ve mühendislik giderleri,",
        "7.  Çap, imar durumu, röperli kroki, cins tashihi, yola terk vs. işlemleri ile ilgili yapılacak tüm harcamalar ve harçlar,",
        "8.  Yapı Denetimi Hakkında mevzuat uyarınca yapılacak her türlü yapı denetimi ödemeleri,",
        "9.  Sözleşmenin uygulanmasından tahakkuk edecek KDV'ler,",
        "10. Alt taşeronlarla ilgili her türlü işçilik ücreti, vergi, sosyal sigortalar primi, taşeronun sebebiyet verdiği idari, cezai ve hukuki sorumluluğunu gerektirecek masraflar,",
        "11. Arsa ve yeni binanın inşaat işi için bu Sözleşme kapsamında yapılacak her çeşit harcama ve masraflar, malzeme, işte kullanılan ekipman, teçhizat, benzeri alet ve edevata ait muhafaza ve kira bedelleri, inşaat süresinde hangi isim altında olursa olsun nakliye, boşaltma, indirme bedelleri, işçilik ücretleri,",
        "12. Su ve elektrik giderleri ile su, elektrik, doğalgaz idarelerine ödenecek sözleşme ücretleri ve elektrik, su, doğalgaz, kablolu TV, internet ve telefon tesisatlarının daire içlerinde ve bina içinde tamamlama (abonman ücretleri Arsa Sahipleri'ne ait olmak üzere) giderleri,",
        "13. Tüm hafriyat masrafları, arsada mevcut binaların yıkım giderleri,",
        "14. İnşaatla ilgili diğer tüm vergi resim ve harçlar ve harcamalar ve benzeri masraflar ve binanın anahtar teslim şekilde hazır hale getirilmesine kadar her türlü giderler MÜTEAHHİT'e aittir.",
        "15. MÜTEAHHİT'in yukarıda kendisine ait olan masrafları yapmamasından dolayı Arsa Sahiplerinin zarar görmesi durumunda, müteahhit bu zararları karşılamak zorundadır."
    ];

    giderMaddeleri.forEach(madde => {
        doc.text(madde, { width: cWidth, align: 'justify', lineGap: 2.5 });
    });

    // 4. SAYFA: ARSA SAHİPLERİ YÖNÜNDEN GİDERLER
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: 60, right: 60 } });
    
    doc.font('Bold').fontSize(14).text('GİDER VE MASRAFLAR', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).text('•  Arsa Sahipleri yönünden;', { underline: true });
    doc.moveDown(0.5);

    doc.font('Regular').fontSize(10.5);
    
    const arsaMaddeleri = [
        "1.  Arsa Sahipleri sözleşme süresince parsele ilişkin tapu kaydını ve kat irtifakının kurulup MÜTEAHHİT'e devirler yapılıncaya kadar her türlü takyidattan ari tutmakla mükelleftirler.",
        "2.  İş bu sözleşmenin imzalanmasından öncesine ait varsa Bahçelievler Belediyesinin tahakkuk ettirdiği emlak vergisi ve sair benzeri vergi ve cezaları, tapunun üzerinde ipotek veya şerh varsa bunların kaldırılmasıyla ilgili masraflar;",
        "3.  İş bu Sözleşme süresince tahakkuk edecek emlak ve arsa vergileri,",
        "4.  Arsa'ya dair komşu parsel yada ilgili belediyeden satın alma çıkması durumunda, satın alma bedelleri arsa sahipleri tarafından yatırılacaktır,",
        "5.  Kendi adına kayıtlı bağımsız bölümlerin satışı sebebiyle ortaya çıkacak tapu harç ve giderleri ile doğacak vergiler ile 3. şahıslar ile Arsa Sahipleri arasındaki tapu masraf ve harçları, kendi adlarına çıkan arsa vergisi ödemeleri arsa sahiplerine aittir.",
        "6.  Elektrik su doğalgaz gibi her türlü abonelikler arsa sahiplerine aittir.",
        "7.  Arsa sahipleri inşaat esnasında veya daha sonrasında daireler içerisinde projeye aykırı olmayan kişiye özel tadilat ve değişiklik istemeleri durumunda MÜTEAHHİT'ten yazılı izin almaları gerekmektedir. Kişiye özel tadilat ve değişiklikleri MÜTEAHHİT'ten talep etmeleri durumunda ücreti konuşularak MÜTEAHHİT tarafından yaptırılacaktır."
    ];

    arsaMaddeleri.forEach(madde => {
        doc.text(madde, { width: cWidth, align: 'justify', lineGap: 2.5 });
        doc.moveDown(0.4);
    });

    // 5. SAYFA: ÖDEME ŞARTLARI
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    
    doc.font('Bold').fontSize(16).text('ÖDEME ŞARTLARI', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(12).text('YAPIM BEDELİ ÖDEMESİ', { align: 'center' });
    doc.moveDown(1.5);

    doc.font('Regular').fontSize(11.5);

    const payInfo = proposalData.paymentInfo || {};
    const tSayisi = parseFloat(payInfo.taksitSayisi) || 6;
    const tSayisiText = numberToTurkishText(tSayisi).toLowerCase('tr-TR');
    
    const kampanya = payInfo.kampanyaTuru || 'Yarısı Bizden';
    
    const ilkGun = parseFloat(payInfo.ilkTaksitGun) || 3;
    const ilkGunText = numberToTurkishText(ilkGun).toLowerCase('tr-TR');
    
    const hafta = payInfo.taksitHaftasi || 'ilk';

    doc.text('•  Arsa sahipleri, ödeme tablosunda belirtilen bağımsız bölümüne isabet eden YAPIM BEDELİ’ni noter sözleşmesi imzalandığı tarihten itibaren', { width: cWidth, align: 'justify', lineGap: 4 });
    doc.moveDown(0.5);
    
    doc.text(`•  ${tSayisi} (${tSayisiText}) eşit taksit ile ödeyecektir.`, { width: cWidth, align: 'justify', lineGap: 4 });
    doc.moveDown(0.5);

    doc.text(`•  Bu projede ${kampanya} kampanyasından faydalandırılacaktır.`, { width: cWidth, align: 'justify', lineGap: 4 });
    doc.moveDown(0.5);

    doc.text(`•  Noter sözleşmesinden itibaren ödenecek ilk taksit ${ilkGun} (${ilkGunText}) iş günü içerisinde ödenecektir.`, { width: cWidth, align: 'justify', lineGap: 4 });
    doc.moveDown(0.5);

    if (hafta === 'ödemesiz') {
        doc.text(`•  Kalan taksitler için ödemesiz dönem uygulanacaktır.`, { width: cWidth, align: 'justify', lineGap: 4 });
    } else {
        doc.text(`•  Kalan taksitler her ayın ${hafta} haftasında 3 (üç) iş günü içerisinde nakden yükleniciye ödenecektir.`, { width: cWidth, align: 'justify', lineGap: 4 });
    }
    doc.moveDown(3);

    doc.font('Bold').fontSize(12).text('Teklifimizi uygun bulacağınızı ümit ederiz. Saygılarımızla...', { width: cWidth, align: 'center' });

    let drawingPageIndex = -1;
    // TEKNİK ÇİZİM SAYFASI (SVG)
    if (proposalData.archData) {
        doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
        const range = doc.bufferedPageRange();
        drawingPageIndex = range.count - 1;
        doc.font('Bold').fontSize(16).fill('#000000');
        doc.text('TEKNİK ÇİZİM (MİMARİ KESİT)', 40, 40, { align: 'center' });
        
        const svgStr = generateDrawingSVG(proposalData.archData);
        // SVG'yi sayfaya çiz
        SVGtoPDF(doc, svgStr, 40, 70, { 
            width: width - 80, 
            height: height - 110, 
            preserveAspectRatio: 'xMidYMid meet',
            fontCallback: function(family, bold, italic, fontOptions) {
                if (family.toLowerCase().includes('bold') || bold) return 'Bold';
                return 'Regular';
            }
        });
    }

    // TABLO SAYFASI
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: 40, right: 40 } });

    // Logo Ekleme (Eğer logo.png varsa)
    const logoPath = path.join(__dirname, 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 40, 40, { fit: [120, 60] });
    }

    // Firma Bilgileri (Sağ üst)
    doc.font('Bold').fontSize(12).text('KILIÇ İNŞAAT', width - 200, 40, { align: 'right' });
    doc.font('Regular').fontSize(10);
    doc.text('Müteahhitlik ve Mühendislik Hizm.', width - 200, 55, { align: 'right' });

    // Başlık
    doc.font('Bold').fontSize(16);
    doc.text('FİYAT TEKLİFİ', 40, 110, { align: 'center' });
    doc.fontSize(12).text('ALAN ANALİZİ VE ÖDEME TABLOSU', 40, 130, { align: 'center' });

    // Müşteri / Proje Bilgileri
    doc.font('Bold').fontSize(10).text('Müşteri / Firma:', 40, 170);
    doc.font('Regular').text(customerName, 130, 170);
    
    doc.font('Bold').text('Proje Adı:', 40, 190);
    doc.font('Regular').text(projectName, 130, 190);
    
    doc.font('Bold').text('Tarih:', width - 150, 170);
    doc.font('Regular').text(new Date(date).toLocaleDateString('tr-TR'), width - 100, 170);
    
    doc.font('Bold').fontSize(8);
    doc.text('Birim Fiyatlar (TL/m²):', width - 250, 185);
    doc.font('Regular');
    if (unitPrices) {
        doc.text(`Daire: ${unitPrices.daire.toLocaleString('tr-TR')}  |  Dükkan: ${unitPrices.dukkan.toLocaleString('tr-TR')}`, width - 250, 197);
        doc.text(`Bodrum/Sığınak: ${unitPrices.bodrum.toLocaleString('tr-TR')}  |  Otopark: ${unitPrices.otopark.toLocaleString('tr-TR')}`, width - 250, 209);
    }

    // Tablo Çizimi
    const startY = 230;
    let currentY = startY;
    const rowHeight = 25;

    // Sütun Genişlikleri ve X Koordinatları (Toplam Genişlik: width - 80)
    // A4 Landscape Width = 841.89
    // Kullanılabilir alan = 841.89 - 80 = 761.89
    // 10 sütun: 95+38+38+80+62+70+85+70+70+83 = 691 (sağ kenarda 40 boşluk)
    const cols = [
        { title: 'Kat/Nitelik',                                           x: 40,  w: 95,  align: 'left'   },
        { title: 'Bölüm No',                                               x: 135, w: 38,  align: 'center' },
        { title: 'Brüt (m²)',                                               x: 173, w: 38,  align: 'center' },
        { title: 'Sığınak ve Teknik Hacimler (BODRUM) Payı (m²)',           x: 211, w: 80,  align: 'center' },
        { title: 'Toplam Brüt Alan (m²)',                                   x: 291, w: 62,  align: 'center' },
        { title: 'İnşaat Bedeli (TL)',                                      x: 353, w: 70,  align: 'right'  },
        { title: 'Sığınak ve Teknik Hacimler (BODRUM) Bedeli (TL)',        x: 423, w: 85,  align: 'right'  },
        { title: 'Toplam İnşaat Bedeli (TL)',                               x: 508, w: 70,  align: 'right'  },
        { title: 'Devlet Desteği (TL)',                                    x: 578, w: 70,  align: 'right'  },
        { title: 'Ödenecek Tutar (TL)',                                    x: 648, w: 113, align: 'right'  }
    ];

    // Tablo Başlığı Arka Planı
    doc.rect(40, currentY, width - 80, rowHeight * 2).fill('#f3f4f6');
    doc.fill('#374151');

    // Sütun Başlıkları (2 satır yükseklik, lineBreak kapalı)
    doc.font('Bold').fontSize(7.5);
    cols.forEach(c => {
        doc.text(c.title, c.x, currentY + 4, { width: c.w, align: c.align, lineBreak: false });
    });

    currentY += rowHeight * 2;

    // Satırlar
    doc.font('Regular').fontSize(9);
    doc.fill('#000000');

    let totBrut = 0, totBodrum = 0, totToplamBrut = 0, totBedel = 0, totBodrumBedel = 0, totToplamInsaat = 0, totDestek = 0, totOdenecek = 0;

    rows.forEach((row, i) => {
        // Sayfa sonu kontrolü
        if (currentY + rowHeight > doc.page.height - 120) {
            doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
            currentY = 40;
            // Başlığı tekrar çiz
            doc.rect(40, currentY, width - 80, rowHeight * 2).fill('#f3f4f6');
            doc.fill('#374151');
            doc.font('Bold').fontSize(7.5);
            cols.forEach(c => doc.text(c.title, c.x, currentY + 4, { width: c.w, align: c.align, lineBreak: false }));
            currentY += rowHeight * 2;
            doc.font('Regular').fontSize(9).fill('#000000');
        }

        // Satır arka planı (zebra)
        if (i % 2 === 1) {
            doc.rect(40, currentY, width - 80, rowHeight).fill('#fafafa');
            doc.fill('#000000');
        }

        const toplamBrut = (row.brut || 0) + (row.bodrum || 0);
        const toplamInsaat = (row.bedel || 0) + (row.bodrumBedel || 0);

        doc.text(row.kat,                                          cols[0].x, currentY + 7, { width: cols[0].w, align: cols[0].align, lineBreak: false });
        doc.text(row.no.toString(),                                cols[1].x, currentY + 7, { width: cols[1].w, align: cols[1].align, lineBreak: false });
        doc.text(row.brut.toString(),                              cols[2].x, currentY + 7, { width: cols[2].w, align: cols[2].align, lineBreak: false });
        doc.text(row.bodrum.toString(),                            cols[3].x, currentY + 7, { width: cols[3].w, align: cols[3].align, lineBreak: false });
        doc.fill('#1d4ed8');
        doc.text(toplamBrut.toLocaleString('tr-TR'),               cols[4].x, currentY + 7, { width: cols[4].w, align: cols[4].align, lineBreak: false });
        doc.fill('#000000');
        doc.text(row.bedel.toLocaleString('tr-TR'),                cols[5].x, currentY + 7, { width: cols[5].w, align: cols[5].align, lineBreak: false });
        doc.text((row.bodrumBedel||0).toLocaleString('tr-TR'),     cols[6].x, currentY + 7, { width: cols[6].w, align: cols[6].align, lineBreak: false });
        doc.fill('#15803d');
        doc.text(toplamInsaat.toLocaleString('tr-TR'),             cols[7].x, currentY + 7, { width: cols[7].w, align: cols[7].align, lineBreak: false });
        doc.fill('#000000');
        doc.text(row.destek.toLocaleString('tr-TR'),               cols[8].x, currentY + 7, { width: cols[8].w, align: cols[8].align, lineBreak: false });
        doc.text(row.odenecek.toLocaleString('tr-TR'),             cols[9].x, currentY + 7, { width: cols[9].w, align: cols[9].align, lineBreak: false });

        // Çizgi
        doc.moveTo(40, currentY).lineTo(width - 40, currentY).strokeColor('#e5e7eb').stroke();

        totBrut          += row.brut;
        totBodrum        += row.bodrum;
        totToplamBrut    += toplamBrut;
        totBedel         += row.bedel;
        totBodrumBedel   += (row.bodrumBedel || 0);
        totToplamInsaat  += toplamInsaat;
        totDestek        += row.destek;
        totOdenecek      += row.odenecek;

        currentY += rowHeight;
    });

    // Alt Toplamlar Satırı
    doc.moveTo(40, currentY).lineTo(width - 40, currentY).strokeColor('#000000').stroke();
    doc.rect(40, currentY, width - 80, rowHeight).fill('#e5e7eb');
    doc.fill('#000000');
    doc.font('Bold').fontSize(9);
    doc.text('TOPLAM:', cols[0].x, currentY + 7, { width: cols[0].w + cols[1].w, align: 'right', lineBreak: false });
    doc.text(totBrut.toString(),                        cols[2].x, currentY + 7, { width: cols[2].w, align: cols[2].align, lineBreak: false });
    doc.text(totBodrum.toString(),                      cols[3].x, currentY + 7, { width: cols[3].w, align: cols[3].align, lineBreak: false });
    doc.fill('#1d4ed8');
    doc.text(totToplamBrut.toLocaleString('tr-TR'),     cols[4].x, currentY + 7, { width: cols[4].w, align: cols[4].align, lineBreak: false });
    doc.fill('#000000');
    doc.text(totBedel.toLocaleString('tr-TR'),          cols[5].x, currentY + 7, { width: cols[5].w, align: cols[5].align, lineBreak: false });
    doc.text(totBodrumBedel.toLocaleString('tr-TR'),    cols[6].x, currentY + 7, { width: cols[6].w, align: cols[6].align, lineBreak: false });
    doc.fill('#15803d');
    doc.text(totToplamInsaat.toLocaleString('tr-TR'),   cols[7].x, currentY + 7, { width: cols[7].w, align: cols[7].align, lineBreak: false });
    doc.fill('#000000');
    doc.text(totDestek.toLocaleString('tr-TR'),         cols[8].x, currentY + 7, { width: cols[8].w, align: cols[8].align, lineBreak: false });
    doc.text(totOdenecek.toLocaleString('tr-TR'),       cols[9].x, currentY + 7, { width: cols[9].w, align: cols[9].align, lineBreak: false });

    currentY += rowHeight + 20;

    // Eğer genel toplam özeti sayfaya sığmayacaksa (kalan mesafe ~120 birimden azsa) yeni sayfaya geç
    if (currentY + 120 > doc.page.height - 40) {
        doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
        currentY = 40;
    }

    // KDV ve Genel Toplam Özeti (Sağ Altta)
    const bodrumBedel = totBodrumBedel;
    const otoparkBedel = (archData.parkingCount * archData.parkingArea) * (unitPrices ? unitPrices.otopark : 0);
    // araToplam = totOdenecek (zaten bodrum bedeli içeriyor) + otoparkBedel
    const araToplam = totOdenecek + otoparkBedel;

    let vatAmount = 0;
    let vatText = '';
    let vatValText = '';

    if (vatRate === -1) {
        vatAmount = 0;
        vatText = 'KDV Tutarı:';
        vatValText = 'KDV DAHİL';
    } else {
        vatAmount = araToplam * (vatRate / 100);
        vatText = `KDV Tutarı (%${vatRate}):`;
        vatValText = `${vatAmount.toLocaleString('tr-TR')} TL`;
    }
    const grandTotal = araToplam + vatAmount;

    doc.fontSize(10);
    
    // Değerleri son sütun (Ödenecek Tutar = cols[9]) ile tam hizala
    const valX = cols[9].x;
    const valW = cols[9].w;
    
    // Etiketleri onun hemen soluna hizala
    const labelW = 250;
    const labelX = valX - labelW - 10;
    
    doc.font('Regular');
    doc.text('Bölümler (Daire/Dükkan) Toplamı:', labelX, currentY, { width: labelW, align: 'right', lineBreak: false });
    doc.text(`${totOdenecek.toLocaleString('tr-TR')} TL`, valX, currentY, { width: valW, align: 'right', lineBreak: false });
    currentY += 15;

    doc.text('Sığınak/Teknik Hacim Bedeli:', labelX, currentY, { width: labelW, align: 'right', lineBreak: false });
    doc.text(`${bodrumBedel.toLocaleString('tr-TR')} TL`, valX, currentY, { width: valW, align: 'right', lineBreak: false });
    currentY += 15;

    doc.text('Otopark Bedeli:', labelX, currentY, { width: labelW, align: 'right', lineBreak: false });
    doc.text(`${otoparkBedel.toLocaleString('tr-TR')} TL`, valX, currentY, { width: valW, align: 'right', lineBreak: false });
    currentY += 15;

    doc.font('Bold');
    doc.text('Ara Toplam (Ödenecek):', labelX, currentY, { width: labelW, align: 'right', lineBreak: false });
    doc.text(`${araToplam.toLocaleString('tr-TR')} TL`, valX, currentY, { width: valW, align: 'right', lineBreak: false });
    currentY += 15;

    doc.font('Bold');
    doc.text(vatText, labelX, currentY, { width: labelW, align: 'right', lineBreak: false });
    doc.font('Regular');
    doc.text(vatValText, valX, currentY, { width: valW, align: 'right', lineBreak: false });
    currentY += 15;

    doc.font('Bold').fontSize(12);
    doc.text('GENEL TOPLAM:', labelX, currentY, { width: labelW, align: 'right', lineBreak: false });
    doc.fill('#e63946');
    doc.text(`${grandTotal.toLocaleString('tr-TR')} TL`, valX, currentY, { width: valW, align: 'right', lineBreak: false });
    doc.fill('#000000');

    // 8. SAYFA: TEKNİK ŞARTNAME ÖNERİSİ
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    
    doc.font('Bold').fontSize(14).text('TEKNİK ŞARTNAME ÖNERİSİ', { align: 'center' });
    doc.moveDown(0.5);
    
    doc.font('Regular').fontSize(10).text('(Bu teknik şartname örnek ve öneri olarak iletilmiştir. Değişiklikler talep edilmesi halinde talepler doğrultusunda yeniden düzenlenebilir.)', { align: 'center', oblique: true });
    doc.moveDown(1.5);
    
    doc.font('Bold').fontSize(11).text('1. TEKNİK ŞARTNAME GENEL HUSUSLARI');
    doc.moveDown(0.5);
    
    doc.text('1.1-GENEL');
    doc.font('Regular').fontSize(10);
    doc.text('Yüklenici inşaatı ANAHTAR TESLİM esasına göre yapacaktır. İnşaat Belediyece tasdikli projelere, sistem kesitlerine, detay projelere göre ve mimari detaylara göre yapılacaktır. YÜKLENİCİ hizmet ve üst kalite değerlerini değiştirmeden inşaatın uygulaması için teknik açıdan gerekli gördüğü değişiklikleri KAT MALİKLERİ TEMSİL HEYETİ’nin yazılı onayı ile yapabilir. Bu değişiklikler İnşaat Sözleşmesi Hükümlerine uygun olacaktır. Şartnamede yazan kullanılacak olan markaları seçme inisiyatifi yüklenici firmaya aittir.', { align: 'justify', lineGap: 2 });
    doc.moveDown(1);
    
    doc.font('Bold').text('1.1.a- Malzeme: ', { continued: true })
       .font('Regular').text('İnşaatta kullanılacak her türlü malzeme, teçhizat ve makine ekipman ile yapım işçiliği YÜKLENİCİ\'ye aittir.', { align: 'justify', lineGap: 2 });
    doc.moveDown(0.5);
    
    doc.font('Bold').text('1.1.b- İşçilik: ', { continued: true })
       .font('Regular').text('Birinci sınıf ve en kaliteli işçilik şartlarına uygun olacaktır. YÜKLENİCİ\'nin yapacağı imalatlar ile taahhüdünde bulunan işlerle ilgili her türlü hata ve bozukluklar (malzeme ve işçilik dahil) YÜKLENİCİ\'nin sorumluluğunda olup, bu imalat ve işler YÜKLENİCİ tarafından bedelsiz sökülerek, düzeltilecektir veya değiştirilecektir.', { align: 'justify', lineGap: 2 });
    doc.moveDown(0.5);
    
    doc.font('Bold').text('1.1.c- Standartlar: ', { continued: true })
       .font('Regular').text('İnşaatın yapımında Türk Standartlar Enstitüsü veya Avrupa-Uluslararası Standartlar geçerli olacaktır.', { align: 'justify', lineGap: 2 });
    doc.moveDown(0.5);
    
    doc.font('Bold').text('1.1.d- Teknik Şartnameler: ', { continued: true })
       .font('Regular').text('İnşaat teknik şartnamesindeki imalatlar aşağıdaki şartnamelere uygun olarak yapılacaktır.', { align: 'justify', lineGap: 2 });
    doc.moveDown(0.3);
    
    const sartnameler = [
        "• Bayındırlık İşleri Genel Teknik Şartnamesi,",
        "• T.C. Karayolları Genel Teknik Şartnamesi,",
        "• İSKİ ve DSİ Genel Teknik Şartnamesi,",
        "• TEK, BEDAŞ, TEDAŞ Elektrik Genel Teknik Şartnamesi,",
        "• İGDAŞ Genel Teknik Şartnamesi,",
        "• TÜRK Telekom Genel Teknik Şartnamesi,",
        "• Diğer Resmi Kurum ve Kuruluşlara ait KİPTAŞ, TOKİ gibi KİT ve BİT gibi Şirketlere ait Teknik Şartnameler."
    ];
    sartnameler.forEach(s => {
        doc.text(s, { indent: 20, lineGap: 2 });
    });
    doc.moveDown(0.5);
    
    doc.font('Bold').text('1.1.e- Teknik Personel: ', { continued: true })
       .font('Regular').text('YÜKLENİCİ, İnşaatı yürütmek için deneyimli, Yetkili ve Sorumlu bir Şantiye şefini işin başında bulunduracaktır. Ayrıca İş Güvenliği ve İşçi Sağlığından dolayı her türlü sorumluluk YÜKLENİCİ\'ye ait olup bir İş Güvenliği Uzmanını da bu işte görevlendirecektir. Şantiye Şefi Mimar veya İnşaat Mühendisi olacaktır. Şantiye Şefine yardımcı olacak diğer disiplin mühendisleri de gerekli görülen durumlarda muhakkak inşaat sahasında hazır bulunacaktır.', { align: 'justify', lineGap: 2 });
    doc.moveDown(0.5);
    
    doc.font('Bold').text('1.1.f- Şantiye Sahası Güvenliği: ', { continued: true })
       .font('Regular').text('YÜKLENİCİ, Şantiye sahasının, inşaat için alınan malzemelerin, kullanılan makine teçhizatın ve inşaatın güvenliği ile ilgili tüm tedbirleri almakla yükümlü olup, gerekli aydınlatma, uyarı levhaları ve korkulukların gereken yerlere konulması YÜKLENİCİ\'ye aittir.', { align: 'justify', lineGap: 2 });
    doc.moveDown(0.5);

    doc.font('Bold').text('1.1.g- Altyapı Tesisleri ve Komşu parsellerin korunması: ', { continued: true })
       .font('Regular').text('Mevcut Alt Yapı tesislerinin durumu Resmi kurumlara müracaat edilerek öğrenilecektir. Mevcut altyapı tesislerinin inşaatın yapım sırasında hasar görmemesi için gereken tedbirler YÜKLENİCİ tarafından alınacaktır. Mevcut Alt Yapı tesislerinin yıkımından ve bozulmasından kaynaklı her türlü zararın karşılanması YÜKLENİCİ\'ye aittir. İnşaatın yapımı sırasında komşu parseller ile ilgili gerekli güvenlik tedbirleri alınacak, yapım sırasında meydana gelebilecek her türlü hasar YÜKLENİCİ tarafından giderilecektir.', { align: 'justify', lineGap: 2 });
    doc.moveDown(0.5);

    doc.font('Bold').text('1.1.h- Teknik Şartnamede Belirtilen Malzeme Markası ve Değişiklikler: ', { continued: true })
       .font('Regular').text('Teknik ve zaruri değişiklikler gerekmesi halinde KAT MALİKLERİ TEMSİL HEYETİ\'nin onayı ile marka, model ve cins değişikliği yapılabilir.', { align: 'justify', lineGap: 2 });
    doc.moveDown(1);

    doc.font('Bold').fontSize(11).text('1.2- KONUT TESLİM ÖNCESİ KAT MALİKLERİ İNŞAAT ZİYARETLERİ');
    doc.moveDown(0.5);
    doc.font('Regular').fontSize(10).text('Kat Malikleri, Şantiye İş Güvenliği koşulları doğrultusunda inşaatı kaba inşaat süresince ayda bir gün, ince inşaat süresince 30 günde bir gün YÜKLENİCİ\'nin tayin edeceği görevli nezaretinde ziyaret edebilecektir. Söz konusu günler taraflarca önceden tayin edilecektir. KAT MALİKLERİ TEMSİL HEYETİ inşaatı YÜKLENİCİ\'nin tayin edeceği görevli nezaretinde her zaman tetkik edebilir ve denetleyebilir.', { align: 'justify', lineGap: 2 });
    doc.moveDown(1);

    doc.font('Bold').fontSize(11).text('1.3- ABONELİKLER');
    doc.moveDown(0.5);
    doc.font('Regular').fontSize(10).text('İnşaatın yapımı öncesi veya sonrasında yapılması gereken APARTMAN Kat Malikleri adına yapılacak Abonelikler (Elektrik, su, doğalgaz v.s.) ve mukaveleler ile ilgili işlemler YÜKLENİCİ tarafından organize edilecek, bunlarla ilgili her türlü proje, abonmanlık, depozito, güvence ve mukavele ücretleri Kat Maliklerince kendi paylarına düşen tutarı ödenecektir.', { align: 'justify', lineGap: 2 });

    // 9. SAYFA (Kullanıcının 10 dediği): BİNA YAPISAL SİSTEMLERİ VE ÖZELLİKLER
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    
    doc.font('Bold').fontSize(14).text('2- BİNA YAPISAL SİSTEMLERİ VE ÖZELLİKLER');
    doc.moveDown(0.5);
    
    doc.fontSize(12).text('HAFRİYAT VE TEMEL SİSTEMLERİ', { underline: true });
    doc.moveDown(0.5);
    
    doc.font('Regular').fontSize(11).text('Mevcut eski binanın yıkılarak molozun kaldırılmasından sonra temel proje kotuna kadar hafriyat yapılacak, gereken güvenlik ve İksa sistemleri kullanılarak çevre ve güvenlik sağlanacaktır. Zemin etüt raporuna veya Statik Projeye göre temel altı zemin iyileştirme işleri de yapılması gerekirse bu işlerin bedeli de iş bu sözleşme kapsamına dahildir.', { align: 'justify', lineGap: 2 });
    doc.moveDown(0.5);
    
    doc.text('Temel altına 250 doz grobeton dökülecektir. Temel altına 2 kat 3mm kalınlığında membran veya iki kat bitüm esaslı sürme izolasyon yapılıp geotekstil uygulaması yapılacak ve temel imalatında su geçirimsizlik katkılı beton kullanılacaktır. Toprak altında kalan betonarme perdelerin dış yüzeyleri de kauçuk-bitüm esaslı sürme izolasyon malzemesi ile yalıtımı yapılacaktır.', { align: 'justify', lineGap: 2 });
    doc.moveDown(1.5);
    
    try {
        const path = require('path');
        const img1Path = path.join(__dirname, 'public', 'images', 'hafriyat1.jpg');
        const img2Path = path.join(__dirname, 'public', 'images', 'hafriyat2.jpg');
        
        let startY = doc.y;
        
        // Soldaki resim
        doc.image(img1Path, 60, startY, { fit: [350, 240], align: 'center' });
        
        // Sağdaki resim
        doc.image(img2Path, 430, startY, { fit: [350, 240], align: 'center' });
    } catch (err) {
        console.error('Hafriyat resimleri yuklenemedi: ', err);
    }

    // 10. SAYFA: İZOLASYON VE TEMEL (Kullanıcının 11. sayfa dediği)
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });

    // Sayfa dikeyden 3'e bölünüyor.
    // Toplam kullanılabilir genişlik = 841.89 - 120 = 721.89
    // Sol 2/3 genişlik = 460, Sağ 1/3 X başlangıcı = 550
    const leftWidth = 460;
    const rightX = 540;

    let textStartY = doc.y;

    doc.font('Regular').fontSize(12);

    const madde1 = "• Söz konusu izolasyon malzemesi BASF, Weber, Sarpet, UKS veya Köster marka olacaktır. Ayrıca izolasyon dış yüzeylerine koruma levhaları kullanılacaktır. Dolgu yapılması sırasında izolasyonların zarar görmemesi sağlanacaktır.";
    doc.text(madde1, 60, textStartY, { width: leftWidth, align: 'justify', lineGap: 4 });
    
    doc.moveDown(1);

    const madde2 = "• Temel sistemi dolu Radye olup Belediyece tasdikli projede öngörülen kalınlıkta yapılacaktır. Asansör çukurunun yapılmasında kazı ve izolasyon açısından özel önlem alınacaktır.";
    doc.text(madde2, { width: leftWidth, align: 'justify', lineGap: 4 });

    doc.moveDown(1);
    
    const madde3 = "• Temellerin etrafına projede el verdiği sürece Ø100'lük drenaj borusu, keçe ve uygun boyutta çakıl - mıcır kullanılarak gerekli genişlik ve yükseklikte uygulanacaktır. Drenaj suları eğim verilerek rögara bağlanacak, kot kurtarmayan yerlerde binanın uygun bir köşesinde bir kuyu yapılıp rögarda toplanacak, pompa yardımı ile şehir yağmur suyu kanalına bağlanacaktır. Yağmur ve pis su boruları birbirinden bağımsız olarak rögara bağlanacaktır.";
    doc.text(madde3, { width: leftWidth, align: 'justify', lineGap: 4 });

    // Sağ tarafa (1/3'lük kısım) 3 fotoğraf alt alta eklenecek
    try {
        const path = require('path');
        const logo1 = path.join(__dirname, 'public', 'images', 'logo1.png');
        const logo2 = path.join(__dirname, 'public', 'images', 'logo2.png');
        const logo3 = path.join(__dirname, 'public', 'images', 'logo3.png');
        
        // Yükseklik 475'i 3'e bölüyoruz, aralarda boşluk bırakıyoruz
        const imgHeight = 140;
        const spacing = 20;

        doc.image(logo1, rightX, 60, { fit: [200, imgHeight], align: 'center' });
        doc.image(logo2, rightX, 60 + imgHeight + spacing, { fit: [200, imgHeight], align: 'center' });
        doc.image(logo3, rightX, 60 + (imgHeight * 2) + (spacing * 2), { fit: [200, imgHeight], align: 'center' });
    } catch (err) {
        console.error('Logolar yuklenemedi: ', err);
    }

    // 11. SAYFA: TAŞIYICI SİSTEM (Kullanıcının 12. sayfa dediği)
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });

    textStartY = doc.y;

    doc.font('Bold').fontSize(12);
    doc.text('• TAŞIYICI SİSTEM', 60, textStartY, { width: leftWidth, align: 'justify', lineGap: 4 });
    doc.moveDown(0.5);

    doc.font('Regular').fontSize(12);
    const m1 = "• Bina taşıyıcı sistemi güncel Deprem Yönetmeliğine uygun şekilde Betonarme karkas olarak yapılacak olup, kullanılacak hazır beton sınıfı en az C30 ve yapı çeliği sınıfı B420C olacaktır. Kullanılacak hazır beton ve beton çeliği ilgili standartlara uygun olacaktır.";
    doc.text(m1, { width: leftWidth, align: 'justify', lineGap: 4 });
    doc.moveDown(1);

    const m2 = "• Kalıplar Plywood olarak yapılacaktır. Kalıplar vibratör etkisine dayanıklı ve beton suyunu sızdırmaz şekilde çakılacaktır. Tesisat deliklerinin yerleri, (su, elektrik, doğalgaz, kalorifer, havalandırma ana kolon yerleri, baca ve havalandırma delikleri) proje üzerine işlenerek kalıp yapımında yerleri belirlenecek, beton dökümünden sonra mecbur kalınmadıkça kırma veya karot makinesi ile delik açılmayacaktır.";
    doc.text(m2, { width: leftWidth, align: 'justify', lineGap: 4 });
    doc.moveDown(1);

    const m3_tasiyici = "• Her türlü beton dökümünde muhakkak vibratör ile sıkıştırma yapılacaktır. Vibratörsüz beton dökümüne katiyetle izin verilemez. Kat yüksekliklerine ve katların Şakülünde olmasına muhakkak dikkat edilecektir. Beton santrallerinden çıkış süresi iki saati geçen mikserler de bulunan beton kalıplarına gönderilmeyecek ve santrale geri gönderilecektir.";
    doc.text(m3_tasiyici, { width: leftWidth, align: 'justify', lineGap: 4 });
    doc.moveDown(1);

    const m4_tasiyici = "• Kalite kontrol programı esas olmak üzere TS206 gereğince beton testleri yapılacaktır, gelen tüm mikserlerde çıkış saati kontrolü, sıcaklık ve slump testleri yapılacaktır. Şantiyeye gelen her beton ve demir numunesi için yaptırılacak test sonuçları talep edilirse apartman teknik heyetine sunulacaktır.";
    doc.text(m4_tasiyici, { width: leftWidth, align: 'justify', lineGap: 4 });

    // Sağ tarafa (1/3'lük kısım) 4 fotoğraf alt alta eklenecek
    try {
        const path = require('path');
        const tasiyici1 = path.join(__dirname, 'public', 'images', 'tasiyici1.jpg');
        const tasiyici2 = path.join(__dirname, 'public', 'images', 'tasiyici2.jpg');
        const tasiyici3 = path.join(__dirname, 'public', 'images', 'tasiyici3.jpg');
        const tasiyici4 = path.join(__dirname, 'public', 'images', 'tasiyici4.jpg');
        
        // Toplam kullanılabilir dikey alan: 475 (60'tan başlayıp 535'te bitiyor)
        // 4 fotoğrafın eşit sığması için hesaplanan yükseklik ve boşluk
        const imgHeight = 105;
        const spacing = 18;

        doc.image(tasiyici1, rightX, 60, { fit: [200, imgHeight], align: 'center' });
        doc.image(tasiyici2, rightX, 60 + imgHeight + spacing, { fit: [200, imgHeight], align: 'center' });
        doc.image(tasiyici3, rightX, 60 + (imgHeight * 2) + (spacing * 2), { fit: [200, imgHeight], align: 'center' });
        doc.image(tasiyici4, rightX, 60 + (imgHeight * 3) + (spacing * 3), { fit: [200, imgHeight], align: 'center' });
    } catch (err) {
        console.error('Tasiyici resimleri yuklenemedi: ', err);
    }

    // YENİ SAYFA: DUVARLAR, SIVALAR VB.
    // UI/UX açısından bir sayfada metinlerin birbirine girmemesi ve taşmaması için yeni sayfaya alındı.
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    
    doc.font('Bold').fontSize(14).text('3- DUVARLAR, ÇATI, CEPHE, SIVALAR, PENCERE DOĞRAMALARI VE DIŞ İZOLASYON', { align: 'left' });
    doc.moveDown(1.5);
    
    doc.font('Bold').fontSize(12).text('DUVARLAR', { underline: true });
    doc.moveDown(0.5);
    
    doc.font('Regular').fontSize(11.5);
    const duvarlarText = "Dış duvarlar 13,5 cm’lik tuğla, iç duvarlar 8,5 cm’lik veya 10 cm’lik tuğla ile yapılacaktır. İlgili şartnamelere uygun olarak harçlı olarak örülecektir. Pencere ve kapı üstü hatılları donatılı beton lento olarak yapılacaktır. Lentolar pencere genişliğinden her iki taraftan en az 10 ar cm daha büyük olacaktır. Daireleri ayıran iç duvarlar çift duvar olarak örülecek, arasına ses yalıtım amaçlı 5 cm kalınlığında yüksek yoğunluklu KNAUF marka mineral yünü levhalar veya en az 5 cm eps levha kullanılacaktır.";
    doc.text(duvarlarText, { align: 'justify', lineGap: 3 });
    doc.moveDown(1.5);
    
    doc.font('Bold').fontSize(12).text('SIVA İŞLERİ', { underline: true });
    doc.moveDown(0.5);
    
    doc.font('Regular').fontSize(11.5);
    const sivaText1 = "Dış duvarlara çimento esaslı iç duvarlara ise alçı esaslı sıva kullanılacaktır. Dış duvarlarda mantolama altına kaba çimentolu sıva yapılacaktır. Sıva öncesi bürüt beton yüzeylere (tavan dahil) pürüzlendirişi brüt beton astarı sürülerek yüzeyin aderansı artırılacaktır. Farklı malzeme birleşim yerlerinde, dış cephe duvarlarında ve hareket olabileceği düşünülen noktalarda 160 gr/mt ağırlığında sıva filesi kullanılacaktır. Sıva yüzlerinin düşey ve düzlem olarak mastarında yapılmasını sağlamak için, en çok iki metre ara ile tesviye şeritleri (anolar) hazırlanacaktır. Anolara uyularak duvar yüzü mastarında sıvanacaktır.";
    doc.text(sivaText1, { align: 'justify', lineGap: 3 });
    doc.moveDown(1);

    const sivaText2 = "İç duvarlar, mastarında, şakulünde kaba alçı sıva yapılacak, kaba alçı sıva üzerine 1 kat sıva-saten karışık sıva uygulaması üzerine iki kat saten alçı yapılarak boyaya hazır hale getirilecektir. Sıva sarfiyatlarında üretici firma teknik föyünde belirtilen miktardan az sarfiyatta malzeme kullanılmayacaktır. Sıvalarda malzeme olarak All, ABS, Dalsan, Entegre veya Knauf marka kullanılacaktır.";
    doc.text(sivaText2, { align: 'justify', lineGap: 3 });

    doc.moveDown(1.5);
    doc.font('Bold').fontSize(12).text('ŞAP İŞLERİ', { underline: true });
    doc.moveDown(0.5);
    
    doc.font('Regular').fontSize(11.5);
    const sapText1 = "• Sıvaların bitirilmesi ile su, ısıtma tesisatının bitirilmesi ile birlikte uygun kalınlıkta ve yapılacak imalatın kalınlıkları göz önüne alınarak şap dökülecektir. Daire balkon ve banyolarda krom veya gümüş renkli ızgaralı ayarlı yer süzgeçleri kullanılacak ve tesisat yapıldıktan sonra şap dökülecektir. Islak hacimlerde Şap üzerine çimento ve akrilik esaslı, çift bileşenli, esnek (elastik) 7 bara kadar pozitif su basıncına dayanıklı sürme izolasyon malzemesi ile yalıtım yapılacaktır.";
    doc.text(sapText1, { align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);

    const sapText2 = "• Söz konusu izolasyon Malzemesi ENTEGRE, TEKNO, WEBER, BASF veya Köster marka olacaktır. Duvar zemin birleşimin noktalarına yapısal pah bandı serildikten sonra 2 kat izolasyon uygulaması yapılacaktır. Balkonlarda sonlama malzemesi olarak dış cephe şartlarına uygun seramik kullanılacaktır.";
    doc.text(sapText2, { align: 'justify', lineGap: 3 });

    doc.moveDown(1.5);
    doc.font('Bold').fontSize(12).text('ÇATI İŞLERİ', { underline: true });
    doc.moveDown(0.5);

    doc.font('Regular').fontSize(11.5);
    const catiText1 = "• Çatı çelik konstrüksiyon malzemeden olacaktır. Çelik konstrüksiyon çatı üzerine 11 mm kalınlığında OSB kullanılacak çatı arasına veya en üst kat alçıpan tavan arasında 5 cm kalınlığında mineralli taş yünü levha ile ısı izolasyonu yapılacaktır. OSB üzerine nefes alan buhar dengeleyici nem bariyeri serilerek su yalıtımı yapılacak ve üzeri beton kiremit ile sistem çatı yapılacaktır VEYA 2 kat olacak şekilde Arduazlı çatı sistemi yapılacaktır veya kenet çatı sistemlerinden herhangi biri yapılacaktır.";
    doc.text(catiText1, { align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);

    const catiText2 = "• Çatıda bulunan gizli derelere gereken eğim verildikten sonra UV dayanımlı sürme akrilik esaslı esnek (elastik) yalıtım malzemeleri ile iki kat yalıtım yapılacaktır. Yağmur inişleri, balkon giderlerini alabilecek şekilde teşkil edilecek ve Hakan Plastik, Kalde, Vesbo veya Fırat Plastik marka PVC boru malzemesinden yapılacaktır.";
    doc.text(catiText2, { align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);

    const catiText3 = "• Çatıda varsa ışıklık üstü, su geçirmez şekilde yapılacak, havalandırma için gereken boşluklar, kuşların girmesini önlemek için pvc kaplı veya boyalı tel ızgara ile çevrilecektir.";
    doc.text(catiText3, { align: 'justify', lineGap: 3 });

    doc.moveDown(1.5);
    let imagesY = doc.y;
    const imgH = 140;
    
    // Yüksekliği kontrol et, eğer sayfaya sığmıyorsa yeni sayfaya taşı
    if (imagesY + imgH > doc.page.height - 60) {
        doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
        imagesY = 60;
    }

    // 3 Fotoğrafı yan yana eşit boşluklarla yerleştir
    try {
        const path = require('path');
        const cati1 = path.join(__dirname, 'public', 'images', '14-1.jpg');
        const cati2 = path.join(__dirname, 'public', 'images', '14-2.jpg');
        const cati3 = path.join(__dirname, 'public', 'images', '14-3.jpg');
        
        const imgW = 210;
        const spacingX = (doc.page.width - 120 - (imgW * 3)) / 2; // Sağa ve sola eşit dağıtılmış boşluk

        doc.image(cati1, 60, imagesY, { fit: [imgW, imgH], align: 'center' });
        doc.image(cati2, 60 + imgW + spacingX, imagesY, { fit: [imgW, imgH], align: 'center' });
        doc.image(cati3, 60 + (imgW * 2) + (spacingX * 2), imagesY, { fit: [imgW, imgH], align: 'center' });
    } catch (err) {
        console.error('Cati resimleri yuklenemedi: ', err);
    }

    // YENİ SAYFA (15. SAYFA): PENCERE VE DIŞ CEPHE
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    
    const page15Width = doc.page.width - 120;

    doc.font('Bold').fontSize(12).text('PENCERE DOĞRAMALARI', { underline: true });
    doc.moveDown(0.5);

    doc.font('Regular').fontSize(11.5);
    const pencereText = "Doğramalarda kanatlar ve Fransız balkon kapı kanatları çift açılım esasına göre PVC esaslı WİNSA, FIRATPEN, PİMAPEN VEYA ADOPEN marka olacaktır. Doğramalar en az 7000 serisi, tasarıma uygun renkte uygulanılacaktır. Kapı ve kanat aksesuarları kaliteli marka olacaktır. Kullanılacak camlar ŞİŞE CAM - ISICAM marka ve çift cam olacaktır.";
    doc.text(pencereText, { width: page15Width, align: 'justify', lineGap: 3 });
    doc.moveDown(1.5);

    doc.font('Bold').fontSize(12).text('DIŞ CEPHE İZOLASYONU VE KAPLAMASI', { underline: true });
    doc.moveDown(0.5);

    doc.font('Regular').fontSize(11.5);
    const cepheText = "YÜKLENİCİ dış cephe tasarımını farklı cephe malzemeleri kullanılarak yapacaktır. Cephe çizimi yapılıp projelendirilirken kat maliklerinden oluşan heyetin de fikri alınacaktır. Mimari projeye uygun olarak dış cephe;";
    doc.text(cepheText, { width: page15Width, align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);

    const cepheA = "a- Apartman girişi yönlü cephede kompakt laminant, seramik, kompozit veya fibercement (betopan) levha kaplama malzemelerinden biri veya birkaçı seçilip, seçilen renk ve desendeki tasarım elemanları gerekli konstrüksiyon üzerine monte edilecektir. Arka cephelerde ise mantolama üzerine 3D cephe tasarımına uygun olarak yukarıda belirtilen cephe malzemelerinin kullanılmasına ek olarak ayrıca dekoratif sıva ve söve uygulamaları ile karışık yapılacaktır.";
    doc.text(cepheA, { width: page15Width, align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);

    const cepheB = "b- Mantolama; kaba sıva üzerine ısıl iletkenlik değeri en çok 0,037 (λD = 0,037 W/mK) olan A1 sınıfı yanmaz taşyünü levha; veya en az 5cm kalınlığında eps levha paket sistem mantolama (sıva, 160 gr/m2 lik sıva filesi ve mineral sıva) yapılacaktır. Levhalar cepheye, yapım şartnamesine uygun dübellerle sabitlenecektir. Mantolama üzerine tespit edilen renk bir kat astar, iki kat son kat dış cephe boyası ile boyanacaktır. Boya JOTUN marka dış cephe boyası olacaktır.";
    doc.text(cepheB, { width: page15Width, align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);

    const cepheC = "c- Daire balkonlarında ve Fransız balkonlarda Mimari proje detaylarına göre alüminyum-cam kullanılacaktır. Korkuluk demirlerinin cephe duvar ve düşey bantlara bağlantısında özel kenetler kullanılacaktır. Bağlantıların yapıldığı bölümlerin yeterli yüke dayanımlı olmasına dikkat edilecektir.";
    doc.text(cepheC, { width: page15Width, align: 'justify', lineGap: 3 });
    doc.moveDown(1.5);

    // 15. sayfa resmi (Metnin altına, ortaya hizalı)
    try {
        const path = require('path');
        const img15 = path.join(__dirname, 'public', 'images', '15-1.jpg');
        doc.image(img15, 60, doc.y, { fit: [page15Width, 220], align: 'center', valign: 'center' });
    } catch (err) {
        console.error('15. sayfa resmi yuklenemedi: ', err);
    }

    // YENİ SAYFA (16. SAYFA): İÇ BİTİRME İŞLERİ VE KAPILAR
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    
    const page16Width = doc.page.width - 120;

    doc.font('Bold').fontSize(14).text('4- BİNA VE KONUT İÇİ BİTİRME İŞLERİ', { align: 'left' });
    doc.moveDown(1);

    doc.font('Bold').fontSize(12).text('DIŞ KAPILAR', { underline: true });
    doc.moveDown(0.5);

    doc.font('Regular').fontSize(11.5);
    const disKapiText = "• Daire Dış kapıları TSE belgeli, 1.sınıf paslanmaz malzeme aksesuarlı, en az 1.5 mm sac kalınlığına ve çelik gövdeye sahip, daire iç tarafı daire ile uyumlu dış tarafı ahşap görünümlü, kale marka çok noktadan merkezi kilit sistemli olacaktır.";
    doc.text(disKapiText, { width: page16Width, align: 'justify', lineGap: 3 });
    doc.moveDown(1);

    doc.font('Bold').fontSize(12).text('İÇ KAPILAR', { underline: true });
    doc.moveDown(0.5);

    doc.font('Regular').fontSize(11.5);
    const icKapiText1 = "• Odalar, banyo kapıları camsız, mutfak ve salon kapıları camlı kapı olacaktır. Kapılar ve pervazları 1. Sınıf Mdf melamin veya membran olacaktır.";
    doc.text(icKapiText1, { width: page16Width, align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);

    const icKapiText2 = "• Kol, menteşe ve kilitler TSE belgeli 1.kalite paslanmaz ürünlerden seçilecektir.";
    doc.text(icKapiText2, { width: page16Width, align: 'justify', lineGap: 3 });

    doc.moveDown(1);
    doc.font('Bold').fontSize(12).text('MUTFAKLAR', { underline: true });
    doc.moveDown(0.5);

    doc.font('Regular').fontSize(11.5);
    const mutfakText1 = "• Mutfak dolapları; gövde MDFLAM malzeme, kapaklar Highgloss olacaktır.";
    doc.text(mutfakText1, { width: page16Width, align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);

    const mutfakText2 = "• Tezgah altı ve tezgah üstü dolaplar proje çizilerek belirlenecektir. Tezgahlar Çimstone , porselen veya granit olacaktır. Çekmece ve dolaplara frenli menteşe konulacaktır.";
    doc.text(mutfakText2, { width: page16Width, align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);

    const mutfakText3 = "• Mutfak zemin ile tezgah ve asma dolap arası duvar kaplamalarında, projesine uygun seçilecek 1. Sınıf Çanakkale, Vitra, Ege, Yurtbay veya Kütahya marka seramik kullanılacaktır.";
    doc.text(mutfakText3, { width: page16Width, align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);

    const mutfakText4 = "• Mutfak evyesi olarak Teka marka paslanmaz evye kullanılacaktır.";
    doc.text(mutfakText4, { width: page16Width, align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);

    const mutfakText5 = "• Mutfak armatürü olarak evye bataryası ECA veya Artema marka olacaktır.";
    doc.text(mutfakText5, { width: page16Width, align: 'justify', lineGap: 3 });
    doc.moveDown(0.5);

    const mutfakText6 = "• Mutfakta Arçelik, Beko veya Siemens ve benzeri markalar ocak, fırın ve davlumbaz konulacaktır. Davlumbazların hava tahliye bacalarının bina çıkış ağızlarına menfezler konulacaktır.";
    doc.text(mutfakText6, { width: page16Width, align: 'justify', lineGap: 3 });

    doc.moveDown(1);

    // 17. SAYFA (GALERİ SAYFASI)
    // Yazılar 16. sayfada kalıyor, fotoğraflar estetik bir galeri olarak 17. sayfaya taşınıyor
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });

    try {
        const path = require('path');
        const img16_1 = path.join(__dirname, 'public', 'images', '16-1.jpg'); // Kapı 1
        const img16_2 = path.join(__dirname, 'public', 'images', '16-2.jpg'); // Kapı 2
        const img16_3 = path.join(__dirname, 'public', 'images', '16-3.jpg'); // Mutfak 1
        const img16_4 = path.join(__dirname, 'public', 'images', '16-4.jpg'); // Mutfak 2
        const img16_5 = path.join(__dirname, 'public', 'images', '16-5.jpg'); // Marka Logoları
        
        // Estetik Grid Yerleşimi (Üst: Kapı1/Mutfak1, Orta: Logo, Alt: Kapı2/Mutfak2)
        const imgW = 320;
        const imgH = 150; // Araya logonun rahat girmesi için biraz küçültüldü
        
        const leftX = 80;
        const rightX = 440;
        
        const row1Y = 70;
        const logoY = 245;
        const row2Y = 350;

        // Üst Satır: Kapı 1 ve Mutfak 1
        doc.image(img16_1, leftX, row1Y, { fit: [imgW, imgH], align: 'center' });
        doc.image(img16_3, rightX, row1Y, { fit: [imgW, imgH], align: 'center' });

        // Orta Satır: Marka Logoları
        doc.image(img16_5, 60, logoY, { fit: [doc.page.width - 120, 80], align: 'center', valign: 'center' });

        // Alt Satır: Kapı 2 ve Mutfak 2
        doc.image(img16_2, leftX, row2Y, { fit: [imgW, imgH], align: 'center' });
        doc.image(img16_4, rightX, row2Y, { fit: [imgW, imgH], align: 'center' });

    } catch (err) {
        console.error('17. sayfa resimleri yuklenemedi: ', err);
    }

    // 18. SAYFA (BANYOLAR)
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    
    const page18Width = doc.page.width - 120; // 721.89

    doc.font('Bold').fontSize(12).text('BANYOLAR', { underline: true });
    doc.moveDown(0.5);

    doc.font('Regular').fontSize(11.5);
    const banyo1 = "• Banyoda Mimari detay projesine uygun şekilde Vitra, bien, eca veya kale marka gömme rezervuar, Vitra, bien,yurtbay, creavit veya Kale marka içten tam yıkamalı asma klozet konulacaktır. Banyolarda zemin seramiğiyle aynı seviyede paslanmaz lineer duş süzgeci koyulacaktır. Şeffaf temperli camlı duşa kabin yapılacaktır.";
    doc.text(banyo1, { width: page18Width, align: 'justify', lineGap: 3 });
    doc.moveDown(1);

    // Metin kaydırma (Text wrapping) simülasyonu için sağda daha geniş bir alan bırakıyoruz
    // Fotoğrafı büyütüp tüm sayfayı doldurması için genişliği artırıyoruz
    const wrapY18 = doc.y;
    const img18W = 330; // Fotoğraf oldukça büyütüldü
    const text18W = page18Width - img18W - 35; // Araya 35px estetik boşluk

    // Sayfayı tam doldurması için satır aralıkları ve paragraflar arası boşluklar artırıldı
    const banyo2 = "• Banyolarda projesine uygun Mdflam veya Hıgh Gloss banyo dolabı kullanılacaktır. Banyo dolaplarının lavaboları Kale, Bien, Vitra , Yurtbay veya Creavit marka olacaktır.";
    doc.text(banyo2, { width: text18W, align: 'justify', lineGap: 5 });
    doc.moveDown(1.5);

    const banyo3 = "• Banyo zemin ve duvar kaplamalarında, detay projesine uygun seçilecek 1. sınıf Çanakkale,ege yurtbay veya Kütahya marka seramik kullanılacaktır.";
    doc.text(banyo3, { width: text18W, align: 'justify', lineGap: 5 });
    doc.moveDown(1.5);

    const banyo4 = "• Banyo armatürü olarak bataryalar ECA veya Artema marka olacaktır. Yer süzgeci krom veya gümüş renkli kaplama kapaklı ve ayarlı olacaktır.";
    doc.text(banyo4, { width: text18W, align: 'justify', lineGap: 5 });
    doc.moveDown(1.5);

    const banyo5 = "• Banyo tavanları neme dayanıklı alçı plaka asma tavan olacak ve saten alçı üzerine tavan boyası ile boyanacaktır.";
    doc.text(banyo5, { width: text18W, align: 'justify', lineGap: 5 });
    doc.moveDown(1.5);

    const banyo6 = "• Banyoda ankastre çamaşır ve kurutma makinesine uygun olacak şekilde en az iki topraklı priz konulacaktır.";
    doc.text(banyo6, { width: text18W, align: 'justify', lineGap: 5 });

    // Fotoğrafı büyütülmüş haliyle sağ tarafa, sayfanın en altına kadar uzanacak şekilde yerleştirme
    try {
        const path = require('path');
        const img18 = path.join(__dirname, 'public', 'images', '18-1.jpg');
        const img18X = 60 + text18W + 35;
        
        // Fotoğrafın yüksekliğini sayfanın en alt kenarına (margin sınırına) kadar uzatıyoruz
        const imgMaxH = (doc.page.height - 60) - wrapY18; 
        
        doc.image(img18, img18X, wrapY18, { fit: [img18W, imgMaxH], align: 'right' });
    } catch (err) {
        console.error('18. sayfa resmi yuklenemedi: ', err);
    }

    // 19. SAYFA (HOL, SALON VE ODALAR)
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    
    // Sayfayı dikeyde 3'e bölme mantığı (2/3 metin, 1/3 fotoğraflar)
    const page19Width = doc.page.width - 120; // 721.89
    const text19W = (page19Width * 2) / 3; // Sol tarafın metin genişliği (yaklaşık 480px)
    const img19W = (page19Width / 3) - 30; // Sağ tarafın resim genişliği ve aradaki boşluk (yaklaşık 210px)

    doc.font('Bold').fontSize(14).text('HOL, SALON VE ODALAR', { underline: true, width: text19W });
    doc.moveDown(1.5);

    doc.font('Regular').fontSize(11.5);

    const hol1 = "• Antre ve hol zemin kaplamalarında 1. sınıf Çanakkale, Vitra ,ege, yurtbay veya Kütahya marka seramik kullanılacaktır. Süpürgelikler kapı pervazı renginde MDF süpürgelik olacaktır.";
    doc.text(hol1, { width: text19W, align: 'justify', lineGap: 5 });
    doc.moveDown(1.5);

    const hol2 = "• Antre ve hol duvarları saten alçı üzerine su bazlı Polisan, Marshall veya Filli marka iç mekan duvar boyası ile boyanacaktır. Tavanlar saten alçı üzerine beyaz renkli permolit marka tavan boyası ile boyanacaktır.";
    doc.text(hol2, { width: text19W, align: 'justify', lineGap: 5 });
    doc.moveDown(1.5);

    const hol3 = "• Antre ve hol tavanına asma tavan ve spot aydınlatma yapılacaktır.";
    doc.text(hol3, { width: text19W, align: 'justify', lineGap: 5 });
    doc.moveDown(1.5);

    const hol4 = "• Salon ve oda duvarları saten alçı üzerine su bazlı Polisan, Marshall veya Filli marka iç mekan duvar boyası ile boyanacaktır. Tavanlar saten alçı üzerine beyaz renkli permolit marka tavan boyası ile boyanacaktır.";
    doc.text(hol4, { width: text19W, align: 'justify', lineGap: 5 });
    doc.moveDown(1.5);

    const hol5 = "• Salonlar ve odalar VARIO, AGT, TERRA CLICK veya ÇAMSAN marka 8 mm laminat parke ile kaplanacaktır. Kapı eşikleri ve seramikle birleşen eşikler özel birleşim profilli olacaktır.";
    doc.text(hol5, { width: text19W, align: 'justify', lineGap: 5 });
    doc.moveDown(1.5);

    const hol6 = "• Oda tavanlarında pencere önlerine alçıpan perdelik yapılacaktır.";
    doc.text(hol6, { width: text19W, align: 'justify', lineGap: 5 });

    // Sağ taraftaki fotoğraflar (19-1 ve 19-2)
    try {
        const path = require('path');
        const img19_1 = path.join(__dirname, 'public', 'images', '19-1.jpg');
        const img19_2 = path.join(__dirname, 'public', 'images', '19-2.jpg');
        
        const img19X = 60 + text19W + 30; // Sol margin + text genişliği + aralık
        const imgMaxH = ((doc.page.height - 120) / 2) - 15; // İki fotoğraf alt alta tam sığması için yüksekliği ikiye bölüyoruz
        
        // Fotoğraf 1 (Üstte)
        doc.image(img19_1, img19X, 60, { fit: [img19W, imgMaxH], align: 'center' });
        
        // Fotoğraf 2 (Altta)
        doc.image(img19_2, img19X, 60 + imgMaxH + 30, { fit: [img19W, imgMaxH], align: 'center' });
    } catch (err) {
        console.error('19. sayfa resmi yuklenemedi: ', err);
    }

    // 20. SAYFA (MERDİVENLER VE GİRİŞ HOLÜ)
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    
    const page20Width = doc.page.width - 120; // 721.89

    doc.font('Bold').fontSize(12).text('MERDİVENLER, MERDİVEN SAHANLIKLARI VE APARTMAN GİRİŞ HOLÜ', { underline: true });
    doc.moveDown(0.5);

    doc.font('Regular').fontSize(9.5); // Metin çok yoğun olduğu için kesinlikle sığması adına punto küçültüldü

    const merdiven1 = "Ana merdiven basamaklarında ve sahanlıklarında Mermer kaplama kullanılacaktır. Basamak alınları profil veya balık sırtı şeklinde yuvarlatılacaktır. Tüm basamaklarda rıht yükseklileri eşit olacaktır.";
    const merdiven2 = "Apartman Giriş Holü Mermer kaplama yapılacaktır. Giriş holü tavanı asma tavan şeklinde ve spotlu olacak şekilde uygulanacaktır. Apartman için ortak posta kutusu ve camlı ilan panosu konulacaktır.";
    
    // İlk iki paragraf tüm sayfaya (tam genişlikte) yayılıyor
    doc.text(merdiven1, { width: page20Width, align: 'justify', lineGap: 1 });
    doc.moveDown(0.3);
    doc.text(merdiven2, { width: page20Width, align: 'justify', lineGap: 1 });
    doc.moveDown(0.5);

    // Kalan metinler fotoğrafın etrafını saracak (Text Wrap)
    const wrapY20 = doc.y;
    const img20W = 280; // Fotoğraf daha da büyütüldü (yaklaşık sayfanın 3'te 1'ine kadar çıkarıldı)
    const text20W = page20Width - img20W - 20; // Sol taraftaki metin genişliği buna göre daraltıldı

    const merdiven3 = "Ana Merdiven korkulukları alüminyum malzemeden yapılacaktır.";
    const merdiven4 = "Apartman ana giriş kapısı, alüminyum veya çelik kapı olacak, Kale marka emniyet kilidi ve otomatik kapı açma kumanda sistemi konulacaktır. Kapı üzerine fotoselli harekete duyarlı sensörlü veya zaman ayarlı aydınlatma yapılacaktır.";
    const merdiven5 = "a) Mimar tarafından uygulama projesi hazırlanacaktır. Giriş holü posta kutularını da kapsayacak bir dekor içinde lobi mantığıyla tasarlanacaktır. Tavanlarda dekoratif alçıpan asma tavan olacak ve fotocell sistemde aydınlatma sistemi uygulanacaktır.";
    const merdiven6 = "a) Bina ana giriş holü döşemeleri, tüm merdiven basamakları ve sahanlıkları ve süpürgelikleri projesine uygun olarak granit veya mermer ile kaplanacaktır. Duvarlar ise döşemeye uygun malzeme ile kaplanacaktır.";
    const merdiven7 = "a) Apartman kat holleri duvar ve tavanlar 1inci sınıf kalitede alçı sıva üzerine komple (3kat) saten macun çekilerek üzerine (3 kat) su bazlı saten yağlı boya uygulaması yapılacaktır. Boya 1nci sınıf TSE belgeli ve Jotun, MARSHALL, POLİSAN veya FİLLİ boya olacaktır.";
    const merdiven8 = "a) Merdiven korkulukları ve balkon korkulukları paslanmaz çelik veya eloksallı alüminyum olacaktır.";
    const merdiven9 = "e) Tüm asansör kapı şöveleleri granit veya mermer ile kaplanacaktır.";
    const merdiven10 = "f) Bina ana giriş holü aydınlatması ve posta kutuları ve ilan panosu, kapılar mimarın çizeceği projeye uygun olarak yapılacaktır. Kapıları ısı camlı, otomatik kilitli, hidrolik kapamalı ve çift kanatlı elektro statik boyamalı veya eloksallı alüminyum olacaktır.";
    const merdiven11 = "g) Merdivenler boyunca fotocell sistemde aydınlatma uygulanacaktır.";
    const merdiven12 = "h) Bina girişine, projesine uygun olarak saçak yapılacaktır.";
    const merdiven13 = "a) Bina ana giriş kapısı 1. Sınıf alüminyum (dizayn ve malzeme mimarın önerisi ile değişip apartman temsilcileri tarafından ayrıca onaylanabilir) özel dizaynlı ve akıllı kilitli sessiz kapanma ve otomatik sistemli, ısı camlı, otomatik kilitli, hidrolik kapamalı ve çift kanatlı elektro statik boyamalı veya eloksallı alüminyum olacaktır.";

    const remainingTexts20 = [merdiven3, merdiven4, merdiven5, merdiven6, merdiven7, merdiven8, merdiven9, merdiven10, merdiven11, merdiven12, merdiven13];
    
    remainingTexts20.forEach(txt => {
        // Taşmayı önlemek için ekstra moveDown yerine güvenli olan paragraphGap kullanıldı
        doc.text(txt, { width: text20W, align: 'justify', paragraphGap: 5 });
    });

    // Fotoğrafı sağ alt köşeye yerleştirme (Metni kaydırarak)
    try {
        const path = require('path');
        const img20 = path.join(__dirname, 'public', 'images', '20-1.jpg');
        const img20X = 60 + text20W + 15; // Boşluk daraltıldı
        const imgMaxH = (doc.page.height - 60) - wrapY20; // Resim alt çizgiye kadar uzasın
        
        doc.image(img20, img20X, wrapY20, { fit: [img20W, imgMaxH], align: 'right' });
    } catch (err) {
        console.error('20. sayfa resmi yuklenemedi: ', err);
    }

    // 21. SAYFA (MEKANİK TESİSAT)
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    
    const page21Width = doc.page.width - 120;

    doc.font('Bold').fontSize(16).text('MEKANİK TESİSAT SİSTEMLERİ', { underline: true });
    doc.moveDown(1.5);
    
    doc.font('Bold').fontSize(14).text('SIHHİ TESİSAT');
    doc.moveDown(1);

    doc.font('Regular').fontSize(12); // Sayfayı tam doldurması için puntoyu artırdık
    
    const pisSu = "Pis Su Tesisatı: Pis Su tesisatında HAKAN PLASTİK KALDE VESBO veya FIRAT PLASTİK marka PVC sessiz boru ve ekleme parçaları kullanılacaktır. Boru ve ek parça birleşimleri contalı olacaktır.";
    doc.font('Bold').text("Pis Su Tesisatı: ", { continued: true }).font('Regular').text(pisSu.replace("Pis Su Tesisatı: ", ""), { align: 'justify', lineGap: 6 });
    doc.moveDown(1.5); // Paragraflar arası boşlukları çok daha geniş tuttuk

    const temizSu = "Temiz Su Tesisatı: Ana kolon hatları gereken çapta PPRC boru olacaktır. Su sayaçları İSKİ tarafından kabul edilen marka olacaktır. Sayaçlarda çift vana kullanılacaktır. Her bağımsız bölüme basınç düşürücü konulacaktır. Sayaçtan sonra daire içi tesisat HAKAN KALDE VESBO veya FIRAT marka polipropilen malzeme ile beton döşeme üzerinden yapılacaktır. Yapılan tesisatın üzeri harçla kaplanarak korunacaktır. Armatür yerlerinde markalama ve armatür ayar elemanları kullanılacak, tesisatın bitiminde su testi yapılacak ve tesisat ağızları armatür montajına kadar kör tapa ile kapatılacaktır.";
    doc.font('Bold').text("Temiz Su Tesisatı: ", { continued: true }).font('Regular').text(temizSu.replace("Temiz Su Tesisatı: ", ""), { align: 'justify', lineGap: 6 });
    doc.moveDown(1.5);

    const suDeposu = "Su Deposu, Hidrofor ve Tesisatı: Apartman için projesinde belirtildiği kapasitede su deposu yapılacaktır. Su kesintilerinde kullanılmak üzere yeterli kapasitede hidrofor konulacak ve ek tesisatla sisteme bağlantı yapılacaktır.";
    doc.font('Bold').text("Su Deposu, Hidrofor ve Tesisatı: ", { continued: true }).font('Regular').text(suDeposu.replace("Su Deposu, Hidrofor ve Tesisatı: ", ""), { align: 'justify', lineGap: 6 });
    
    // Resmin de en alt çizgiye kadar esnemesi için araya estetik boşluk bırakıyoruz
    doc.moveDown(3); 

    // Fotoğrafı yazının altına, sayfanın ortasına yerleştirme
    try {
        const path = require('path');
        const img21 = path.join(__dirname, 'public', 'images', '21-1.jpg');
        
        const remainingY21 = doc.y;
        const imgMaxH21 = (doc.page.height - 60) - remainingY21; 
        
        // Fotoğrafın alanı tamamen doldurması için 'fit' sınırlarını maksimize ediyoruz
        doc.image(img21, 60, remainingY21, { fit: [page21Width, imgMaxH21], align: 'center' });
    } catch (err) {
        console.error('21. sayfa resmi yuklenemedi: ', err);
    }

    // 22. SAYFA (ISITMA VE DOĞALGAZ)
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    
    const page22Width = doc.page.width - 120;

    doc.font('Bold').fontSize(15).text('ISITMA - KALORİFER TESİSATI', { underline: true });
    doc.moveDown(0.5);

    doc.font('Regular').fontSize(10.5);

    // Resme büyük bir alan bırakmak için metin aralıkları ciddi şekilde daraltıldı
    const isitma1 = "Doğalgaz tesisatı teknik projeye uygun olarak imal edilecek, yoldan binalara kadar getirilecektir. Isıtma tesisatı plastik boru ve yardımcı malzemeleri kullanılarak yapılacak olup radyatörler Demirdöküm, Termoteknik, Kalde veya ECA olacaktır. Binaların ısı projesine uygun enerji kapasitesinde yoğuşmalı kombi takılacaktır.";
    doc.text(isitma1, { width: page22Width, align: 'justify', lineGap: 2 });
    doc.moveDown(0.5);

    const isitma2 = "Kombi: İlgili kurumların ve yönetmeliklerin onayı doğrultusunda doğalgazlı münferit yoğuşmalı tip kombi sitemi kurulacaktır. Kombi olarak ECA DEMİRDÖKÜM BAYMAK VEYA VAİLLANT marka olacaktır.";
    doc.font('Bold').text("Kombi: ", { continued: true }).font('Regular').text(isitma2.replace("Kombi: ", ""), { align: 'justify', lineGap: 2 });
    doc.moveDown(0.5);

    const isitma3 = "Isınma sistemi kat maliklerinin onayı ve isteğine göre petekli ısınma sisteminde kullanılan marka ve kalitede YERDEN ISITMA olarak da değiştirilebilir. Kat maliklerinin isteği doğrultusunda projesi hazırlanacaktır.";
    doc.text(isitma3, { width: page22Width, align: 'justify', lineGap: 2 });
    doc.moveDown(1);

    doc.font('Bold').fontSize(15).text('DOĞALGAZ TESİSATI', { underline: true });
    doc.moveDown(0.5);

    doc.font('Regular').fontSize(10.5);

    const dogalgaz1 = "İGDAŞ Teknik şartnamesine uygun olarak, bina dışına konulacak merkezi Doğalgaz kutusundan bina içine yer altı boruları vasıtasıyla doğalgaz hattı döşenecektir. Ana kolona gereken kesici vanalar ve deprem sensörü takılacaktır.";
    doc.text(dogalgaz1, { width: page22Width, align: 'justify', lineGap: 2 });
    doc.moveDown(0.5);

    const dogalgaz2 = "Pişirme ihtiyaçları için projesine uygun tesisat yapılacak, gereken vana ve fleksible hortumlar konulacaktır. Dairelerin teslimi ile birlikte İGDAŞ tarafından gaz açma işlemi bir defaya mahsus toplu olarak YÜKLENİCİ’nin nezaretinde ve sorumluluğunda yapılacaktır.";
    doc.text(dogalgaz2, { width: page22Width, align: 'justify', lineGap: 2 });
    doc.moveDown(1);

    doc.font('Bold').fontSize(15).text('HAVALANDIRMA- SOĞUTMA TESİSATI', { underline: true });
    doc.moveDown(0.5);

    doc.font('Regular').fontSize(10.5);
    const havalandirma = "Tüm dairelerin salonlarına klima altyapısı yapılacaktır.";
    doc.text(havalandirma, { width: page22Width, align: 'justify', lineGap: 2 });
    
    doc.moveDown(1);

    // Fotoğrafı yazının altına, sayfanın ortasına yerleştirme
    try {
        const path = require('path');
        const img22 = path.join(__dirname, 'public', 'images', '22-1.jpg');
        
        const remainingY22 = doc.y;
        // Alt sınır boşluğu bırakarak fotoğrafı konumlandırıyoruz
        const imgMaxH22 = (doc.page.height - 60) - remainingY22; 
        
        // Fotoğrafın çok daha net gözükmesi için max yüksekliği rahat kullanmasına izin veriyoruz
        if(imgMaxH22 > 0) {
            doc.image(img22, 60, remainingY22, { fit: [page22Width, imgMaxH22], align: 'center' });
        }
    } catch (err) {
        console.error('22. sayfa resmi yuklenemedi: ', err);
    }

    // 23. SAYFA
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    
    const page23Width = doc.page.width - 120;

    doc.font('Bold').fontSize(16).text('ELEKTRİK, ASANSÖR, GÖRÜNTÜLÜ KONUŞMA VE GÜVENLİK TESİSAT SİSTEMLERİ', { underline: true, width: page23Width, align: 'center' });
    doc.moveDown(2);

    doc.font('Bold').fontSize(14).text('ELEKTRİK TESİSATI');
    doc.moveDown(0.5);
    doc.font('Regular').fontSize(12).text("Elektrik tesisatı, proje, şartname ve standartlarına uygun olarak komple tamamlanacaktır. Bina girişinde ana pano yapılacak, bu pano içine her bir bağımsız bölüm, asansör, merdiven aydınlatma ve ortak çevre aydınlatma alanları için ayrı ayrı dijital elektrik sayaçları takılacaktır. Bağımsız bölümlerde projesinde gerekmesi halinde 3 fazlı elektronik sayaç kullanılacak ve fazlar dengeli olarak daireler içine dağıtılacaktır.\nBinalarda topraklama ve sıfırlama hattı bulunacaktır. Borular TSE ve CE belgeli olacaktır. Kablolar TSE belgeli HES veya ÖZNUR kullanılacaktır. Daireler içinde kaliteli gömme sigorta kutusu konulacak, tüm otomatik sigortalar, enerji kesme şarteli, kaçak akım rölesi ve yangın önleme akım rölesi otomatik sigortaları bu kutu içinde bulunacaktır. Tüm otomatik sigortalar SIEMENS veya SCHNEİDER marka olacaktır. Elektrik panosuna deprem sensörü monte edilecektir.\nTüm odalara salon ve mutfağa yetecek kadar priz ve anahtar koyulacak. Mutfakta tezgah üzerinde en az 2 adet topraklı priz bulunacaktır. Tüm priz devreleri 2,5 mm2 NYA kesitli kablo ile çekilecektir. Tüm priz ve anahtarlar VİKO veya SCHNEİDER marka olacaktır.", { width: page23Width, align: 'justify', lineGap: 6 });
    doc.moveDown(2);

    doc.font('Bold').fontSize(14).text('TELEFON TESİSATI');
    doc.moveDown(0.5);
    doc.font('Regular').fontSize(12).text("Telefon kabloları TSE li ve blandajlı çoklu (Cat 6) data kablosu olacaktır. Telefon tesisatı, proje, şartname ve standartlarına uygun olarak yapılacaktır. Her dairenin salonuna birer adet telefon hattı çekilecektir.\nFiber internet için bodrum katına tesis edilecek sistem odasından her daireye fiber kablo çekilecektir. Her daire için kablolu internet altyapısı (Ethernet) konulacak; bir oda ve salona ayrı noktaya ethernet prizi konulacaktır.", { width: page23Width, align: 'justify', lineGap: 6 });

    // 24. SAYFA
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });

    doc.font('Bold').fontSize(14).text('TV- ANTEN TESİSATI');
    doc.moveDown(0.5);
    doc.font('Regular').fontSize(12).text("Bina girişine Kablolu yayın ve Dijital yayın altyapısını teşkil eden ve Türksat kablolu yayın sisteminin dairelere bağlanmasını sağlayan sistem kurulacaktır. Ayrıca çatıya merkezi anten olarak, çanak ve uydu alıcı konulacaktır. Dairelerde salon ve yatak odasına tv hattı çekilecektir. Kurulacak merkezi anten sistemi ile tüm prizlerden uydu alıcısı ile uydu yayınlarının izlenmesi sağlanacak, (Digitürk ve D-Smart v.s.) gibi dijital platform yayınları ise abone olmak ve receiver kullanılarak izlenmesi sağlanacaktır.", { width: page23Width, align: 'justify', lineGap: 6 });
    doc.moveDown(2);

    doc.font('Bold').fontSize(14).text('ASANSÖR VE TESİSATI');
    doc.moveDown(0.5);
    doc.font('Regular').fontSize(12).text("Asansör EN 81-20 yönetmeliğine uygun olacaktır. Asansör alarm sistemli TSE belgeli olacaktır. Asansör iç ve dış kapıları tam otomatik, çift taraflı açılır paslanmaz olarak yapılacaktır. Asansör kabini otomatik aşırı yük uyarı tertibatlı, havalandırma sistemli, deprem halinde en yakın kat hizasında durma tertibatlı, elektrik kesintisi veya herhangi bir arızada en yakın katta duracak şekilde yapılacaktır. Asansörün motor ve tüm metal aksamı topraklama ile korunacaktır. Asansör, bodrum dahil tüm katlara ulaşacaktır. Asansörün şartnamelere ve yönetmeliklere uygun yapılması ve yetkili denetim kuruluşlarından kullanılabilirlik sertifikası alınması YÜKLENİCİ’nin sorumluluğundadır. Asansörün tamamlanıp, işletme ruhsatının alınması ve yeşil etiket alınması YÜKLENİCİ’ye aittir. Asansörü temin ve tesis eden firmanın bakım yapabilme Sertifikası bulunması şarttır.", { width: page23Width, align: 'justify', lineGap: 6 });
    doc.moveDown(2);

    doc.font('Bold').fontSize(14).text('GÖRÜNTÜLÜ KONUŞMA VE GÜVENLİK TESİSATI');
    doc.moveDown(0.5);
    doc.font('Regular').fontSize(12).text("Daire içinden bina giriş kapısı ile renkli görüntülü Intercom - konuşma bağlantısı sistemi yapılacaktır. Sistem, kapı önü görüntüsü sağlayacak şekilde uygulanacaktır. Kullanılacak sistem Audio marka olacaktır.\nBinanın ve bahçenin gereken yerlerine gece görüşlü güvenlik kameraları konulacaktır. Kamera sistemi kayıt kapasiteli ve full HD olacaktır. Kamera kayıt cihazı binanın ortak alanına uygun bir yer yapılıp yerleştirilecektir.", { width: page23Width, align: 'justify', lineGap: 6 });

    // 25. SAYFA
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });

    doc.font('Bold').fontSize(16).text('APARTMAN ORTAK ALANLARI VE ALTYAPI', { underline: true, width: page23Width, align: 'center' });
    doc.moveDown(1);

    doc.font('Bold').fontSize(14).text('ORTAK ALANLAR');
    doc.moveDown(0.2);
    doc.font('Regular').fontSize(12).text("Apartman bodrum katında bulunan, ortak mahallerin boyası ve aydınlatma sistemi yapılacaktır. Ortak mahallerin döşemelerine ayarlı yer süzgeci de konulacaktır.\nZemin döşemesine yüzey sertleştirici harçla pürüzsüz şap yapılacaktır.", { width: page23Width, align: 'justify', lineGap: 3 });
    doc.moveDown(1);

    doc.font('Bold').fontSize(14).text('ALTYAPI');
    doc.moveDown(0.2);
    doc.font('Regular').fontSize(12).text("Konutlardan gelen pis su boruları, bodrum kat döşemesi altından toplanacak, bina dışında yapılacak bir veya birkaç rögarda toplanacak ve buradan İSKİ kanalizasyon şebekesine verilecektir.\nİSKİ den alınacak şebeke suyu, boru vasıtası ile binaya getirilecek ve ana kolon vasıtası ile konutlara dağıtılacaktır.\nElektrik altyapısı ile ilgili yer altı kablosu, BEDAŞ ile yapılan sözleşmenin ardından yapının ana kofrasının yapılacağı yere bağlanacak ve bina ana tablosu, kofranın bulunduğu yere konulacaktır.\nDoğalgaz altyapısı için İGDAŞ’ la yapılacak sözleşme sonrasında Doğalgaz ana bağlantı kutusu, binanın uygun bir yerine konulacak, bina içi kolon tesisatı ve konut içi doğalgaz tesisatına bu kutudan doğalgaz verilmesi sağlanacaktır. Ana kolon tesisatına, deprem halinde gaz kesici vana konulacaktır.\nKablolu TV tesisatı ile ilgili Türk Telekom ile görüşme yapılacak ve Kablolu ana dağıtım kutusu binanın uygun yerine konulacaktır. Uydu tesisatı ile ilgili gereken sayıda çanak ve alıcısı çatıya monte edilecek, merkezi sistem ile tüm konutların yayınları alması sağlanacaktır.", { width: page23Width, align: 'justify', lineGap: 3 });
    doc.moveDown(1);

    doc.font('Bold').fontSize(14).text('İŞYERİ – DÜKKAN İMALAT İŞLEMLERİ');
    doc.moveDown(0.2);
    doc.font('Regular').fontSize(12).text("Dükkânlar tabanı 60x120 cm ölçüsünde 1. Sınıf Çanakkale, Vitra, Ege, Yurtbay veya Kütahya seramik yapılıp, aynı malzemeden en az 5cm süpürgelikleri yapılacaktır. Tavanlar asma tavan olacaktır ve spot aydınlatmalı olacaktır. Dış cephe kaplamaları binanın görüntüsüne uygun dekorasyon ve malzemeden imal edilecektir. Dükkanların depo kısımlarına WC yapılacaktır. Dükkan girişleri dekoratif malzemelerden yapılacaktır.", { width: page23Width, align: 'justify', lineGap: 3 });

    // 26. SAYFA
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 60, bottom: 60, left: 60, right: 60 } });

    const page26Width = doc.page.width - 120;

    doc.font('Bold').fontSize(16).text('BAHÇE DUVARLARI, PEYZAJ', { underline: true, width: page26Width, align: 'center' });
    doc.moveDown(1.5);

    doc.font('Bold').fontSize(14).text('1. BAHÇE DUVARLARI');
    doc.moveDown(0.2);
    doc.font('Regular').fontSize(12).text("Arsanın gerekli görülen yerlerine bahçe duvarı yapılacaktır. Duvar üstüne demir veya alüminyum çit - korkuluk monte edilecektir. Gereken yerlere kapı bırakılacaktır. Duvar üzerine bazalt veya mermer harpuşta ve belli aralıklarla aydınlatma armatürleri konulacaktır.", { width: page26Width, align: 'justify', lineGap: 3 });
    doc.moveDown(1.5);

    doc.font('Bold').fontSize(14).text('2. BİNA ÇEVRESİ YER KAPLAMALARI VE PEYZAJ');
    doc.moveDown(0.2);
    doc.font('Regular').fontSize(12).text("Bina çevresinde gerekli olan yerlerde, yürüme yollarına dış şartlara dayanıklı kaymaz, doğal pürüzlü granit taş kaplama veya kaymaz seramik kaplama yapılacaktır. Belediyenin verdiği Projeye uygun görüldüğü takdirde, belirlenen yerlere en az 2-3 yaşlı en az 10 adet leylandi veya benzeri kışın yaprağını dökmeyen ağaç ekilecektir. Bahçe alanının tamamına çim ekilecektir.", { width: page26Width, align: 'justify', lineGap: 3 });
    
    const textEndY = doc.y + 20;

    const imgWidth26 = (page26Width - 20) / 2;
    const remainingHeight26 = doc.page.height - 60 - textEndY;
    const imgHeight26 = (remainingHeight26 - 20) / 2;

    const startX26 = 60;
    
    doc.image(path.join(__dirname, 'public/images/26-1.jpg'), startX26, textEndY, { width: imgWidth26, height: imgHeight26 });
    doc.image(path.join(__dirname, 'public/images/26-2.jpg'), startX26 + imgWidth26 + 20, textEndY, { width: imgWidth26, height: imgHeight26 });
    doc.image(path.join(__dirname, 'public/images/26-3.jpg'), startX26, textEndY + imgHeight26 + 20, { width: imgWidth26, height: imgHeight26 });
    doc.image(path.join(__dirname, 'public/images/26-4.jpg'), startX26 + imgWidth26 + 20, textEndY + imgHeight26 + 20, { width: imgWidth26, height: imgHeight26 });

    // 27. SAYFA (Arka Kapak)
    doc.addPage({ size: 'A4', layout: 'landscape', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    
    // Resmi oranlarını bozmadan (kayma olmadan) sayfaya ortalayarak yerleştir
    doc.image(path.join(__dirname, 'public/images/27-1.jpg'), 0, 0, { 
        fit: [doc.page.width, doc.page.height], 
        align: 'center', 
        valign: 'center' 
    });

    // Filigran Ekleme İşlemi (Tüm Sayfalarda Gez)
    const range = doc.bufferedPageRange();
    const watermarkPath = path.join(__dirname, 'public/images/watermark.png');
    
    if (fs.existsSync(watermarkPath)) {
        for (let i = 0; i < range.count; i++) {
            // İlk sayfa (i=0), son sayfa (i = range.count - 1) ve teknik çizim sayfası hariç
            if (i === 0 || i === range.count - 1 || i === drawingPageIndex) {
                continue;
            }
            
            doc.switchToPage(i);
            
            doc.save();
            doc.opacity(0.15); // Şeffaflık (0.1 - 0.2 arası en ideal değerdir)
            doc.image(watermarkPath, 150, 100, {
                fit: [doc.page.width - 300, doc.page.height - 200],
                align: 'center',
                valign: 'center'
            });
            doc.restore();
        }
    }

    doc.flushPages();
    doc.end();
}

module.exports = {
    createProposalPDF
};
