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
        const servicesWithoutSlugs = await Service.find({ 
            $or: [
                { slug: { $exists: false } },
                { slug: null },
                { slug: "" }
            ]
        });

        console.log(`Found ${servicesWithoutSlugs.length} services without valid slugs`);

        let updatedCount = 0;

        for (const service of servicesWithoutSlugs) {
            try {
                // Add default values for required fields if missing
                if (service.sessions === undefined || service.sessions === null) {
                    service.sessions = 1;
                }
                if (service.validity === undefined || service.validity === null) {
                    service.validity = 30;
                }

                // Generate a unique slug based on the service name
                const slug = await generateUniqueSlug(Service, service.name, service._id);

                // Update the service with the new slug
                service.slug = slug;

                // Save without validation to bypass other required fields
                await service.save({ validateBeforeSave: false });

                console.log(`Updated service "${service.name}" with slug: ${slug}`);
                updatedCount++;
            } catch (serviceError) {
                console.error(`Failed to update service "${service.name}":`, serviceError.message);
            }
        }

        console.log(`Successfully updated ${updatedCount} services with slugs`);
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