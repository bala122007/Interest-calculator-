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

  // Show a month count as a whole number when possible, else 2 decimals.
  function formatMonths(m){
    const rounded = Math.round(m * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  }

  // Turn a "years, months, days" trio into a friendly string,
  // e.g. "7 years, 3 months, 8 days". Skips any part that is zero.
  function formatDuration(years, months, days){
    const parts = [];
    if (years > 0)  parts.push(years + (years === 1 ? ' year' : ' years'));
    if (months > 0) parts.push(months + (months === 1 ? ' month' : ' months'));
    if (days > 0)   parts.push(days + (days === 1 ? ' day' : ' days'));
    return parts.length ? parts.join(', ') : '0 days';
  }

  // Convert a fractional month count back into years/months/days
  // (using 1 month = 30 days) so it can be shown in plain language.
  function monthsToDuration(totalMonths){
    let years  = Math.floor(totalMonths / 12);
    let months = Math.floor(totalMonths - years * 12);
    let days   = Math.round((totalMonths - years * 12 - months) * 30);

    // Rounding can push days up to 30 -- carry it over into months.
    if (days >= 30){ days -= 30; months += 1; }
    if (months >= 12){ months -= 12; years += 1; }

    return { years, months, days };
  }

  const form            = document.getElementById('calcForm');
  const principalInput  = document.getElementById('principal');
  const rateInput       = document.getElementById('rate');
  const yearsInput      = document.getElementById('years');
  const monthsInput     = document.getElementById('months');
  const daysInput       = document.getElementById('days');

  const errPrincipal = document.getElementById('err-principal');
  const errRate      = document.getElementById('err-rate');
  const errYears     = document.getElementById('err-years');
  const topError      = document.getElementById('topError');

  const resultsSection   = document.getElementById('results');
  const periodsContainer = document.getElementById('periodsContainer');

  /* ---------- validation ---------- */

  function clearErrors(){
    [principalInput, rateInput, yearsInput, monthsInput, daysInput].forEach(el => el.classList.remove('invalid'));
    [errPrincipal, errRate, errYears].forEach(el => { el.classList.remove('show'); el.textContent = ''; });
    topError.classList.remove('show');
    topError.textContent = '';
  }

  function showFieldError(input, errEl, message){
    input.classList.add('invalid');
    errEl.textContent = message;
    errEl.classList.add('show');
  }

  // Reads a tenure sub-field (years / months / days). Blank counts as 0.
  function readWholeNumber(input){
    const raw = input.value.trim();
    if (raw === '') return 0;
    return parseFloat(raw);
  }

  // Validates all inputs. Returns the parsed values if valid, or null.
  function validateInputs(){
    clearErrors();
    let hasError = false;

    const principalRaw = principalInput.value.trim();
    const rateRaw       = rateInput.value.trim();

    const principal = parseFloat(principalRaw);
    const rate      = parseFloat(rateRaw);

    const years  = readWholeNumber(yearsInput);
    const months = readWholeNumber(monthsInput);
    const days   = readWholeNumber(daysInput);

    if (principalRaw === '' || isNaN(principal) || principal <= 0){
      showFieldError(principalInput, errPrincipal, 'Enter a valid principal amount greater than 0.');
      hasError = true;
    }

    if (rateRaw === '' || isNaN(rate) || rate <= 0){
      showFieldError(rateInput, errRate, 'Enter a valid monthly interest rate greater than 0.');
      hasError = true;
    }

    let tenureError = '';
    if (isNaN(years) || years < 0 || !Number.isInteger(years)){
      tenureError = 'Years must be a whole number, 0 or more.';
    } else if (isNaN(months) || months < 0 || months > 11 || !Number.isInteger(months)){
      tenureError = 'Months must be a whole number from 0 to 11.';
    } else if (isNaN(days) || days < 0 || days > 29 || !Number.isInteger(days)){
      tenureError = 'Days must be a whole number from 0 to 29.';
    } else if (years === 0 && months === 0 && days === 0){
      tenureError = 'Enter a tenure greater than zero.';
    }

    if (tenureError){
      showFieldError(yearsInput, errYears, tenureError);
      monthsInput.classList.add('invalid');
      daysInput.classList.add('invalid');
      hasError = true;
    }

    if (hasError){
      topError.textContent = 'Please fix the highlighted fields before calculating.';
      topError.classList.add('show');
      return null;
    }

    // Total tenure expressed in months (1 month = 30 days), used for all math.
    const totalMonths = (years * 12) + months + (days / 30);

    return { principal, rate, years, months, days, totalMonths };
  }

  /* ---------- calculation ----------
     Rules:
     - Rate is MONTHLY.
     - The full tenure (years + months + days) is converted into a
       single number of months (1 month = 30 days).
     - Interest is computed and compounded into the principal once
       every complete 3-year (36-month) block -- this is the same
       "for every complete 3-year period" rule, just measured in
       months instead of whole years so it also works for tenures
       like "7 years, 3 months, 8 days".
     - Whatever is left over after the last full 36-month block
       (which may itself include months and days) forms one final
       partial period.
  */
  function calculateSimpleInterest(principal, rate, totalMonths){
    const periods = [];               // record of every period, for display
    let currentPrincipal = principal;

    const fullPeriods      = Math.floor(totalMonths / 36); // complete 3-year (36-month) blocks
    const remainderMonths  = totalMonths - (fullPeriods * 36); // leftover, in months

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
    if (remainderMonths > 0){
      const months  = remainderMonths;
      const startPrincipal = currentPrincipal;
      const interest = (startPrincipal * rate * months) / 100;
      currentPrincipal = startPrincipal + interest;

      periods.push({
        type: 'remaining',
        startPrincipal,
        months,
        interest,
        endPrincipal: currentPrincipal,
        duration: monthsToDuration(months)
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

  function renderGivenDetails(principal, rate, years, months, days){
    document.getElementById('givenPrincipal').textContent = formatINR(principal);
    document.getElementById('givenRate').textContent = rate + '% / month';
    document.getElementById('givenYears').textContent = formatDuration(years, months, days);
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

    // remaining (partial) period -- may include months AND days
    const d = period.duration;
    const durationLabel = formatDuration(d.years, d.months, d.days);
    return `
      <div class="period remaining">
        <div class="badge">R</div>
        <h3>Remaining Period &middot; ${durationLabel}</h3>
        <div class="line">
          <span class="k">Starting Principal</span>
          <span class="v">${formatINR(period.startPrincipal)}</span>
        </div>
        <div class="line">
          <span class="k">Number of Months</span>
          <span class="v">${formatMonths(period.months)}</span>
        </div>
        <div class="line formula">
          <span class="k">Formula</span>
          <span class="v">${formatNumber(period.startPrincipal.toFixed(2))} &times; rate &times; ${formatMonths(period.months)} / 100</span>
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

  function renderResults(values, result){
    renderGivenDetails(values.principal, values.rate, values.years, values.months, values.days);

    periodsContainer.innerHTML = result.periods.map(periodCardHTML).join('');

    document.getElementById('sumOriginal').textContent = formatINR(values.principal);
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

    const result = calculateSimpleInterest(values.principal, values.rate, values.totalMonths);
    renderResults(values, result);
  });

  // Clear a field's error as soon as the user starts correcting it
  [principalInput, rateInput, yearsInput, monthsInput, daysInput].forEach(input => {
    input.addEventListener('input', function(){
      if (input.classList.contains('invalid')){
        [principalInput, rateInput, yearsInput, monthsInput, daysInput].forEach(el => el.classList.remove('invalid'));
        [errPrincipal, errRate, errYears].forEach(el => { el.classList.remove('show'); el.textContent = ''; });
      }
    });
  });
})();
