function generatePIN(existingPins) {
  let pin;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (existingPins.includes(pin));
  return pin;
}

module.exports = generatePIN;
