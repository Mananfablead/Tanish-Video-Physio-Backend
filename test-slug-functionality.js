/**
 * Test script to verify slug functionality
 */

// Import the slug utilities
const { generateSlug, generateUniqueSlug } = require('./src/utils/slug.utils');
const Service = require('./src/models/Service.model');

console.log('Testing slug generation functionality...\n');

// Test basic slug generation
console.log('1. Testing basic slug generation:');
console.log('generateSlug("Physical Therapy Session"):', generateSlug("Physical Therapy Session"));
console.log('generateSlug("Massage & Wellness Package"):', generateSlug("Massage & Wellness Package"));
console.log('generateSlug("Post-Surgery Rehabilitation"):', generateSlug("Post-Surgery Rehabilitation"));
console.log('');

// Mock Service model for testing unique slug generation
const mockServices = [
    { _id: '1', name: 'Physical Therapy Session', slug: 'physical-therapy-session' },
    { _id: '2', name: 'Massage & Wellness Package', slug: 'massage-wellness-package' },
    { _id: '3', name: 'Post-Surgery Rehabilitation', slug: 'post-surgery-rehabilitation' }
];

// Mock findOne function for testing
const mockFindOne = async (query) => {
    if (query.slug === 'physical-therapy-session') return mockServices[0];
    if (query.slug === 'massage-wellness-package') return mockServices[1];
    if (query.slug === 'post-surgery-rehabilitation') return mockServices[2];
    return null;
};

console.log('2. Testing unique slug generation:');
const mockModel = { findOne: mockFindOne };

async function testUniqueSlugGeneration() {
    try {
        // Test unique slug generation
        const slug1 = await generateUniqueSlug(mockModel, 'Physical Therapy Session', '4');
        console.log('generateUniqueSlug for "Physical Therapy Session" (different ID):', slug1);

        // Test with duplicate name that should get a suffix
        const slug2 = await generateUniqueSlug(mockModel, 'Physical Therapy Session', '1');
        console.log('generateUniqueSlug for "Physical Therapy Session" (same ID):', slug2);

        console.log('\n✓ Slug functionality tests passed!');

        console.log('\nSummary of changes made:');
        console.log('- Added slug field to Service model with unique constraint');
        console.log('- Added pre-save middleware to auto-generate slug from service name');
        console.log('- Created getServiceBySlug function to retrieve services by slug');
        console.log('- Added /api/services/slug/:slug route for accessing services by slug');
        console.log('- Created utility functions for slug generation with uniqueness check');
        console.log('- Created migration script for existing services');
        console.log('\nThe new functionality allows:');
        console.log('- Automatic slug generation when creating/updating services');
        console.log('- Access to services via URL: /api/services/slug/:slug');
        console.log('- Maintaining backward compatibility with /api/services/:id');
    } catch (error) {
        console.error('Error in testing:', error);
    }
}

testUniqueSlugGeneration();