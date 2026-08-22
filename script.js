(function(){
"use strict";

  /* ---------- helpers ---------- */

  // Format a number as Indian Rupee currency, e.g. ₹1,00,000.00
  function formatINR(amount){
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function formatNumber(n){
    return new Intl.NumberFormat('en-IN').format(n);
  }

  const form            = document.getElementById('calcForm');
  const principalInput  = document.getElementById('principal');
  const rateInput       = document.getElementById('rate');
  const yearsInput      = document.getElementById('years');

  const errPrincipal = document.getElementById('err-principal');
  const errRate      = document.getElementById('err-rate');
  const errYears     = document.getElementById('err-years');
  const topError      = document.getElementById('topError');

  const resultsSection   = document.getElementById('results');
  const periodsContainer = document.getElementById('periodsContainer');

  /* ---------- validation ---------- */

  function clearErrors(){
    [principalInput, rateInput, yearsInput].forEach(el => el.classList.remove('invalid'));
    [errPrincipal, errRate, errYears].forEach(el => { el.classList.remove('show'); el.textContent = ''; });
    topError.classList.remove('show');
    topError.textContent = '';
  }

  function showFieldError(input, errEl, message){
    input.classList.add('invalid');
    errEl.textContent = message;
    errEl.classList.add('show');
  }

  // Validates all three inputs. Returns the parsed values if valid, or null.
  function validateInputs(){
    clearErrors();
    let hasError = false;

    const principalRaw = principalInput.value.trim();
    const rateRaw       = rateInput.value.trim();
    const yearsRaw      = yearsInput.value.trim();

    const principal = parseFloat(principalRaw);
    const rate      = parseFloat(rateRaw);
    const years     = parseFloat(yearsRaw);

    if (principalRaw === '' || isNaN(principal) || principal <= 0){
      showFieldError(principalInput, errPrincipal, 'Enter a valid principal amount greater than 0.');
      hasError = true;
    }

    if (rateRaw === '' || isNaN(rate) || rate <= 0){
      showFieldError(rateInput, errRate, 'Enter a valid monthly interest rate greater than 0.');
      hasError = true;
    }

    if (yearsRaw === '' || isNaN(years) || years <= 0 || !Number.isInteger(years)){
      showFieldError(yearsInput, errYears, 'Enter a whole number of years, greater than 0.');
      hasError = true;
    }

    if (hasError){
      topError.textContent = 'Please fix the highlighted fields before calculating.';
      topError.classList.add('show');
      return null;
    }

    return { principal, rate, years };
  }

  /* ---------- calculation ----------
     Rules:
     - Rate is MONTHLY.
     - Interest is computed and compounded into the principal
       once every complete 3-year (36-month) block.
     - Any leftover years (years % 3) form one final partial
       period, computed in months (leftoverYears * 12).
  */
  function calculateSimpleInterest(principal, rate, years){
    const periods = [];               // record of every period, for display
    let currentPrincipal = principal;

    const fullPeriods     = Math.floor(years / 3); // number of complete 3-year blocks
    const remainingYears  = years % 3;              // leftover years after full blocks

    // One iteration per complete 3-year (36-month) block
    for (let i = 0; i < fullPeriods; i++){
      const months  = 36;
      const startPrincipal = currentPrincipal;
      const interest = (startPrincipal * rate * months) / 100;
      currentPrincipal = startPrincipal + interest;

      periods.push({
        type: 'full',
        index: i + 1,
        startPrincipal,
        months,
        interest,
        endPrincipal: currentPrincipal
      });
    }

    // Leftover partial period, if any
    if (remainingYears > 0){
      const months  = remainingYears * 12;
      const startPrincipal = currentPrincipal;
      const interest = (startPrincipal * rate * months) / 100;
      currentPrincipal = startPrincipal + interest;

      periods.push({
        type: 'remaining',
        startPrincipal,
        months,
        interest,
        endPrincipal: currentPrincipal,
        remainingYears
      });
    }

    const totalInterest = currentPrincipal - principal;

    return {
      periods,
      totalInterest,
      finalAmount: currentPrincipal
    };
  }

  /* ---------- rendering ---------- */

  function renderGivenDetails(principal, rate, years){
    document.getElementById('givenPrincipal').textContent = formatINR(principal);
    document.getElementById('givenRate').textContent = rate + '% / month';
    document.getElementById('givenYears').textContent = years + (years === 1 ? ' year' : ' years');
  }

  function periodCardHTML(period){
    if (period.type === 'full'){
      return `
        <div class="period">
          <div class="badge">${period.index}</div>
          <h3>Period ${period.index} &middot; 3 years (36 months)</h3>
          <div class="line">
            <span class="k">Starting Principal</span>
            <span class="v">${formatINR(period.startPrincipal)}</span>
          </div>
          <div class="line">
            <span class="k">Number of Months</span>
            <span class="v">${period.months}</span>
          </div>
          <div class="line formula">
            <span class="k">Formula</span>
            <span class="v">${formatNumber(period.startPrincipal.toFixed(2))} &times; rate &times; ${period.months} / 100</span>
          </div>
          <div class="line result">
            <span class="k">Interest Earned</span>
            <span class="v">${formatINR(period.interest)}</span>
          </div>
          <div class="line">
            <span class="k">Updated Principal</span>
            <span class="v">${formatINR(period.endPrincipal)}</span>
          </div>
        </div>`;
    }

    // remaining (partial) period
    const yearLabel = period.remainingYears === 1 ? '1 year' : period.remainingYears + ' years';
    return `
      <div class="period remaining">
        <div class="badge">R</div>
        <h3>Remaining ${yearLabel} (${period.months} months)</h3>
        <div class="line">
          <span class="k">Starting Principal</span>
          <span class="v">${formatINR(period.startPrincipal)}</span>
        </div>
        <div class="line">
          <span class="k">Number of Months</span>
          <span class="v">${period.months}</span>
        </div>
        <div class="line formula">
          <span class="k">Formula</span>
          <span class="v">${formatNumber(period.startPrincipal.toFixed(2))} &times; rate &times; ${period.months} / 100</span>
        </div>
        <div class="line result">
          <span class="k">Interest Earned</span>
          <span class="v">${formatINR(period.interest)}</span>
        </div>
        <div class="line">
          <span class="k">Updated Principal</span>
          <span class="v">${formatINR(period.endPrincipal)}</span>
        </div>
      </div>`;
  }

  function renderResults(principal, rate, years, result){
    renderGivenDetails(principal, rate, years);

    periodsContainer.innerHTML = result.periods.map(periodCardHTML).join('');

    document.getElementById('sumOriginal').textContent = formatINR(principal);
    document.getElementById('sumInterest').textContent = formatINR(result.totalInterest);
    document.getElementById('sumFinal').textContent = formatINR(result.finalAmount);

    resultsSection.classList.add('show');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- events ---------- */

  form.addEventListener('submit', function(e){
    e.preventDefault();

    const values = validateInputs();
    if (!values) {
      resultsSection.classList.remove('show');
      return;
    }

    const result = calculateSimpleInterest(values.principal, values.rate, values.years);
    renderResults(values.principal, values.rate, values.years, result);
  });

  // Clear a field's error as soon as the user starts correcting it
  [principalInput, rateInput, yearsInput].forEach(input => {
    input.addEventListener('input', function(){
      if (input.classList.contains('invalid')){
        input.classList.remove('invalid');
        const errEl = document.getElementById('err-' + input.id);
        if (errEl){ errEl.classList.remove('show'); errEl.textContent = ''; }
      }
    });
  });
})();
