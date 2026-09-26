(function () {
  const fmt = (n) => 'Rs ' + Math.round(n).toLocaleString('en-US');
  const products = [
    { id: 'lucky-ppc', brand: 'Lucky Cement', name: 'PPC Cement, 50 kg bag', short: 'Lucky Cement PPC, 50 kg bag', cat: 'cement', icon: 'cement', unit: 'bag', units: 'bags', mrp: 1500, tiers: [[1, 1450], [10, 1430], [50, 1410], [100, 1395]], stock: 240, type: 'PPC', pack: '50 kg', sku: 'LC-PPC50', packs: [['50 kg', true], ['40 kg', false]], tags: ['deal', 'featured'], specs: [['Type', 'PPC (Portland pozzolana)'], ['Weight', '50 kg'], ['Standard', 'PS 3-2016'], ['Strength class', '42.5 N'], ['Best for', 'Plaster, masonry, general concrete']] },
    { id: 'lucky-opc', brand: 'Lucky Cement', name: 'OPC Cement, 50 kg bag', short: 'Lucky Cement OPC, 50 kg bag', cat: 'cement', icon: 'cement', unit: 'bag', units: 'bags', mrp: 1540, tiers: [[1, 1480], [10, 1460], [50, 1440]], stock: 180, type: 'OPC', pack: '50 kg', sku: 'LC-OPC50', tags: ['new'] },
    { id: 'maple-opc', brand: 'Maple Leaf', name: 'OPC Cement, 50 kg bag', short: 'Maple Leaf OPC Cement, 50 kg bag', cat: 'cement', icon: 'cement', unit: 'bag', units: 'bags', mrp: 1520, tiers: [[1, 1470], [10, 1450], [50, 1430]], stock: 120, type: 'OPC', pack: '50 kg', sku: 'ML-OPC50', tags: ['featured'] },
    { id: 'dg-opc', brand: 'DG Cement', name: 'OPC Cement, 50 kg bag', short: 'DG Cement OPC, 50 kg bag', cat: 'cement', icon: 'cement', unit: 'bag', units: 'bags', mrp: 1510, tiers: [[1, 1465], [10, 1445], [100, 1420]], stock: 96, type: 'OPC', pack: '50 kg', sku: 'DG-OPC50' },
    { id: 'dg-src', brand: 'DG Cement', name: 'Sulphate resisting cement (SRC), 50 kg bag', short: 'DG Cement SRC, 50 kg bag', cat: 'cement', icon: 'cement', unit: 'bag', units: 'bags', mrp: 1650, tiers: [[1, 1600], [10, 1580]], stock: 4, type: 'SRC', pack: '50 kg', sku: 'DG-SRC50' },
    { id: 'dg-ppc', brand: 'DG Cement', name: 'PPC Cement, 50 kg bag', short: 'DG Cement PPC, 50 kg bag', cat: 'cement', icon: 'cement', unit: 'bag', units: 'bags', mrp: 1480, tiers: [[1, 1435], [10, 1420], [50, 1400]], stock: 150, type: 'PPC', pack: '50 kg', sku: 'DG-PPC50' },
    { id: 'maple-white', brand: 'Maple Leaf', name: 'White cement, 40 kg bag', short: 'Maple Leaf white cement, 40 kg bag', cat: 'cement', icon: 'cement', unit: 'bag', units: 'bags', mrp: 2450, tiers: [[1, 2450]], stock: 30, type: 'White cement', pack: '40 kg', sku: 'ML-WHT40', specs: [['Type', 'White cement'], ['Weight', '40 kg'], ['Whiteness', '87% minimum'], ['Best for', 'Tile grout, terrazzo, decorative finish']] },
    { id: 'maple-plaster', brand: 'Maple Leaf', name: 'Wall plaster, 40 kg bag', short: 'Maple Leaf wall plaster, 40 kg bag', cat: 'cement', icon: 'cement', unit: 'bag', units: 'bags', mrp: 1380, tiers: [[1, 1320], [20, 1290]], stock: 0, type: 'Plaster', pack: '40 kg', sku: 'ML-PLS40' },
    { id: 'pc-329', brand: 'Pakistan Cables', name: 'Single-core wire 3/29, 90 m coil', short: 'Pakistan Cables wire 3/29, 90 m coil', cat: 'wire', icon: 'wire', unit: 'coil', units: 'coils', mrp: 9800, tiers: [[1, 9350], [5, 9150], [10, 8990]], stock: 6, sku: 'PC-329-90', tags: ['deal', 'featured'] },
    { id: 'fc-729', brand: 'Fast Cables', name: 'Single-core wire 7/29, 90 m coil', short: 'Fast Cables wire 7/29, 90 m coil', cat: 'wire', icon: 'wire', unit: 'coil', units: 'coils', mrp: 15900, tiers: [[1, 15200], [5, 14900]], stock: 42, sku: 'FC-729-90', tags: ['new'] },
    { id: 'clipsal-1g', brand: 'Clipsal', name: '1-gang switch, white', short: 'Clipsal 1-gang switch, white', cat: 'switch', icon: 'switch', unit: 'piece', units: 'pieces', mrp: 320, tiers: [[1, 285], [20, 270], [100, 255]], stock: 900, sku: 'CL-1G-WH', tags: ['deal'] },
    { id: 'sch-mcb16', brand: 'Schneider', name: 'MCB single pole, 16 A', short: 'Schneider MCB single pole, 16 A', cat: 'breaker', icon: 'breaker', unit: 'piece', units: 'pieces', mrp: 1150, tiers: [[1, 990], [10, 950]], stock: 64, sku: 'SE-MCB1P16', tags: ['featured', 'deal'] },
    { id: 'dadex-pprc', brand: 'Dadex', name: 'PPRC pipe, 1 in, 4 m', short: 'Dadex PPRC pipe, 1 in, 4 m', cat: 'pipe', icon: 'elbow', unit: 'length', units: 'lengths', mrp: 1350, tiers: [[1, 1240], [20, 1200]], stock: 310, sku: 'DX-PPRC1-4', tags: ['featured', 'new'] },
    { id: 'dulux-ws', brand: 'Dulux', name: 'Weathershield emulsion', short: 'Dulux Weathershield emulsion', cat: 'paint', icon: 'paint', unit: 'gallon', units: 'gallons', mrp: 7900, tiers: [[1, 7450], [5, 7300]], stock: 55, multi: true, sku: 'DU-WS-GAL', tags: ['deal', 'new'] },
    { id: 'master-6060', brand: 'Master Tiles', name: 'Floor tile 60×60 cm, box of 4', short: 'Master Tiles floor tile 60×60 cm, box of 4', cat: 'tiles', icon: 'tiles', unit: 'box', units: 'boxes', mrp: 4600, tiers: [[1, 4300], [20, 4150]], stock: 140, sku: 'MT-6060-4', tags: ['featured'] },
    { id: 'sika-wp', brand: 'Sika', name: 'Waterproofing coating, 20 kg', short: 'Sika waterproofing coating, 20 kg', cat: 'waterproof', icon: 'waterproof', unit: 'pail', units: 'pails', mrp: 9200, tiers: [[1, 8650], [5, 8450]], stock: 18, sku: 'SK-WP-20', tags: ['new', 'deal'] }
  ];
  const byId = {}; products.forEach((p) => (byId[p.id] = p));
  const tierIdx = (p, q) => { let i = 0; p.tiers.forEach((t, k) => { if (q >= t[0]) i = k; }); return i; };
  const unitPrice = (p, q) => p.tiers[tierIdx(p, q)][1];
  const tierLabel = (p, k) => { const t = p.tiers[k], n = p.tiers[k + 1]; return n ? t[0] + '–' + (n[0] - 1) + ' ' + p.units : t[0] + '+ ' + p.units; };
  const markerPct = (p, q) => {
    const t = p.tiers.map((x) => x[0]), n = t.length; if (n < 2) return 0;
    if (q >= t[n - 1]) return 100;
    for (let i = 0; i < n - 1; i++) if (q < t[i + 1]) return ((i + Math.max(0, (q - t[i])) / (t[i + 1] - t[i])) / (n - 1)) * 100;
    return 100;
  };
  const areas = [
    { name: 'Gulshan-e-Iqbal', fee: 500, free: 50000, ok: true },
    { name: 'DHA', fee: 700, free: 50000, ok: true },
    { name: 'Clifton', fee: 700, free: 50000, ok: true },
    { name: 'PECHS', fee: 500, free: 50000, ok: true },
    { name: 'North Nazimabad', fee: 600, free: 50000, ok: true },
    { name: 'Gulistan-e-Jauhar', fee: 500, free: 50000, ok: true },
    { name: 'Bahria Town Karachi', fee: 0, free: 0, ok: false }
  ];
  const categories = [
    { id: 'cement', name: 'Cement & plaster', dept: 'Civil', icon: 'cement', count: 128 },
    { id: 'wire', name: 'Wires & cables', dept: 'Electrical', icon: 'wire', count: 86 },
    { id: 'pipe', name: 'Pipes', dept: 'Plumbing & sanitary', icon: 'elbow', count: 74 },
    { id: 'tiles', name: 'Tiles & adhesives', dept: 'Civil', icon: 'tiles', count: 212 },
    { id: 'paint', name: 'Paint & primers', dept: 'Civil', icon: 'paint', count: 97 },
    { id: 'switch', name: 'Switches & sockets', dept: 'Electrical', icon: 'switch', count: 143 }
  ];
  const departments = [
    { name: 'Civil', cats: [['Cement & plaster', 'cement'], ['Tiles & adhesives', 'tiles'], ['Plywood & boards', 'ply'], ['Paint & primers', 'paint'], ['Waterproofing', 'waterproof']] },
    { name: 'Electrical', cats: [['Wires & cables', 'wire'], ['Switches & sockets', 'switch'], ['Breakers & distribution boards', 'breaker'], ['Conduits & fittings', 'conduit'], ['Lighting', 'bulb'], ['Fans', 'fan']] },
    { name: 'Plumbing & sanitary', cats: [['Pipes', 'elbow'], ['Pipe fittings', 'elbow'], ['Taps & showers', 'tap'], ['Water tanks', 'tap']] },
    { name: 'Hardware & tools', cats: [['Hinges & handles', 'hinge'], ['Locks', 'padlock'], ['Fasteners', 'hinge'], ['Power tools', 'drill'], ['Safety gear', 'padlock']] }
  ];
  const brands = ['Lucky Cement', 'Maple Leaf', 'DG Cement', 'Pakistan Cables', 'Fast Cables', 'Schneider', 'Clipsal', 'Dadex', 'Dulux', 'Berger', 'Master Tiles', 'Sika'];
  const bank = [['Bank', 'Meezan Bank'], ['Account title', 'Aricon Engineering Consultants'], ['Account number', '0101 0104 5678 90'], ['IBAN', 'PK36 MEZN 0001 0101 0456 7890']];
  const pl = (p, n) => (n === 1 ? p.unit : p.units);
  const ladderVM = (p, q, setQ) => {
    const k = tierIdx(p, q), n = p.tiers.length, up = p.tiers[k][1], nx = p.tiers[k + 1];
    return {
      hasTiers: n > 1, noTiers: n < 2, priceLabel: fmt(up), unit: p.unit, units: p.units,
      hasSave: p.mrp > up, mrpLabel: fmt(p.mrp), saveLabel: 'Save ' + fmt(p.mrp - up) + ' per ' + p.unit,
      ticks: p.tiers.map((t, i) => ({ left: (n > 1 ? (i / (n - 1)) * 100 : 0) + '%', label: i === n - 1 ? t[0] + '+' : String(t[0]) })),
      marker: markerPct(p, q) + '%', qLabel: q + ' ' + pl(p, q),
      rows: p.tiers.map((t, i) => ({ label: tierLabel(p, i), price: fmt(t[1]), bg: i === k ? '#FFF3CC' : '#FFFFFF', edge: i === k ? 'inset 4px 0 0 #F2A900' : 'none', fw: i === k ? 600 : 400, bt: i ? '1px solid #DDE1E4' : '0', pick: () => setQ(t[0]) })),
      hasNext: !!nx, nextLabel: nx ? 'Add ' + (nx[0] - q) + ' more ' + pl(p, nx[0] - q) + ' to pay ' + fmt(nx[1]) + ' each' : '', toNext: () => nx && setQ(nx[0]),
      total: fmt(up * q), totalN: up * q, up, q, minusDis: q <= 1, plusDis: q >= p.stock, minusC: q <= 1 ? '#A9B1B7' : '#1E2A32', plusC: q >= p.stock ? '#A9B1B7' : '#1E2A32',
      stockHelp: q >= p.stock && p.stock > 0 ? 'Only ' + p.stock + ' in stock' : '',
      applied: k > 0 ? 'Bulk price applied (' + p.tiers[k][0] + '+).' : '', compactNext: nx ? 'Add ' + (nx[0] - q) + ' more to pay ' + fmt(nx[1]) + ' each.' : ''
    };
  };
  const cardVM = (p, o) => {
    const oos = p.stock === 0, price = p.tiers[0][1], best = p.tiers[p.tiers.length - 1][1];
    return { id: p.id, brand: p.brand, name: p.name, unit: p.unit, priceLabel: (p.multi ? 'From ' : '') + fmt(price), hasSave: p.mrp > price, mrpLabel: fmt(p.mrp), saveLabel: 'Save ' + Math.round(((p.mrp - price) / p.mrp) * 100) + '%',
      hasBulk: p.tiers.length > 1, bulkLabel: 'Bulk from ' + fmt(best), bulkIcon: o.steps, img: o.cat[p.icon], imgOpacity: oos ? 0.6 : 1, oos, low: !oos && p.stock <= 10, lowLabel: 'Only ' + p.stock + ' left',
      btnMain: !oos && !p.multi, btnChoose: !oos && !!p.multi, btnLabel: o.mobile ? 'Add' : 'Add to cart', cartIcon: o.cart, open: () => o.open && o.open(p), add: () => o.add && o.add(p) };
  };
  window.AriData = { pl, ladderVM, cardVM, fmt, products, byId, tierIdx, unitPrice, tierLabel, markerPct, areas, categories, departments, brands, bank };
})();
