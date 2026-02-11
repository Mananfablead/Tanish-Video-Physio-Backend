/**
 * Script to generate slugs for existing services that don't have them
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Service = require('../src/models/Service.model');
const { generateUniqueSlug } = require('../src/utils/slug.utils');

async function generateSlugsForExistingServices() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tanish_physio');

        console.log('Connected to database');

        // Find all services that don't have a slug
        const servicesWithoutSlugs = await Service.find({ slug: { $exists: false } });

        console.log(`Found ${servicesWithoutSlugs.length} services without slugs`);

        for (const service of servicesWithoutSlugs) {
            // Generate a unique slug based on the service name
            const slug = await generateUniqueSlug(Service, service.name, service._id);

            // Update the service with the new slug
            service.slug = slug;
            await service.save();

            console.log(`Updated service "${service.name}" with slug: ${slug}`);
        }

        // Also check for services where slug is null or empty
        const servicesWithEmptySlugs = await Service.find({
            $or: [
                { slug: null },
                { slug: "" }
            ]
        });

        console.log(`Found ${servicesWithEmptySlugs.length} services with empty/null slugs`);

        for (const service of servicesWithEmptySlugs) {
            // Generate a unique slug based on the service name
            const slug = await generateUniqueSlug(Service, service.name, service._id);

            // Update the service with the new slug
            service.slug = slug;
            await service.save();

            console.log(`Updated service "${service.name}" with slug: ${slug}`);
        }

        console.log('Slug generation completed!');

        // Close the connection
        await mongoose.connection.close();
    } catch (error) {
        console.error('Error generating slugs:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    generateSlugsForExistingServices();
}

module.exports = generateSlugsForExistingServices;