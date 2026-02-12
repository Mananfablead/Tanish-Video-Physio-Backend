require('dotenv').config();
const mongoose = require('mongoose');
const Service = require('./src/models/Service.model');
const config = require('./src/config/env');

// Helper function to convert relative paths to absolute URLs
const convertToAbsoluteUrls = (service) => {
    if (service.images && Array.isArray(service.images)) {
        service.images = service.images.map(imagePath =>
            imagePath.startsWith('http') ? imagePath : `${config.BASE_URL}${imagePath}`
        );
    }
    if (service.videos && Array.isArray(service.videos)) {
        service.videos = service.videos.map(videoPath =>
            videoPath.startsWith('http') ? videoPath : `${config.BASE_URL}${videoPath}`
        );
    }
    return service;
};

async function testFeaturedServices() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tanish-physio');
        console.log('Connected to database');

        console.log('Testing featured services query...');
        const services = await Service.find({
            status: 'active',
            featured: true
        }).sort({ createdAt: -1 });

        console.log('Found services:', services.length);

        // Convert relative paths to absolute URLs
        const servicesWithAbsoluteUrls = services.map(service => {
            console.log('Processing service:', service._id);
            return convertToAbsoluteUrls(service.toObject());
        });

        console.log('Successfully processed services');
        console.log('Result:', JSON.stringify(servicesWithAbsoluteUrls, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

testFeaturedServices();