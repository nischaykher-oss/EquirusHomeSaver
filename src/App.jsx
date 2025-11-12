// src/App.jsx
import React, { useMemo, useState } from "react";

/* EquirusHomeSaver - updated labels & summary:
   - "Offset / Prepayment" replaced with "Average Monthly Balance Maintained / Excess Funds"
   - Summary sentence shows net savings (interest saved minus opportunity cost)
   - Internal opportunity cost set to 5.1%
   - Calculate button (no auto-updates)
   - Indian number formatting on blur
*/

function formatIndian(x) {
  if (x === null || x === undefined || x === "" || !isFinite(x)) return "—";
  const parts = Number(x).toFixed(2).split(".");
  let intPart = parts[0];
  const dec = parts[1];
  const sign = intPart.startsWith("-") ? "-" : "";
  if (sign) intPart = intPart.slice(1);
  if (intPart.length <= 3) {
    return sign + intPart + (dec ? "." + dec : "");
  }
  const last3 = intPart.slice(-3);
  let rest = intPart.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return sign + grouped + "," + last3 + (dec ? "." + dec : "");
}

function unformatNumberString(s) {
  if (s === "" || s === null || s === undefined) return NaN;
  const cleaned = String(s).replace(/[, ]+/g, "");
  return cleaned === "" ? NaN : Number(cleaned);
}

function safeNper(pv, emi, r) {
  if (!isFinite(pv) || !isFinite(emi) || !isFinite(r) || emi <= 0) return NaN;
  const denom = 1 - r * pv / emi;
  if (denom <= 0) return NaN;
  return -Math.log(denom) / Math.log(1 + r);
}

