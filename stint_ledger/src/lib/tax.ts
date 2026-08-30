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
const NY_STATE_RATE = 0.07;
const SS_WAGE_CAP = 176100; // 2025 Social Security wage base

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

// Employee-side FICA: 6.2% SS (capped) + 1.45% Medicare
function calcFica(grossAnnual: number): number {
  const ssTax = Math.min(grossAnnual, SS_WAGE_CAP) * 0.062;
  const medicareTax = grossAnnual * 0.0145;
  return ssTax + medicareTax;
}

export function estimateW2Taxes(grossAnnual: number, employee401k: number = 0) {
  const agi = grossAnnual - employee401k; // 401k is pre-tax
  const federalTaxable = Math.max(0, agi - STANDARD_DEDUCTION);
  const federalTax = calcFederalTax(federalTaxable);
  const stateTax = agi * NY_STATE_RATE;
  const fica = calcFica(grossAnnual);
  const totalTax = federalTax + stateTax + fica;
  const effectiveRate = grossAnnual > 0 ? totalTax / grossAnnual : 0;
  const netAnnual = grossAnnual - totalTax - employee401k;
  return {
    fica, federalTax, stateTax, totalTax, effectiveRate,
    netAnnual, netMonthly: netAnnual / 12,
    employee401k,
  };
}

// Freelance engagements are W-2 payrolled (employer of record pays the
// employer half of FICA), so freelance income is taxed like wages:
// employee-side FICA only — NOT the 15.3% self-employment tax.
export function estimateTaxes(grossAnnual: number) {
  const fica = calcFica(grossAnnual);

  // Federal income tax
  const federalTaxable = Math.max(0, grossAnnual - STANDARD_DEDUCTION);
  const federalTax = calcFederalTax(federalTaxable);

  // NY state tax
  const stateTax = grossAnnual * NY_STATE_RATE;

  const totalTax = fica + federalTax + stateTax;
  const effectiveRate = grossAnnual > 0 ? totalTax / grossAnnual : 0;

  return {
    fica,
    federalTax,
    stateTax,
    totalTax,
    effectiveRate,
    netAnnual: grossAnnual - totalTax,
    netMonthly: (grossAnnual - totalTax) / 12,
  };
}
