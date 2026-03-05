// 2025 federal tax brackets (single filer)
const FEDERAL_BRACKETS = [
  { min: 0, max: 11925, rate: 0.10 },
  { min: 11925, max: 48475, rate: 0.12 },
  { min: 48475, max: 103350, rate: 0.22 },
  { min: 103350, max: 197300, rate: 0.24 },
  { min: 197300, max: 250525, rate: 0.32 },
  { min: 250525, max: 626350, rate: 0.35 },
  { min: 626350, max: Infinity, rate: 0.37 },
];

const STANDARD_DEDUCTION = 15000;
const SE_TAX_RATE = 0.153;
const SE_TAXABLE_PORTION = 0.9235;
const NY_STATE_RATE = 0.07;

function calcFederalTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  for (const bracket of FEDERAL_BRACKETS) {
    if (taxableIncome <= bracket.min) break;
    const taxable = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxable * bracket.rate;
  }
  return tax;
}

export function estimateW2Taxes(grossAnnual: number, employee401k: number = 0) {
  // No SE tax for W-2 employees
  const agi = grossAnnual - employee401k; // 401k is pre-tax
  const federalTaxable = Math.max(0, agi - STANDARD_DEDUCTION);
  const federalTax = calcFederalTax(federalTaxable);
  const stateTax = agi * NY_STATE_RATE;
  // FICA: 6.2% SS (capped at $176,100 for 2025) + 1.45% Medicare
  const ssCap = 176100;
  const ssTax = Math.min(grossAnnual, ssCap) * 0.062;
  const medicareTax = grossAnnual * 0.0145;
  const fica = ssTax + medicareTax;
  const totalTax = federalTax + stateTax + fica;
  const effectiveRate = grossAnnual > 0 ? totalTax / grossAnnual : 0;
  const netAnnual = grossAnnual - totalTax - employee401k;
  return {
    fica, federalTax, stateTax, totalTax, effectiveRate,
    netAnnual, netMonthly: netAnnual / 12,
    employee401k,
  };
}

export function estimateTaxes(grossAnnual: number) {
  // Self-employment tax
  const seTaxableIncome = grossAnnual * SE_TAXABLE_PORTION;
  const seTax = seTaxableIncome * SE_TAX_RATE;

  // Deduct half of SE tax from AGI
  const halfSE = seTax / 2;
  const agi = grossAnnual - halfSE;

  // Federal income tax
  const federalTaxable = Math.max(0, agi - STANDARD_DEDUCTION);
  const federalTax = calcFederalTax(federalTaxable);

  // NY state tax
  const stateTax = agi * NY_STATE_RATE;

  const totalTax = seTax + federalTax + stateTax;
  const effectiveRate = grossAnnual > 0 ? totalTax / grossAnnual : 0;

  return {
    seTax,
    federalTax,
    stateTax,
    totalTax,
    effectiveRate,
    netAnnual: grossAnnual - totalTax,
    netMonthly: (grossAnnual - totalTax) / 12,
  };
}
