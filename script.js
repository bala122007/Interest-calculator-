// Utility to format currency in Indian Rupee (₹)
const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

function calculateInterest(event) {
    event.preventDefault(); // Prevent page refresh on form submit

    // 1. Get Input Values from the DOM
    const principalInput = parseFloat(document.getElementById('principal').value);
    const monthlyRate = parseFloat(document.getElementById('rate').value);
    const years = parseInt(document.getElementById('years').value) || 0;
    const months = parseInt(document.getElementById('months').value) || 0;
    const days = parseInt(document.getElementById('days').value) || 0;

    // 2. Validate Tenure Input
    const tenureError = document.getElementById('tenureError');
    if (years === 0 && months === 0 && days === 0) {
        tenureError.style.display = 'block';
        return;
    } else {
        tenureError.style.display = 'none';
    }

    // 3. Initialize Calculation Variables
    let currentPrincipal = principalInput;
    let totalInterest = 0;
    const breakdownData = []; // To store data for the results table

    // 4. Calculate for Complete 3-Year Periods (36 Months)
    const fullThreeYearBlocks = Math.floor(years / 3);
    const remainingYears = years % 3;

    for (let i = 1; i <= fullThreeYearBlocks; i++) {
        // Interest = Principal × Monthly Rate × 36 / 100
        const interest = (currentPrincipal * monthlyRate * 36) / 100;
        const endPrincipal = currentPrincipal + interest;
        
        breakdownData.push({
            stage: `3-Year Block #${i} (36 Months)`,
            start: currentPrincipal,
            interest: interest,
            end: endPrincipal,
            hint: `${formatINR(currentPrincipal)} × ${monthlyRate}% × 36 / 100`
        });

        totalInterest += interest;
        currentPrincipal = endPrincipal; // Add interest to principal for the next stage
    }

    // 5. Calculate for Remaining Complete Years (converted to months)
    if (remainingYears > 0) {
        const remainingMonthsFromYears = remainingYears * 12;
        const interest = (currentPrincipal * monthlyRate * remainingMonthsFromYears) / 100;
        const endPrincipal = currentPrincipal + interest;

        breakdownData.push({
            stage: `Remaining ${remainingYears} Year(s) (${remainingMonthsFromYears} Mos)`,
            start: currentPrincipal,
            interest: interest,
            end: endPrincipal,
            hint: `${formatINR(currentPrincipal)} × ${monthlyRate}% × ${remainingMonthsFromYears} / 100`
        });

        totalInterest += interest;
        currentPrincipal = endPrincipal;
    }

    // 6. Calculate for Remaining Separate Months
    if (months > 0) {
        const interest = (currentPrincipal * monthlyRate * months) / 100;
        const endPrincipal = currentPrincipal + interest;

        breakdownData.push({
            stage: `Extra ${months} Month(s)`,
            start: currentPrincipal,
            interest: interest,
            end: endPrincipal,
            hint: `${formatINR(currentPrincipal)} × ${monthlyRate}% × ${months} / 100`
        });

        totalInterest += interest;
        currentPrincipal = endPrincipal;
    }

    // 7. Calculate for Remaining Separate Days (Using Daily Rate)
    if (days > 0) {
        const dailyRate = monthlyRate / 30; // Convert monthly rate to daily rate
        const interest = (currentPrincipal * dailyRate * days) / 100;
        const endPrincipal = currentPrincipal + interest;

        breakdownData.push({
            stage: `Extra ${days} Day(s)`,
            start: currentPrincipal,
            interest: interest,
            end: endPrincipal,
            hint: `${formatINR(currentPrincipal)} × (${monthlyRate}% / 30) × ${days} / 100`
        });

        totalInterest += interest;
        currentPrincipal = endPrincipal;
    }

    // 8. Render Results to the UI
    document.getElementById('totalInterestSummary').innerText = formatINR(totalInterest);
    document.getElementById('finalAmountSummary').innerText = formatINR(currentPrincipal);

    const tbody = document.getElementById('breakdownBody');
    tbody.innerHTML = ''; // Clear previous table rows

    breakdownData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${row.stage}</strong>
                <span class="formula-hint">${row.hint}</span>
            </td>
            <td>${formatINR(row.start)}</td>
            <td style="color: #16a34a;">+ ${formatINR(row.interest)}</td>
            <td style="font-weight: 600;">${formatINR(row.end)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Show the results section and scroll down to it
    document.getElementById('resultSection').style.display = 'block';
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Reset Form Function
function resetForm() {
    document.getElementById('calcForm').reset();
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('tenureError').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
