// =============================================
// Config - Conglomerates, type mappings, colors
// =============================================

const CONGLOMERATES = [
  {
    name: 'Astra Group', desc: 'Jardine Matheson', color: '#3b82f6',
    keywords: ['PT ASTRA INTERNATIONAL', 'ASTRA HEALTHCARE', 'ASTRA OTOPARTS'],
  },
  {
    name: 'Salim Group', desc: 'Anthoni Salim', color: '#10b981',
    keywords: ['ANTHONI SALIM'],
  },
  {
    name: 'Sinar Mas Group', desc: 'Widjaja Family', color: '#f59e0b',
    keywords: ['SINAR MAS'],
  },
  {
    name: 'Bakrie Group', desc: 'Bakrie Family', color: '#ef4444',
    keywords: ['PT BAKRIE', 'BAKRIE &', 'BAKRIE CAPITAL', 'BAKRIE KALILA', 'BAKRIE GLOBAL', 'BAKRIE PIPE', 'BAKRIE METAL', 'ANINDITHA', 'BAKRIE'],
    excludeKeywords: [],
  },
  {
    name: 'Thohir Group', desc: 'Garibaldi Thohir', color: '#8b5cf6',
    keywords: ['GARIBALDI THOHIR', 'TRINUGRAHA THOHIR'],
  },
  {
    name: 'Saratoga / Soeryadjaya', desc: 'Edwin Soeryadjaya', color: '#06b6d4',
    keywords: ['SARATOGA', 'EDWIN SOERYADJAYA'],
  },
  {
    name: 'Barito / Prajogo', desc: 'Prajogo Pangestu', color: '#84cc16',
    keywords: ['PRAJOGO PANGESTU', 'BARITO PACIFIC', 'PT BARITO', 'BARITO MAS'],
  },
  {
    name: 'MNC Group', desc: 'Hary Tanoesoedibjo', color: '#f97316',
    keywords: ['PT MNC ', 'PT. MNC', 'MNC TOURISM', 'MNC VISION', 'MNC DIGITAL', 'MNC SEKURITAS', 'HARY TANOESOEDIBJO'],
  },
  {
    name: 'Emtek Group', desc: 'Sariaatmadja Family', color: '#ec4899',
    keywords: ['ELANG MAHKOTA TEKNOLOGI'],
  },
  {
    name: 'Triputra / Rachmat', desc: 'T.P. Rachmat', color: '#14b8a6',
    keywords: ['TRIPUTRA INVESTINDO', 'IR. T. PERMADI RACHMAT'],
  },
  {
    name: 'CT Corp', desc: 'Chairul Tanjung', color: '#a855f7',
    keywords: ['CT CORPORA', 'CHAIRUL TANJUNG'],
  },
  {
    name: 'Panin Group', desc: "Mu'min Ali Gunawan", color: '#0ea5e9',
    keywords: ['PANIN FINANCIAL', 'PANINVEST', 'PANINKORP'],
  },
  {
    name: 'Tahir / Mayapada', desc: 'Dato Sri Tahir', color: '#d946ef',
    keywords: ['MAYAPADA KARUNIA', 'MAYAPADA KASIH', 'JONATHAN TAHIR'],
    excludeKeywords: ['TAHIR MATULATAN', 'HASNI TAHIR'],
  },
];