export default function App() {
  // raw input strings (so clearing input shows blank)
  const [loanStr, setLoanStr] = useState("10000000");
  const [rateStr, setRateStr] = useState("7.5");
  const [tenureStr, setTenureStr] = useState("20");
  const [offsetStr, setOffsetStr] = useState("100000");

  // track which input is focused so we show raw digits while editing
  const [focusedInput, setFocusedInput] = useState(null);

  // results only updated when Calculate is clicked
  const [results, setResults] = useState({
    emi: NaN,
    yearsNew: NaN,
    interestSaved: NaN,
    netSavings: NaN,
    emisSaved: NaN,
    effectiveRate: NaN,
  });

  // internal opportunity cost used for net savings (5.1% per your request)
  const SAVINGS_ROI = 5.1;

  // parsed numeric values
  const loan = useMemo(() => unformatNumberString(loanStr), [loanStr]);
  const rate = useMemo(() => unformatNumberString(rateStr), [rateStr]);
  const tenureYears = useMemo(() => unformatNumberString(tenureStr), [tenureStr]);
  const offset = useMemo(() => unformatNumberString(offsetStr), [offsetStr]);

  const monthlyRate = useMemo(() => (isFinite(rate) ? rate / 100 / 12 : NaN), [rate]);

  function calculateNow() {
    // basic validation
    if (![loan, rate, tenureYears].every(v => isFinite(v) && v > 0)) {
      setResults({
        emi: NaN,
        yearsNew: NaN,
        interestSaved: NaN,
        netSavings: NaN,
        emisSaved: NaN,
        effectiveRate: NaN,
      });
      return;
    }

    // EMI auto-calc for original loan tenure
    const nOrig = Math.round(tenureYears * 12);
    let emi;
    if (monthlyRate === 0) emi = loan / nOrig;
    else emi = (monthlyRate * loan) / (1 - Math.pow(1 + monthlyRate, -nOrig));

    // principal after applying "average monthly balance/excess funds"
    const principalAfter = Math.max(0, loan - (isFinite(offset) ? offset : 0));
    const nOrigReal = safeNper(loan, emi, monthlyRate);
    const nNew = safeNper(principalAfter, emi, monthlyRate);

    const origInterest = emi * nOrigReal - loan;
    const newInterest = emi * nNew - principalAfter;
    const interestSaved = origInterest - newInterest;

    // opportunity cost (compound) using SAVINGS_ROI
    const yearsNew = nNew / 12;
    let oppCost = 0;
    if (isFinite(yearsNew) && yearsNew > 0 && isFinite(offset) && offset > 0) {
      const r = SAVINGS_ROI / 100;
      oppCost = offset * (Math.pow(1 + r, yearsNew) - 1);
    }

    const netSavings = interestSaved - oppCost;
    const emisSaved = Math.trunc(nOrigReal - nNew);
    const effectiveRate = isFinite(yearsNew) && yearsNew > 0
      ? rate - (netSavings / (loan * yearsNew)) * 100
      : NaN;

    setResults({
      emi,
      yearsNew,
      interestSaved,
      netSavings,
      emisSaved,
      effectiveRate,
    });
  }

  // input change handler: allow digits, dot, comma, minus while typing
  function handleInputChange(setter) {
    return (e) => {
      const v = e.target.value;
      const cleaned = v.replace(/[^\d\.\-\,]/g, "");
      const parts = cleaned.split(".");
      if (parts.length > 2) {
        const first = parts.shift();
        setter(first + "." + parts.join(""));
        return;
      }
      setter(cleaned);
    };
  }

  // on blur format to Indian-style grouping (commas)
  function handleBlurFormat(strValue, setter) {
    const num = unformatNumberString(strValue);
    if (!isFinite(num)) {
      setter("");
    } else {
      setter(String(formatIndian(num).replace(/\.00$/, "")));
    }
    setFocusedInput(null);
  }

  // on focus show raw digits without commas
  function handleFocusRaw(currentValue, setter, inputName) {
    setFocusedInput(inputName);
    const unformatted = String(currentValue).replace(/,/g, "");
    setter(unformatted);
  }

  // helpers for display
  const fmt = (v) => (typeof v === "number" && isFinite(v) ? formatIndian(v) : "—");
  const fmtPct = (v) => (typeof v === "number" && isFinite(v) ? `${(+v).toFixed(2)}%` : "—");

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">EquirusHomeSaver Calculator</h1>

      <div className="grid grid-cols-12 gap-4">
        {/* Inputs */}
        <div className="col-span-12 lg:col-span-5 bg-white p-4 rounded-lg shadow">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Loan Value (₹)</label>
              <input
                inputMode="numeric"
                value={focusedInput === "loan" ? loanStr.replace(/,/g, "") : (loanStr ? loanStr : "")}
                onFocus={() => handleFocusRaw(loanStr, setLoanStr, "loan")}
                onBlur={() => handleBlurFormat(loanStr, setLoanStr)}
                onChange={handleInputChange(setLoanStr)}
                className="w-full p-2 border rounded"
                placeholder="e.g. 1,00,00,000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Loan ROI (annual %)</label>
              <input
                inputMode="decimal"
                value={focusedInput === "rate" ? rateStr : (rateStr ? rateStr : "")}
                onFocus={() => handleFocusRaw(rateStr, setRateStr, "rate")}
                onBlur={() => handleBlurFormat(rateStr, setRateStr)}
                onChange={handleInputChange(setRateStr)}
                className="w-full p-2 border rounded"
                placeholder="e.g. 7.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Loan Tenure (years)</label>
              <input
                inputMode="numeric"
                value={focusedInput === "tenure" ? tenureStr : (tenureStr ? tenureStr : "")}
                onFocus={() => handleFocusRaw(tenureStr, setTenureStr, "tenure")}
                onBlur={() => handleBlurFormat(tenureStr, setTenureStr)}
                onChange={handleInputChange(setTenureStr)}
                className="w-full p-2 border rounded"
                placeholder="e.g. 20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                Average Monthly Balance Maintained / Excess Funds (₹)
              </label>
              <input
                inputMode="numeric"
                value={focusedInput === "offset" ? offsetStr.replace(/,/g, "") : (offsetStr ? offsetStr : "")}
                onFocus={() => handleFocusRaw(offsetStr, setOffsetStr, "offset")}
                onBlur={() => handleBlurFormat(offsetStr, setOffsetStr)}
                onChange={handleInputChange(setOffsetStr)}
                className="w-full p-2 border rounded"
                placeholder="e.g. 1,00,000"
              />
            </div>

            <div className="flex space-x-2">
              <button
                onClick={calculateNow}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Calculate savings
              </button>

              <button
                onClick={() => {
                  setLoanStr("10000000");
                  setRateStr("7.5");
                  setTenureStr("20");
                  setOffsetStr("100000");
                  setResults({ emi: NaN, yearsNew: NaN, interestSaved: NaN, netSavings: NaN, emisSaved: NaN, effectiveRate: NaN });
                }}
                className="px-4 py-2 border rounded"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="col-span-12 lg:col-span-7 bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded">
              <div className="text-sm text-gray-600">EMI Amount</div>
              <div className="text-xl font-semibold">{fmt(results.emi)}</div>
            </div>

            <div className="p-4 bg-green-50 rounded">
              <div className="text-sm text-gray-600">Loan completed (years)</div>
              <div className="text-xl font-semibold">{fmt(results.yearsNew)}</div>
            </div>

            <div className="p-4 bg-green-50 rounded">
              <div className="text-sm text-gray-600">Net savings (₹)</div>
              <div className="text-xl font-semibold">{fmt(results.netSavings)}</div>
            </div>

            <div className="p-4 bg-green-50 rounded">
              <div className="text-sm text-gray-600">EMIs saved (months)</div>
              <div className="text-xl font-semibold">{isFinite(results.emisSaved) ? results.emisSaved : "—"}</div>
            </div>

            <div className="p-4 bg-green-50 rounded col-span-2">
              <div className="text-sm text-gray-600">Effective interest rate</div>
              <div className="text-xl font-semibold">{fmtPct(results.effectiveRate)}</div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-purple-50 rounded">
            <div className="text-lg text-purple-700">
              {isFinite(results.yearsNew) && isFinite(results.netSavings)
                ? `With Money Saver, your loan will get completed in ${(+results.yearsNew).toFixed(2)} yrs saving ₹ ${formatIndian(results.netSavings)} in interest`
                : 'Click "Calculate savings" to see how much you can save.'}
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            This calculator assumes an opportunity cost of <strong>5.1% p.a.</strong> — an approximate average post-tax fixed-deposit return — which is used to compute the net savings shown above.
          </div>
        </div>
      </div>
    </div>
  );
}

