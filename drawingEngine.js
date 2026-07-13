/**
 * @file drawingEngine.js
 * @description Generates a mathematical SVG representation of a building elevation.
 */

/**
 * Generates the SVG string for the building.
 * @param {Object} params - Building parameters
 * @returns {string} - SVG string
 */
function generateDrawingSVG(params) {
    const {
        roofType = 'Kırma',
        floors = [{ areas: [100, 100] }],
        basements = [],
        roof = { areas: [] },
        parkingCount = 0,
        parkingArea = 100,
        isDuplex = false
    } = params;

    const H = 80; // Kat yüksekliği
    const canvasWidth = 800;
    
    const floorCount = floors.length;
    const basementCount = basements.length;
    
    // Yüksekliği kat sayısına göre dinamik hesapla
    const requiredTopHeight = (floorCount * H) + 180; // Üst katlar ve çatı için boşluk
    const requiredBottomHeight = (basementCount + parkingCount) * H + 50; // Bodrum ve otopark için
    
    const groundY = requiredTopHeight;
    const canvasHeight = Math.max(900, requiredTopHeight + requiredBottomHeight);
    
    const centerX = canvasWidth / 2;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth} ${canvasHeight}" style="width: 100%; height: ${canvasHeight}px; min-height: 100%;">`;
    svg += `\n  <style>
        .ground { stroke: #333; stroke-width: 2; }
        .wall { fill: #f5f5f5; stroke: #333; stroke-width: 2; }
        .window { fill: #b3d4ff; stroke: #333; stroke-width: 1.5; }
        .door { fill: #8b5a2b; stroke: #333; stroke-width: 1.5; }
        .basement { fill: #d3d3d3; stroke: #333; stroke-width: 2; }
        .parking { fill: #a9a9a9; stroke: #333; stroke-width: 2; }
        .roof { fill: #cd5c5c; stroke: #333; stroke-width: 2; }
        .text { font-family: sans-serif; font-size: 14px; fill: #333; }
        .small-text { font-family: sans-serif; font-size: 11px; fill: #555; }
    </style>`;

    svg += `\n  <rect width="100%" height="100%" fill="#f0f8ff" />`;
    svg += `\n  <line x1="50" y1="${groundY}" x2="${canvasWidth - 50}" y2="${groundY}" class="ground" />`;

    // Calculate Base width (using first floor's total area if no basement, else first basement's area)
    let baseArea = 100;
    const sumArea = (acc, val) => acc + (typeof val === 'object' ? val.area : val);
    if (basements.length > 0) {
        baseArea = basements[0].areas.reduce(sumArea, 0);
    } else if (floors.length > 0) {
        baseArea = floors[0].areas.reduce(sumArea, 0);
    }
    const baseW = Math.max(Math.sqrt(baseArea) * 20, 100);
    const baseBuildingX = centerX - (baseW / 2);

    // --- BODRUM KATLAR ---
    for (let i = 0; i < basementCount; i++) {
        const by = groundY + (i * H);
        const bData = basements[i];
        const bTotalArea = bData.areas.reduce((acc, val) => acc + (typeof val === 'object' ? val.area : val), 0) || 100;
        const bW = Math.max(Math.sqrt(bTotalArea) * 20, 100);
        const bX = centerX - (bW / 2);

        svg += `\n  <!-- Bodrum Kat ${i + 1} -->`;
        svg += `\n  <rect x="${bX}" y="${by}" width="${bW}" height="${H}" class="basement" />`;
        
        // Bölümleri orantılı çiz
        let currentX = bX;
        for (let a = 0; a < bData.areas.length; a++) {
            const secData = bData.areas[a];
            const secArea = typeof secData === 'object' ? secData.area : secData;
            const secType = typeof secData === 'object' ? secData.type : 'Sığınak';
            const secW = bW * (secArea / bTotalArea);
            
            if (a > 0) {
                svg += `\n  <line x1="${currentX}" y1="${by}" x2="${currentX}" y2="${by + H}" stroke="#333" stroke-width="1.5" stroke-dasharray="4"/>`;
            }
            
            // Pencere / Vitrin / Otopark Kapısı
            const winW = Math.min(40, secW - 20);
            
            if (secType === 'Dükkan') {
                const shopW = Math.max(10, secW - 10);
                const shopX = currentX + secW/2 - shopW/2;
                svg += `\n  <rect x="${shopX}" y="${by + 20}" width="${shopW}" height="${H - 25}" class="window" />`;
                svg += `\n  <line x1="${shopX}" y1="${by + 40}" x2="${shopX + shopW}" y2="${by + 40}" stroke="#333" stroke-width="1.5" />`;
                svg += `\n  <line x1="${shopX + shopW/2}" y1="${by + 40}" x2="${shopX + shopW/2}" y2="${by + H - 5}" stroke="#333" stroke-width="1.5" />`;
            } else if (secType === 'Daire' && winW > 10) {
                const winX = currentX + secW/2 - winW/2;
                svg += `\n  <rect x="${winX}" y="${by + 30}" width="${winW}" height="30" class="window" />`;
            } else if (secType === 'Otopark') {
                const pW = Math.max(20, secW - 20);
                const pX = currentX + secW/2 - pW/2;
                svg += `\n  <rect x="${pX}" y="${by + 30}" width="${pW}" height="${H - 30}" fill="#555" stroke="#333" stroke-width="2" />`;
                svg += `\n  <line x1="${pX}" y1="${by + 45}" x2="${pX + pW}" y2="${by + 45}" stroke="#333" stroke-width="1"/>`;
                svg += `\n  <line x1="${pX}" y1="${by + 60}" x2="${pX + pW}" y2="${by + 60}" stroke="#333" stroke-width="1"/>`;
            } else if ((secType === 'Sığınak' || secType === 'Bodrum') && winW > 10) {
                // Bölüm penceresi (küçük)
                const sWinW = Math.min(40, secW - 20);
                const winX = currentX + secW/2 - sWinW/2;
                svg += `\n  <rect x="${winX}" y="${by + 10}" width="${sWinW}" height="15" class="window" />`;
            }

            // Metrekare etiketi
            svg += `\n  <text x="${currentX + secW/2}" y="${by + H/2 - 6}" text-anchor="middle" class="small-text">${secArea}m2</text>`;
            svg += `\n  <text x="${currentX + secW/2}" y="${by + H/2 + 8}" text-anchor="middle" class="small-text">(${secType})</text>`;
            
            currentX += secW;
        }

        // Özet Etiket
        const typeCounts = {};
        bData.areas.forEach(item => {
            const t = typeof item === 'object' ? item.type : 'Sığınak';
            typeCounts[t] = (typeCounts[t] || 0) + 1;
        });
        const typeStr = Object.entries(typeCounts).map(([k, v]) => `${v} ${k}`).join(', ');

        svg += `\n  <text x="${bX + bW + 10}" y="${by + H/2 + 5}" class="text">Bodrum ${i+1} (${bTotalArea}m2, ${typeStr})</text>`;
    }

    // --- OTOPARK ---
    const parkingStartY = groundY + (basementCount * H);
    for (let i = 0; i < parkingCount; i++) {
        const py = parkingStartY + (i * H);
        const pW = Math.max(Math.sqrt(parkingArea) * 20, 100);
        const pX = centerX - (pW / 2);

        svg += `\n  <!-- Otopark ${i + 1} -->`;
        svg += `\n  <rect x="${pX}" y="${py}" width="${pW}" height="${H}" class="parking" />`;
        const gw = Math.min(pW - 40, 160);
        const gx = centerX - (gw / 2);
        svg += `\n  <rect x="${gx}" y="${py + 30}" width="${gw}" height="${H - 30}" fill="#555" stroke="#333" stroke-width="2" />`;
        svg += `\n  <line x1="${gx}" y1="${py + 45}" x2="${gx + gw}" y2="${py + 45}" stroke="#333" stroke-width="1"/>`;
        svg += `\n  <line x1="${gx}" y1="${py + 60}" x2="${gx + gw}" y2="${py + 60}" stroke="#333" stroke-width="1"/>`;
        
        // Metrekare etiketi
        svg += `\n  <text x="${centerX}" y="${py + 15}" text-anchor="middle" class="small-text">${parkingArea}m2</text>`;
        
        svg += `\n  <text x="${pX - 80}" y="${py + H/2 + 5}" class="text">Otopark ${i+1}</text>`;
    }

    // --- NORMAL KATLAR ---
    for (let i = 0; i < floorCount; i++) {
        const fData = floors[i];
        const fTotalArea = fData.areas.reduce((acc, val) => acc + (typeof val === 'object' ? val.area : val), 0) || 100;
        const W = Math.max(Math.sqrt(fTotalArea) * 20, 100);
        const buildingX = centerX - (W / 2);
        const fy = groundY - ((i + 1) * H);

        svg += `\n  <!-- Kat ${i + 1} -->`;
        svg += `\n  <rect x="${buildingX}" y="${fy}" width="${W}" height="${H}" class="wall" />`;
        
        // Önce daire ayırıcı çizgileri ve pencereleri çizelim, ardından kapıyı, en son yazıları çizeceğiz ki üstte kalsın.
        let currentX = buildingX;
        let textDrawings = '';
        
        for(let a = 0; a < fData.areas.length; a++) {
            const aptData = fData.areas[a];
            const aptArea = typeof aptData === 'object' ? aptData.area : aptData;
            const aptType = typeof aptData === 'object' ? aptData.type : fData.type;
            const aptWidth = W * (aptArea / fTotalArea);
            
            // Bölücü çizgi
            if (a > 0) {
                svg += `\n  <line x1="${currentX}" y1="${fy}" x2="${currentX}" y2="${fy + H}" stroke="#333" stroke-width="1.5" stroke-dasharray="4"/>`;
            }
            
            // Pencere veya Dükkan Vitrini
            const winW = Math.min(40, aptWidth - 20);
            if (aptType === 'Dükkan') {
                const shopW = Math.max(10, aptWidth - 10);
                const shopX = currentX + aptWidth/2 - shopW/2;
                // Kapıyla çakışma durumunda biraz küçültelim
                let isOverlapWithDoor = false;
                if (i === 0) {
                    const doorLeft = centerX - 30;
                    const doorRight = centerX + 30;
                    if ((shopX + shopW) > doorLeft && shopX < doorRight) {
                        isOverlapWithDoor = true;
                    }
                }
                
                // Vitrin
                svg += `\n  <rect x="${shopX}" y="${fy + 20}" width="${shopW}" height="${H - 25}" class="window" />`;
                // Vitrin iç çizgileri
                svg += `\n  <line x1="${shopX}" y1="${fy + 40}" x2="${shopX + shopW}" y2="${fy + 40}" stroke="#333" stroke-width="1.5" />`;
                svg += `\n  <line x1="${shopX + shopW/2}" y1="${fy + 40}" x2="${shopX + shopW/2}" y2="${fy + H - 5}" stroke="#333" stroke-width="1.5" />`;
            } else if(winW > 10) {
                const winX = currentX + aptWidth/2 - winW/2;
                let isOverlapWithDoor = false;
                if (i === 0) {
                    const doorLeft = centerX - 30;
                    const doorRight = centerX + 30;
                    if ((winX + winW) > doorLeft && winX < doorRight) {
                        isOverlapWithDoor = true;
                    }
                }
                if (!isOverlapWithDoor) {
                    svg += `\n  <rect x="${winX}" y="${fy + 30}" width="${winW}" height="30" class="window" />`;
                }
            }
            
            // Metrekare etiketi yazısını sakla (en son çizilecek)
            const isKarmaZemin = (i === 0 && aptType === 'Dükkan');
            if (isKarmaZemin) {
                textDrawings += `\n  <text x="${currentX + aptWidth/2}" y="${fy + 10}" text-anchor="middle" class="small-text">${aptArea}m2</text>`;
                textDrawings += `\n  <text x="${currentX + aptWidth/2}" y="${fy + 24}" text-anchor="middle" class="small-text">(${aptType})</text>`;
            } else {
                textDrawings += `\n  <text x="${currentX + aptWidth/2}" y="${fy + 15}" text-anchor="middle" class="small-text">${aptArea}m2</text>`;
            }
            
            currentX += aptWidth;
        }
        
        // Zemin Katta Ana Bina Girişi
        if (i === 0) {
             svg += `\n  <rect x="${centerX - 25}" y="${fy + H - 55}" width="50" height="55" class="door" />`;
        }
        
        // Yazıları şimdi ekle ki kapı/pencere üstünde kalsın (özellikle kapı büyükse)
        // Vitrin üstünde metin okunabilsin diye altına yarı saydam beyaz arka plan ekleyebiliriz veya metin özelliklerini ayarlayabiliriz.
        svg += textDrawings;
        
        const katIsmi = i === 0 ? 'Zemin Kat' : `${i}. Kat`;
        
        let labelText = `${katIsmi} (${fTotalArea}m2`;
        if (i === 0) {
            const typeCounts = {};
            fData.areas.forEach(item => {
                const t = typeof item === 'object' ? item.type : fData.type;
                typeCounts[t] = (typeCounts[t] || 0) + 1;
            });
            const typeStr = Object.entries(typeCounts).map(([k, v]) => `${v} ${k}`).join(', ');
            labelText += `, ${typeStr})`;
        } else {
            const bolumTipi = fData.type === 'Dükkan' ? 'Dükkan' : 'Daire';
            labelText += `, ${fData.areas.length} ${bolumTipi})`;
        }
        
        svg += `\n  <text x="${buildingX + W + 10}" y="${fy + H/2 + 5}" class="text">${labelText}</text>`;
    }

    // --- ÇATI ---
    const topFloor = floors[floorCount - 1];
    const topArea = topFloor ? topFloor.areas.reduce((acc, val) => acc + (typeof val === 'object' ? val.area : val), 0) : 100;
    const topW = Math.max(Math.sqrt(topArea) * 20, 100);
    const topBuildingX = centerX - (topW / 2);
    const roofY = groundY - (floorCount * H);
    let roofPath = '';
    const rH = Math.min(topW / 2, 120);

    switch (roofType) {
        case 'Beşik': roofPath = `M ${topBuildingX} ${roofY} L ${centerX} ${roofY - rH} L ${topBuildingX + topW} ${roofY} Z`; break;
        case 'Kırma': roofPath = `M ${topBuildingX - 10} ${roofY} L ${topBuildingX + topW * 0.2} ${roofY - rH} L ${topBuildingX + topW * 0.8} ${roofY - rH} L ${topBuildingX + topW + 10} ${roofY} Z`; break;
        case 'Tek Yüzeyli': roofPath = `M ${topBuildingX} ${roofY} L ${topBuildingX + topW} ${roofY - rH} L ${topBuildingX + topW} ${roofY} Z`; break;
        case 'Mansard': roofPath = `M ${topBuildingX - 5} ${roofY} L ${topBuildingX + topW * 0.15} ${roofY - rH * 0.8} L ${topBuildingX + topW * 0.85} ${roofY - rH * 0.8} L ${topBuildingX + topW + 5} ${roofY} Z`; break;
        case 'Düz':
        default: roofPath = `M ${topBuildingX - 5} ${roofY} L ${topBuildingX - 5} ${roofY - 15} L ${topBuildingX + topW + 5} ${roofY - 15} L ${topBuildingX + topW + 5} ${roofY} Z`; break;
    }

    svg += `\n  <!-- Çatı -->`;
    svg += `\n  <path d="${roofPath}" class="roof" />`;
    
    let roofTotalArea = roof.areas.reduce((acc, val) => acc + (typeof val === 'object' ? val.area : val), 0);
    let roofLabel = `Çati: ${roofType}`;
    if (isDuplex) roofLabel += ` (Dubleks)`;
    if (roofTotalArea > 0) roofLabel += ` (${roofTotalArea}m2, ${roof.areas.length} Daire)`;
    svg += `\n  <text x="${topBuildingX + topW + 10}" y="${roofY - rH/2}" class="text">${roofLabel}</text>`;

    // Çatı Daireleri Pencereleri (Çatı alanlarına orantılı veya eşit)
    if (roof.areas.length > 0 && roofType !== 'Düz') {
        const totalRoofWindows = roof.areas.length;
        let currentX = topBuildingX; // Start exactly at the edge to calculate correct width splits
        
        for(let a=0; a < totalRoofWindows; a++) {
            const secArea = roof.areas[a];
            const secW = topW * (secArea / roofTotalArea); // Orantılı genişlik
            
            // Bölücü Çizgi
            if (a > 0) {
                // Çatı şeklinin içine tam oturması zordur, bu yüzden yaklaşık bir yüksekliğe (rH * 0.7) kadar çizgi çekiyoruz
                const divH = rH * 0.7; 
                svg += `\n  <line x1="${currentX}" y1="${roofY}" x2="${currentX}" y2="${roofY - divH}" stroke="#333" stroke-width="1.5" stroke-dasharray="4"/>`;
            }

            // Pencere
            const dW = Math.min(40, secW - 20);
            if (dW > 10) {
                const dX = currentX + secW/2 - dW/2;
                const dY = roofY - (rH / 2) - 10;
                svg += `\n  <rect x="${dX}" y="${dY}" width="${dW}" height="30" class="window" />`;
            }
            
            // Metrekare Etiketi
            svg += `\n  <text x="${currentX + secW/2}" y="${roofY - 10}" text-anchor="middle" class="small-text">${secArea}m2</text>`;

            currentX += secW;
        }
    } else if (roofType === 'Düz' && roof.areas.length > 0) {
        // Düz çatıda üstüne teras katı gibi kutular
        let currentX = topBuildingX;
        for(let a=0; a < roof.areas.length; a++) {
            const secArea = roof.areas[a];
            const secW = topW * (secArea / roofTotalArea);
            svg += `\n  <rect x="${currentX + 5}" y="${roofY - 40}" width="${secW - 10}" height="40" class="wall" />`;
            
            const winW = Math.min(30, secW - 20);
            if (winW > 10) {
                svg += `\n  <rect x="${currentX + secW/2 - winW/2}" y="${roofY - 30}" width="${winW}" height="20" class="window" />`;
            }
            
            // Metrekare Etiketi (Kutunun içine veya üstüne)
            svg += `\n  <text x="${currentX + secW/2}" y="${roofY - 45}" text-anchor="middle" class="small-text">${secArea}m2</text>`;
            
            currentX += secW;
        }
    }

    svg += `\n  <line x1="${baseBuildingX - 30}" y1="${roofY}" x2="${baseBuildingX - 30}" y2="${groundY}" stroke="#999" stroke-width="1" stroke-dasharray="4" />`;
    svg += `\n</svg>`;
    return svg;
}

// Isomorphic export (works in Node.js and Browser)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateDrawingSVG };
} else {
    window.generateDrawingSVG = generateDrawingSVG;
}
