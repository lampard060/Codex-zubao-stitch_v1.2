function toCurrency(amountInCentsLike) {
  const amount = Number(amountInCentsLike || 0);
  return Number((amount / 100).toFixed(2));
}

function mapMoneyFields(row, fieldNames) {
  const nextRow = { ...row };

  for (const fieldName of fieldNames) {
    if (fieldName in nextRow) {
      nextRow[fieldName] = toCurrency(nextRow[fieldName]);
    }
  }

  return nextRow;
}

module.exports = {
  toCurrency,
  mapMoneyFields
};
