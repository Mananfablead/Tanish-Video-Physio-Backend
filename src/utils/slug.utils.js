/**
 * Generate a URL-friendly slug from a string
 * @param {string} text - The input text to convert to slug
 * @returns {string} - The generated slug
 */
const generateSlug = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        // Replace spaces and special characters with hyphens
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
};

/**
 * Generate a unique slug by checking against existing entries in the database
 * @param {mongoose.Model} Model - The Mongoose model to check against
 * @param {string} baseText - The base text to create slug from
 * @param {string} excludeId - Optional ID to exclude from uniqueness check (for updates)
 * @returns {Promise<string>} - A unique slug
 */
const generateUniqueSlug = async (Model, baseText, excludeId = null) => {
    let slug = generateSlug(baseText);
    let uniqueSlug = slug;
    let counter = 1;

    // Keep incrementing until we find a unique slug
    let isUnique = false;
    while (!isUnique) {
        const query = { slug: uniqueSlug };
        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        const existing = await Model.findOne(query);
        if (!existing) {
            isUnique = true;
        } else {
            uniqueSlug = `${slug}-${counter}`;
            counter++;
        }
    }

    return uniqueSlug;
};

module.exports = {
    generateSlug,
    generateUniqueSlug
};