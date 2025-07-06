/**
 * Handlebars helper functions for templates
 */

/**
 * Register all Handlebars helpers
 * @param {object} hbs - The Handlebars instance
 */
function registerHelpers(hbs) {
  // Add helper - adds two numbers together
  hbs.registerHelper('add', function (value1, value2) {
    return value1 + value2;
  });

  // Truncate helper - shortens text to specified length
  hbs.registerHelper('truncate', function (text, length) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  });

  // Equality helper - checks if two values are equal
  hbs.registerHelper('eq', function (value1, value2) {
    return value1 === value2;
  });

  // You can add more helpers here as needed
}

module.exports = {
  registerHelpers,
};