// Conglomerates based on rumor/news/affiliation (stock-code based)
const CONGLOMERATES_RUMOR = [
  { name: 'Low Tuck Kwong', desc: 'Coal Baron', color: '#6366f1', stocks: ['BYAN','MYOH'] },
  { name: 'Prajogo Pangestu', desc: 'Barito Group', color: '#84cc16', stocks: ['BREN','BRPT','CUAN','CDIA','PTRO','RATU','SSIA','TPIA'] },
  { name: 'Hermanto Tanoko', desc: 'Tanoko Group', color: '#06b6d4', stocks: ['AVIA','CLEO','MERI','RISE','ZONE','BLES','PEVE','CAKK','DEPO','ABMM'] },
  { name: 'Happy Hapsoro', desc: 'Raja Group', color: '#f472b6', stocks: ['RAJA','RATU','SINI','MINA','BUVA','PTRO','FORU','PSKT'] },
  { name: 'Aguan / Sugianto Kusuma', desc: 'Aguan Group', color: '#a78bfa', stocks: ['CBDK','ERAA','ERAL','PANI','PDPP'] },
  { name: 'Chairul Tanjung', desc: 'CT Corp', color: '#a855f7', stocks: ['MEGA','GIAA','BBHI'] },
  { name: 'Boy Tohir', desc: 'Thohir Group', color: '#8b5cf6', stocks: ['AADI','ADRO','ADMR','ESSA','MBMA','MDKA','TRIM'] },
  { name: 'TP Rachmat', desc: 'Triputra Group', color: '#14b8a6', stocks: ['ASSA','ESSA','DSNG','DRMA','TAPG','KMTR'] },
  { name: 'Arsjad Rasjid', desc: 'Indika Group', color: '#0ea5e9', stocks: ['INDY','MBSS','PSKT','RAJA','PTRO'] },
  { name: 'Bakrie & Salim Group', desc: 'Bakrie Family', color: '#ef4444', stocks: ['BRMS','BNBR','BTEL','BUMI','DEWA','ELTY','ENRG','MDIA','UNSP','VIVA','VKTR'] },
  { name: 'Emtek Group', desc: 'Sariaatmadja Family', color: '#ec4899', stocks: ['BUKA','BBHI','EMTK','RSGK','SCMA'] },
  { name: 'Djarum Group', desc: 'Hartono Brothers', color: '#f97316', stocks: ['BBCA','BELI','DATA','HEAL','RANC','SUPR','SSIA','TOWR'] },
  { name: 'Lippo Group', desc: 'Riady Family', color: '#fb923c', stocks: ['GMTD','LPCK','LPGI','LPKR','LPLI','LPPF','LPPS','MLPL','MLPT','MPPA','NOBU','SILO'] },
  { name: 'Salim Group', desc: 'Anthoni Salim', color: '#10b981', stocks: ['BINA','CBDK','DCII','DNET','FAST','ICBP','IMAS','IMJS','INDF','LSIP','META','SIMP','AMMN','EMTK'] },
  { name: 'MNC Group', desc: 'Hary Tanoesoedibjo', color: '#f97316', stocks: ['BABP','BCAP','BHIT','BMTR','IATA','IPTV','KPIG','MNCN','MSIN','MSKY'] },
  { name: 'Astra Group', desc: 'Jardine Matheson', color: '#3b82f6', stocks: ['AALI','ACST','ASGR','ASII','AUTO','UNTR','BNLI'] },
  { name: 'Sinar Mas Group', desc: 'Widjaja Family', color: '#f59e0b', stocks: ['BSDE','BSIM','DMAS','DSSA','DUTI','FREN','INKP','SMAR','SMMA','LIFE','TKIM','GEMS'] },
  { name: 'Rajawali Group', desc: 'Peter Sondakh', color: '#d946ef', stocks: ['SMMT','FORU','BWPT','ARCI'] },
];

const TYPE_MAP = {
  CP: 'Corporate', ID: 'Individual', IS: 'Insurance', IB: 'Investment Bank',
  MF: 'Mutual Fund', PF: 'Pension Fund', SC: 'Securities', FD: 'Foundation', OT: 'Other',
};

const TYPE_COLORS = {
  Corporate: '#10b981', Individual: '#f59e0b', 'Investment Bank': '#3b82f6',
  'Mutual Fund': '#8b5cf6', Securities: '#06b6d4', Insurance: '#f97316',
  'Pension Fund': '#ec4899', Foundation: '#84cc16', Other: '#94a3b8',
};

// Percentage-based color scale
function getPctColor(pct) {
  if (pct >= 50) return '#ef4444';
  if (pct >= 30) return '#f97316';
  if (pct >= 15) return '#f59e0b';
  if (pct >= 5) return '#3b82f6';
  return '#10b981';
}
