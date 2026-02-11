const CmsHero = require('../models/CmsHero.model');
const CmsStep = require('../models/CmsStep.model');
const CmsConditionsSection = require('../models/CmsConditionsSection.model');
const CmsWhyUs = require('../models/CmsWhyUs.model');
const CmsFaq = require('../models/CmsFaq.model');
const CmsTerms = require('../models/CmsTerms.model');
const CmsFeaturedTherapist = require('../models/CmsFeaturedTherapist.model');
const CmsContact = require('../models/CmsContact.model');
const CmsAbout = require('../models/CmsAbout.model');
const config = require('../config/env');

// Hero Section
exports.getHeroPublic = async (req, res) => {
    try {
        const hero = await CmsHero.findOne({ isPublic: true }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: hero || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching hero section',
            error: error.message
        });
    }
};

exports.getHeroAdmin = async (req, res) => {
    try {
        const hero = await CmsHero.findOne().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: hero || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching hero section',
            error: error.message
        });
    }
};

exports.updateHero = async (req, res) => {
    try {
        // Clean up the request body to remove any problematic id fields
        const heroData = { ...req.body };
        delete heroData._id;
        delete heroData.id;
        
        // If there's an uploaded file, update the image field with the full URL
        if (req.file) {
            heroData.image = `${config.BASE_URL}/uploads/cms-images/${req.file.filename}`;
        }
        
        // Check if hero exists
        let hero = await CmsHero.findOne().sort({ createdAt: -1 });

        if (hero) {
            // Update existing hero
            Object.assign(hero, heroData);
            await hero.save();
        } else {
            // Create new hero
            hero = new CmsHero(heroData);
            await hero.save();
        }

        res.json({
            success: true,
            message: 'Hero section updated successfully',
            data: hero
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating hero section',
            error: error.message
        });
    }
};

// Steps Section
exports.getStepsPublic = async (req, res) => {
    try {
        const steps = await CmsStep.find({ isPublic: true }).sort({ createdAt: 1 });
        res.json({
            success: true,
            data: steps
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching steps',
            error: error.message
        });
    }
};

exports.getStepsAdmin = async (req, res) => {
    try {
        const steps = await CmsStep.find().sort({ createdAt: 1 });
        res.json({
            success: true,
            data: steps
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching steps',
            error: error.message
        });
    }
};

exports.createStep = async (req, res) => {
  try {
    let { heading, subHeading } = req.body;

    // 🔁 If heading/subHeading present → replace in ALL steps
    if (heading || subHeading) {
      const updateFields = {};
      if (heading) updateFields.heading = heading;
      if (subHeading) updateFields.subHeading = subHeading;

      await CmsStep.updateMany({}, { $set: updateFields });
    }

    // MULTIPLE STEPS
    if (Array.isArray(req.body)) {
      const createdSteps = [];

      for (const stepData of req.body) {
        const cleanedStepData = { ...stepData };
        delete cleanedStepData._id;
        delete cleanedStepData.id;

        const step = new CmsStep(cleanedStepData);
        await step.save();
        createdSteps.push(step);
      }

      return res.status(201).json({
        success: true,
        message: `${createdSteps.length} step(s) created successfully`,
        data: createdSteps
      });
    }

    // SINGLE STEP
    const stepData = { ...req.body };
    delete stepData._id;
    delete stepData.id;

    if (req.file) {
      stepData.image = `${config.BASE_URL}/uploads/cms-images/${req.file.filename}`;
    }

    const step = new CmsStep(stepData);
    await step.save();

    res.status(201).json({
      success: true,
      message: 'Step created successfully',
      data: step
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating step',
      error: error.message
    });
  }
};


exports.updateStep = async (req, res) => {
    try {
        const { id } = req.params;
        // Clean up the request body to remove any problematic id fields
        const stepData = { ...req.body };
        delete stepData._id;
        delete stepData.id;
        
        // If there's an uploaded file, update the image field with the full URL
        if (req.file) {
            stepData.image = `${config.BASE_URL}/uploads/cms-images/${req.file.filename}`;
        }
        
        const step = await CmsStep.findByIdAndUpdate(id, stepData, { new: true });

        if (!step) {
            return res.status(404).json({
                success: false,
                message: 'Step not found'
            });
        }

        res.json({
            success: true,
            message: 'Step updated successfully',
            data: step
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating step',
            error: error.message
        });
    }
};

exports.deleteStep = async (req, res) => {
    try {
        const { id } = req.params;
        const step = await CmsStep.findByIdAndDelete(id);

        if (!step) {
            return res.status(404).json({
                success: false,
                message: 'Step not found'
            });
        }

        res.json({
            success: true,
            message: 'Step deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting step',
            error: error.message
        });
    }
};

// Conditions Section
exports.getConditionsPublic = async (req, res) => {
    try {
        const conditions = await CmsConditionsSection.findOne({ isPublic: true }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: conditions || { conditions: [] }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching conditions section',
            error: error.message
        });
    }
};

exports.getConditionsAdmin = async (req, res) => {
    try {
        const conditions = await CmsConditionsSection.findOne().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: conditions || { conditions: [] }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching conditions section',
            error: error.message
        });
    }
};

exports.updateConditions = async (req, res) => {
    try {
        // DEBUG: Log incoming data
        console.log('=== CONDITIONS UPDATE DEBUG ===');
        console.log('Raw body:', req.body);
        console.log('Body keys:', Object.keys(req.body));
        console.log('Files keys:', req.files ? Object.keys(req.files) : 'No files');
        console.log('Conditions data from body:', req.body.conditions);
        console.log('Conditions type:', typeof req.body.conditions);
        
        if (req.files) {
            Object.keys(req.files).forEach(key => {
                console.log(`File ${key}:`, req.files[key][0]?.filename);
            });
        }
        
        // Clean up the request body to remove any problematic id fields
        const conditionsData = { ...req.body };
        delete conditionsData._id;
        delete conditionsData.id;
        
        // Handle conditions data - works with indexed fields, JSON string, or array
        let conditionsArray = [];

        // Check if we have indexed condition fields (both bracket and dot notation)
        const conditionFields = {};
        Object.keys(req.body).forEach(key => {
            // Match both conditions[0][title] and conditions[0].title formats
            let match = key.match(/^conditions\[(\d+)\]\[(title|content|image)\]$/); // conditions[0][title] format
            if (!match) {
                match = key.match(/^conditions\[(\d+)\]\.(title|content|image)$/); // conditions[0].title format
            }
            if (match) {
                const index = parseInt(match[1]);
                const field = match[2];
                if (!conditionFields[index]) {
                    conditionFields[index] = {};
                }
                conditionFields[index][field] = req.body[key];
            }
        });

        // Convert indexed fields to array
        if (Object.keys(conditionFields).length > 0) {
            // Sort by index and convert to array
            conditionsArray = Object.keys(conditionFields)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .map(index => conditionFields[index]);
            console.log('Built conditions from indexed fields:', conditionsArray);
        } else if (req.body.conditions) {
            // Handle JSON string or array
            if (typeof req.body.conditions === 'string') {
                try {
                    conditionsArray = JSON.parse(req.body.conditions);
                } catch (e) {
                    console.log('Failed to parse conditions JSON string:', e.message);
                }
            } else if (Array.isArray(req.body.conditions)) {
                conditionsArray = req.body.conditions;
            }
        }

        console.log('Final conditions array:', conditionsArray);

        // Update conditions data with processed array
        conditionsData.conditions = conditionsArray;

        // Handle file uploads for images
        if (req.files) {
            // Process main image
            if (req.files['image'] && req.files['image'].length > 0) {
                conditionsData.image = `${config.BASE_URL}/uploads/cms-condition-images/${req.files['image'][0].filename}`;
            }
            
            // Process condition images - enhanced debugging
            console.log('=== FILE UPLOAD DEBUG ===');
            console.log('All received files:', req.files);
            console.log('File field names:', Object.keys(req.files));

            if (conditionsArray.length > 0) {
                Object.keys(req.files).forEach(fieldKey => {
                    console.log(`Processing file field: ${fieldKey}`);
                    const uploadedFile = Array.isArray(req.files[fieldKey]) ? req.files[fieldKey][0] : req.files[fieldKey];
                    
                    if (uploadedFile && uploadedFile.filename) {
                        console.log(`File details:`, {
                            field: fieldKey,
                            filename: uploadedFile.filename,
                            mimetype: uploadedFile.mimetype,
                            size: uploadedFile.size
                        });

                        let conditionIndex = null;
                        
                        // Enhanced pattern matching for condition images
                        // Try multiple patterns to catch different field name formats
                        const patterns = [
                            /^conditions\[(\d+)\]\[image\]$/,  // conditions[0][image] - bracket notation
                            /^conditions\[(\d+)\]\.image$/,  // conditions[0].image - dot notation
                            /^conditions\.(\d+)\.image$/,    // conditions.0.image  
                            /^(\d+)$/,                       // Just the index number
                            /^conditions\[(\d+)\]$/          // conditions[0] (if image is separate)
                        ];
                        
                        for (const pattern of patterns) {
                            const match = fieldKey.match(pattern);
                            if (match) {
                                conditionIndex = parseInt(match[1] || match[0]);
                                console.log(`Matched pattern ${pattern} with index: ${conditionIndex}`);
                                break;
                            }
                        }
                                                
                        // Alternative pattern matching for bracket notation
                        if (conditionIndex === null) {
                            // Try matching conditions[0] or conditions[0][any_field] formats
                            const bracketPattern = /^conditions\[(\d+)\](?:\[.+\])?$/;
                            const bracketMatch = fieldKey.match(bracketPattern);
                            if (bracketMatch) {
                                conditionIndex = parseInt(bracketMatch[1]);
                                console.log(`Matched bracket pattern ${bracketPattern} with index: ${conditionIndex}`);
                            }
                        }
                                                
                        if (conditionIndex !== null && conditionIndex < conditionsArray.length) {
                            const imageUrl = `${config.BASE_URL}/uploads/cms-condition-images/${uploadedFile.filename}`;
                            console.log(`Setting image for condition ${conditionIndex}: ${imageUrl}`);
                            conditionsArray[conditionIndex].image = imageUrl;
                                                    
                            // Also update the conditionsData to ensure it's preserved
                            if (conditionsData.conditions && conditionsData.conditions[conditionIndex]) {
                                conditionsData.conditions[conditionIndex].image = imageUrl;
                            }
                        } else {
                            console.log(`Could not match field ${fieldKey} to condition index. Array length: ${conditionsArray.length}`);
                        }
                    } else {
                        console.log(`No valid file found for field ${fieldKey}`);
                    }
                });
            }
            console.log('=== END FILE UPLOAD DEBUG ===');
        }
        
        // First, get the existing conditions from database to preserve existing image URLs
        const existingConditionsDoc = await CmsConditionsSection.findOne().sort({ createdAt: -1 });
        const existingConditions = existingConditionsDoc?.conditions || [];
        
        // Process conditions array to properly handle image updates
        if (conditionsArray && Array.isArray(conditionsArray)) {
            // Create a copy of conditionsArray with image URLs preserved
            const processedConditions = conditionsArray.map((condition, index) => {
                // Check if this condition already has an image URL from file upload
                const hasUploadedImage = condition.image && typeof condition.image === 'string' && condition.image.startsWith('http');
                
                if (hasUploadedImage) {
                    // Keep the uploaded image URL
                    return condition;
                } else {
                    // No new image uploaded, preserve existing image URL from database
                    if (existingConditions[index] && existingConditions[index].image && typeof existingConditions[index].image === 'string') {
                        return {
                            ...condition,
                            image: existingConditions[index].image
                        };
                    } else {
                        // Handle cleanup for problematic data in the new condition
                        return {
                            ...condition,
                            image: (condition.image && typeof condition.image === 'object') ? null : condition.image
                        };
                    }
                }
            });

            conditionsData.conditions = processedConditions;
        }
        
        let conditions = await CmsConditionsSection.findOne().sort({ createdAt: -1 });

        if (conditions) {
            console.log('Updating existing conditions with data:', conditionsData);
            Object.assign(conditions, conditionsData);
            await conditions.save();
            console.log('Saved conditions:', conditions.conditions);
        } else {
            console.log('Creating new conditions with data:', conditionsData);
            conditions = new CmsConditionsSection(conditionsData);
            await conditions.save();
            console.log('Created conditions:', conditions.conditions);
        }

        res.json({
            success: true,
            message: 'Conditions section updated successfully',
            data: conditions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating conditions section',
            error: error.message
        });
    }
};

// Create new conditions section
exports.createConditions = async (req, res) => {
    try {
        // DEBUG: Log incoming data
        console.log('=== CONDITIONS CREATE DEBUG ===');
        console.log('Raw body:', req.body);
        console.log('Body keys:', Object.keys(req.body));
        console.log('Files keys:', req.files ? Object.keys(req.files) : 'No files');
        console.log('Conditions data from body:', req.body.conditions);
        console.log('Conditions type:', typeof req.body.conditions);
        
        if (req.files) {
            Object.keys(req.files).forEach(key => {
                console.log(`File ${key}:`, req.files[key][0]?.filename);
            });
        }
        
        // Clean up the request body to remove any problematic id fields
        const conditionsData = { ...req.body };
        delete conditionsData._id;
        delete conditionsData.id;
        
        // Handle conditions data - works with indexed fields, JSON string, or array
        let conditionsArray = [];

        // Check if we have indexed condition fields (both bracket and dot notation)
        const conditionFields = {};
        Object.keys(req.body).forEach(key => {
            // Match both conditions[0][title] and conditions[0].title formats
            let match = key.match(/^conditions\[(\d+)\]\[(title|content|image)\]$/); // conditions[0][title] format
            if (!match) {
                match = key.match(/^conditions\[(\d+)\]\.(title|content|image)$/); // conditions[0].title format
            }
            if (match) {
                const index = parseInt(match[1]);
                const field = match[2];
                if (!conditionFields[index]) {
                    conditionFields[index] = {};
                }
                conditionFields[index][field] = req.body[key];
            }
        });

        // Convert indexed fields to array
        if (Object.keys(conditionFields).length > 0) {
            // Sort by index and convert to array
            conditionsArray = Object.keys(conditionFields)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .map(index => conditionFields[index]);
            console.log('Built conditions from indexed fields:', conditionsArray);
        } else if (req.body.conditions) {
            // Handle JSON string or array
            if (typeof req.body.conditions === 'string') {
                try {
                    conditionsArray = JSON.parse(req.body.conditions);
                } catch (e) {
                    console.log('Failed to parse conditions JSON string:', e.message);
                }
            } else if (Array.isArray(req.body.conditions)) {
                conditionsArray = req.body.conditions;
            }
        }

        console.log('Final conditions array:', conditionsArray);

        // Update conditions data with processed array
        conditionsData.conditions = conditionsArray;

        // Handle file uploads for images
        if (req.files) {
            // Process main image
            if (req.files['image'] && req.files['image'].length > 0) {
                conditionsData.image = `${config.BASE_URL}/uploads/cms-condition-images/${req.files['image'][0].filename}`;
            }
            
            // Process condition images - enhanced debugging
            console.log('=== FILE UPLOAD DEBUG ===');
            console.log('All received files:', req.files);
            console.log('File field names:', Object.keys(req.files));

            if (conditionsArray.length > 0) {
                Object.keys(req.files).forEach(fieldKey => {
                    console.log(`Processing file field: ${fieldKey}`);
                    const uploadedFile = Array.isArray(req.files[fieldKey]) ? req.files[fieldKey][0] : req.files[fieldKey];
                    
                    if (uploadedFile && uploadedFile.filename) {
                        console.log(`File details:`, {
                            field: fieldKey,
                            filename: uploadedFile.filename,
                            mimetype: uploadedFile.mimetype,
                            size: uploadedFile.size
                        });

                        let conditionIndex = null;
                        
                        // Enhanced pattern matching for condition images
                        // Try multiple patterns to catch different field name formats
                        const patterns = [
                            /^conditions\[(\d+)\]\[image\]$/,  // conditions[0][image] - bracket notation
                            /^conditions\[(\d+)\]\.image$/,  // conditions[0].image - dot notation
                            /^conditions\.(\d+)\.image$/,    // conditions.0.image  
                            /^(\d+)$/,                       // Just the index number
                            /^conditions\[(\d+)\]$/          // conditions[0] (if image is separate)
                        ];
                        
                        for (const pattern of patterns) {
                            const match = fieldKey.match(pattern);
                            if (match) {
                                conditionIndex = parseInt(match[1] || match[0]);
                                console.log(`Matched pattern ${pattern} with index: ${conditionIndex}`);
                                break;
                            }
                        }
                                                
                        // Alternative pattern matching for bracket notation
                        if (conditionIndex === null) {
                            // Try matching conditions[0] or conditions[0][any_field] formats
                            const bracketPattern = /^conditions\[(\d+)\](?:\[.+\])?$/;
                            const bracketMatch = fieldKey.match(bracketPattern);
                            if (bracketMatch) {
                                conditionIndex = parseInt(bracketMatch[1]);
                                console.log(`Matched bracket pattern ${bracketPattern} with index: ${conditionIndex}`);
                            }
                        }
                                                
                        if (conditionIndex !== null && conditionIndex < conditionsArray.length) {
                            const imageUrl = `${config.BASE_URL}/uploads/cms-condition-images/${uploadedFile.filename}`;
                            console.log(`Setting image for condition ${conditionIndex}: ${imageUrl}`);
                            conditionsArray[conditionIndex].image = imageUrl;
                                                    
                            // Also update the conditionsData to ensure it's preserved
                            if (conditionsData.conditions && conditionsData.conditions[conditionIndex]) {
                                conditionsData.conditions[conditionIndex].image = imageUrl;
                            }
                        } else {
                            console.log(`Could not match field ${fieldKey} to condition index. Array length: ${conditionsArray.length}`);
                        }
                    } else {
                        console.log(`No valid file found for field ${fieldKey}`);
                    }
                });
            }
            console.log('=== END FILE UPLOAD DEBUG ===');
        }
        
        // Create new conditions section
        const conditions = new CmsConditionsSection(conditionsData);
        await conditions.save();
        console.log('Created conditions:', conditions.conditions);

        res.json({
            success: true,
            message: 'Conditions section created successfully',
            data: conditions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating conditions section',
            error: error.message
        });
    }
};

// Add a single condition to the conditions array
exports.addSingleCondition = async (req, res) => {
    try {
        // DEBUG: Log incoming data
        console.log('=== ADD SINGLE CONDITION DEBUG ===');
        console.log('Raw body:', req.body);
        console.log('Body keys:', Object.keys(req.body));
        console.log('Files keys:', req.files ? Object.keys(req.files) : 'No files');
        
        // Get the current conditions document
        let conditions = await CmsConditionsSection.findOne().sort({ createdAt: -1 });
        
        if (!conditions) {
            // If no conditions exist, create a new one with default values
            conditions = new CmsConditionsSection({
                title: 'Conditions We Treat',
                description: 'Common conditions we treat',
                conditions: [],
                isPublic: true
            });
        }
        
        // Prepare the new condition
        const newCondition = {
            title: req.body.title || req.body.name || '',
            content: req.body.content || '',
            image: null
        };
        
        // Handle image upload if present
        if (req.files && req.files.length > 0) {
            const imageFile = req.files.find(file => file.fieldname === 'image' || file.originalname);
            if (imageFile) {
                newCondition.image = `${config.BASE_URL}/uploads/cms-condition-images/${imageFile.filename}`;
            }
        }
        
        // Validate required fields
        if (!newCondition.title.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Condition title is required'
            });
        }
        
        // Add the new condition to the array
        conditions.conditions.push(newCondition);
        
        // Save the updated conditions
        await conditions.save();
        
        res.json({
            success: true,
            message: 'Condition added successfully',
            data: conditions
        });
    } catch (error) {
        console.error('Error adding single condition:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding condition',
            error: error.message
        });
    }
};

// Update a single condition in the conditions array by index
exports.updateSingleCondition = async (req, res) => {
    try {
        const { index } = req.params;
        const conditionIndex = parseInt(index);
        
        // DEBUG: Log incoming data
        console.log('=== UPDATE SINGLE CONDITION DEBUG ===');
        console.log('Index:', index);
        console.log('Raw body:', req.body);
        console.log('Body keys:', Object.keys(req.body));
        console.log('Files keys:', req.files ? Object.keys(req.files) : 'No files');
        
        // Get the current conditions document
        let conditions = await CmsConditionsSection.findOne().sort({ createdAt: -1 });
        
        if (!conditions) {
            return res.status(404).json({
                success: false,
                message: 'Conditions section not found'
            });
        }
        
        // Check if index is valid
        if (conditionIndex < 0 || conditionIndex >= conditions.conditions.length) {
            return res.status(404).json({
                success: false,
                message: 'Condition not found at the specified index'
            });
        }
        
        // Update the condition at the specified index
        const updatedCondition = {
            title: req.body.title || req.body.name || conditions.conditions[conditionIndex].title,
            content: req.body.content || conditions.conditions[conditionIndex].content,
            image: conditions.conditions[conditionIndex].image // Preserve existing image initially
        };
        
        // Handle image upload if present
        if (req.files && req.files.length > 0) {
            const imageFile = req.files.find(file => file.fieldname === 'image' || file.originalname);
            if (imageFile) {
                updatedCondition.image = `${config.BASE_URL}/uploads/cms-condition-images/${imageFile.filename}`;
            }
        }
        
        // Validate required fields
        if (!updatedCondition.title.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Condition title is required'
            });
        }
        
        // Update the condition in the array
        conditions.conditions[conditionIndex] = updatedCondition;
        
        // Save the updated conditions
        await conditions.save();
        
        res.json({
            success: true,
            message: 'Condition updated successfully',
            data: conditions
        });
    } catch (error) {
        console.error('Error updating single condition:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating condition',
            error: error.message
        });
    }
};

// Delete a single condition from the conditions array by index
exports.deleteSingleCondition = async (req, res) => {
    try {
        const { index } = req.params;
        const conditionIndex = parseInt(index);
        
        // DEBUG: Log incoming data
        console.log('=== DELETE SINGLE CONDITION DEBUG ===');
        console.log('Index:', index);
        
        // Get the current conditions document
        let conditions = await CmsConditionsSection.findOne().sort({ createdAt: -1 });
        
        if (!conditions) {
            return res.status(404).json({
                success: false,
                message: 'Conditions section not found'
            });
        }
        
        // Check if index is valid
        if (conditionIndex < 0 || conditionIndex >= conditions.conditions.length) {
            return res.status(404).json({
                success: false,
                message: 'Condition not found at the specified index'
            });
        }
        
        // Remove the condition at the specified index
        conditions.conditions.splice(conditionIndex, 1);
        
        // Save the updated conditions
        await conditions.save();
        
        res.json({
            success: true,
            message: 'Condition deleted successfully',
            data: conditions
        });
    } catch (error) {
        console.error('Error deleting single condition:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting condition',
            error: error.message
        });
    }
};

// Update existing conditions section
exports.updateConditionsById = async (req, res) => {
    try {
        const { id } = req.params;
        
        // DEBUG: Log incoming data
        console.log('=== CONDITIONS UPDATE BY ID DEBUG ===');
        console.log('ID:', id);
        console.log('Raw body:', req.body);
        console.log('Body keys:', Object.keys(req.body));
        console.log('Files keys:', req.files ? Object.keys(req.files) : 'No files');
        console.log('Conditions data from body:', req.body.conditions);
        console.log('Conditions type:', typeof req.body.conditions);
        
        if (req.files) {
            Object.keys(req.files).forEach(key => {
                console.log(`File ${key}:`, req.files[key][0]?.filename);
            });
        }
        
        // Clean up the request body to remove any problematic id fields
        const conditionsData = { ...req.body };
        delete conditionsData._id;
        delete conditionsData.id;
        
        // Handle conditions data - works with indexed fields, JSON string, or array
        let conditionsArray = [];

        // Check if we have indexed condition fields (both bracket and dot notation)
        const conditionFields = {};
        Object.keys(req.body).forEach(key => {
            // Match both conditions[0][title] and conditions[0].title formats
            let match = key.match(/^conditions\[(\d+)\]\[(title|content|image)\]$/); // conditions[0][title] format
            if (!match) {
                match = key.match(/^conditions\[(\d+)\]\.(title|content|image)$/); // conditions[0].title format
            }
            if (match) {
                const index = parseInt(match[1]);
                const field = match[2];
                if (!conditionFields[index]) {
                    conditionFields[index] = {};
                }
                conditionFields[index][field] = req.body[key];
            }
        });

        // Convert indexed fields to array
        if (Object.keys(conditionFields).length > 0) {
            // Sort by index and convert to array
            conditionsArray = Object.keys(conditionFields)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .map(index => conditionFields[index]);
            console.log('Built conditions from indexed fields:', conditionsArray);
        } else if (req.body.conditions) {
            // Handle JSON string or array
            if (typeof req.body.conditions === 'string') {
                try {
                    conditionsArray = JSON.parse(req.body.conditions);
                } catch (e) {
                    console.log('Failed to parse conditions JSON string:', e.message);
                }
            } else if (Array.isArray(req.body.conditions)) {
                conditionsArray = req.body.conditions;
            }
        }

        console.log('Final conditions array:', conditionsArray);

        // Update conditions data with processed array
        conditionsData.conditions = conditionsArray;

        // Handle file uploads for images
        if (req.files) {
            // Process main image
            if (req.files['image'] && req.files['image'].length > 0) {
                conditionsData.image = `${config.BASE_URL}/uploads/cms-condition-images/${req.files['image'][0].filename}`;
            }
            
            // Process condition images - enhanced debugging
            console.log('=== FILE UPLOAD DEBUG ===');
            console.log('All received files:', req.files);
            console.log('File field names:', Object.keys(req.files));

            if (conditionsArray.length > 0) {
                Object.keys(req.files).forEach(fieldKey => {
                    console.log(`Processing file field: ${fieldKey}`);
                    const uploadedFile = Array.isArray(req.files[fieldKey]) ? req.files[fieldKey][0] : req.files[fieldKey];
                    
                    if (uploadedFile && uploadedFile.filename) {
                        console.log(`File details:`, {
                            field: fieldKey,
                            filename: uploadedFile.filename,
                            mimetype: uploadedFile.mimetype,
                            size: uploadedFile.size
                        });

                        let conditionIndex = null;
                        
                        // Enhanced pattern matching for condition images
                        // Try multiple patterns to catch different field name formats
                        const patterns = [
                            /^conditions\[(\d+)\]\[image\]$/,  // conditions[0][image] - bracket notation
                            /^conditions\[(\d+)\]\.image$/,  // conditions[0].image - dot notation
                            /^conditions\.(\d+)\.image$/,    // conditions.0.image  
                            /^(\d+)$/,                       // Just the index number
                            /^conditions\[(\d+)\]$/          // conditions[0] (if image is separate)
                        ];
                        
                        for (const pattern of patterns) {
                            const match = fieldKey.match(pattern);
                            if (match) {
                                conditionIndex = parseInt(match[1] || match[0]);
                                console.log(`Matched pattern ${pattern} with index: ${conditionIndex}`);
                                break;
                            }
                        }
                        
                        // Alternative pattern matching for bracket notation
                        if (conditionIndex === null) {
                            // Try matching conditions[0] or conditions[0][any_field] formats
                            const bracketPattern = /^conditions\[(\d+)\](?:\[.+\])?$/;
                            const bracketMatch = fieldKey.match(bracketPattern);
                            if (bracketMatch) {
                                conditionIndex = parseInt(bracketMatch[1]);
                                console.log(`Matched bracket pattern ${bracketPattern} with index: ${conditionIndex}`);
                            }
                        }
                        
                        if (conditionIndex !== null && conditionIndex < conditionsArray.length) {
                            const imageUrl = `${config.BASE_URL}/uploads/cms-condition-images/${uploadedFile.filename}`;
                            console.log(`Setting image for condition ${conditionIndex}: ${imageUrl}`);
                            conditionsArray[conditionIndex].image = imageUrl;
                            
                            // Also update the conditionsData to ensure it's preserved
                            if (conditionsData.conditions && conditionsData.conditions[conditionIndex]) {
                                conditionsData.conditions[conditionIndex].image = imageUrl;
                            }
                        } else {
                            console.log(`Could not match field ${fieldKey} to condition index. Array length: ${conditionsArray.length}`);
                        }
                    } else {
                        console.log(`No valid file found for field ${fieldKey}`);
                    }
                });
            }
            console.log('=== END FILE UPLOAD DEBUG ===');
        }
        
        // First, get the existing conditions from database to preserve existing image URLs
        const existingConditionsDoc = await CmsConditionsSection.findById(id);
        if (!existingConditionsDoc) {
            return res.status(404).json({
                success: false,
                message: 'Conditions section not found'
            });
        }
        
        const existingConditions = existingConditionsDoc?.conditions || [];
        
        // Process conditions array to properly handle image updates
        if (conditionsArray && Array.isArray(conditionsArray)) {
            // Create a copy of conditionsArray with image URLs preserved
            const processedConditions = conditionsArray.map((condition, index) => {
                // Check if this condition already has an image URL from file upload
                const hasUploadedImage = condition.image && typeof condition.image === 'string' && condition.image.startsWith('http');
                
                if (hasUploadedImage) {
                    // Keep the uploaded image URL
                    return condition;
                } else {
                    // No new image uploaded, preserve existing image URL from database
                    if (existingConditions[index] && existingConditions[index].image && typeof existingConditions[index].image === 'string') {
                        return {
                            ...condition,
                            image: existingConditions[index].image
                        };
                    } else {
                        // Handle cleanup for problematic data in the new condition
                        return {
                            ...condition,
                            image: (condition.image && typeof condition.image === 'object') ? null : condition.image
                        };
                    }
                }
            });

            conditionsData.conditions = processedConditions;
        }
        
        // Update the conditions section by ID
        const conditions = await CmsConditionsSection.findByIdAndUpdate(
            id,
            conditionsData,
            { new: true, runValidators: true }
        );

        if (!conditions) {
            return res.status(404).json({
                success: false,
                message: 'Conditions section not found'
            });
        }

        res.json({
            success: true,
            message: 'Conditions section updated successfully',
            data: conditions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating conditions section',
            error: error.message
        });
    }
};

// Why Us Section
exports.getWhyUsPublic = async (req, res) => {
    try {
        const whyUs = await CmsWhyUs.findOne({ isPublic: true }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: whyUs || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching why us section',
            error: error.message
        });
    }
};

exports.getWhyUsAdmin = async (req, res) => {
    try {
        const whyUs = await CmsWhyUs.findOne().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: whyUs || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching why us section',
            error: error.message
        });
    }
};

exports.updateWhyUs = async (req, res) => {
    try {
        // Clean up the request body to remove any problematic id fields
        const whyUsData = { ...req.body };
        delete whyUsData._id;
        delete whyUsData.id;
        
        let whyUs = await CmsWhyUs.findOne().sort({ createdAt: -1 });

        if (whyUs) {
            Object.assign(whyUs, whyUsData);
            await whyUs.save();
        } else {
            whyUs = new CmsWhyUs(whyUsData);
            await whyUs.save();
        }

        res.json({
            success: true,
            message: 'Why us section updated successfully',
            data: whyUs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating why us section',
            error: error.message
        });
    }
};

// FAQ Section
exports.getFaqsPublic = async (req, res) => {
    try {
        const faqs = await CmsFaq.find({ isPublic: true }).sort({ createdAt: 1 });
        res.json({
            success: true,
            data: faqs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching FAQs',
            error: error.message
        });
    }
};

exports.getFaqsAdmin = async (req, res) => {
    try {
        const faqs = await CmsFaq.find().sort({ createdAt: 1 });
        res.json({
            success: true,
            data: faqs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching FAQs',
            error: error.message
        });
    }
};

exports.createFaq = async (req, res) => {
    try {
        // Clean up the request body to remove any problematic id fields
        const faqData = { ...req.body };
        delete faqData._id;
        delete faqData.id;
        
        const faq = new CmsFaq(faqData);
        await faq.save();
        res.status(201).json({
            success: true,
            message: 'FAQ created successfully',
            data: faq
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating FAQ',
            error: error.message
        });
    }
};

exports.updateFaq = async (req, res) => {
    try {
        const { id } = req.params;
        // Clean up the request body to remove any problematic id fields
        const faqData = { ...req.body };
        delete faqData._id;
        delete faqData.id;
        
        const faq = await CmsFaq.findByIdAndUpdate(id, faqData, { new: true });

        if (!faq) {
            return res.status(404).json({
                success: false,
                message: 'FAQ not found'
            });
        }

        res.json({
            success: true,
            message: 'FAQ updated successfully',
            data: faq
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating FAQ',
            error: error.message
        });
    }
};

exports.deleteFaq = async (req, res) => {
    try {
        const { id } = req.params;
        const faq = await CmsFaq.findByIdAndDelete(id);

        if (!faq) {
            return res.status(404).json({
                success: false,
                message: 'FAQ not found'
            });
        }

        res.json({
            success: true,
            message: 'FAQ deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting FAQ',
            error: error.message
        });
    }
};

// Terms Section
exports.getTermsPublic = async (req, res) => {
    try {
        const terms = await CmsTerms.findOne({ isPublic: true }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: terms || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching terms section',
            error: error.message
        });
    }
};

exports.getTermsAdmin = async (req, res) => {
    try {
        const terms = await CmsTerms.findOne().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: terms || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching terms section',
            error: error.message
        });
    }
};

exports.updateTerms = async (req, res) => {
    try {
        // Clean up the request body to remove any problematic id fields
        const termsData = { ...req.body };
        delete termsData._id;
        delete termsData.id;
        
        let terms = await CmsTerms.findOne().sort({ createdAt: -1 });

        if (terms) {
            Object.assign(terms, termsData);
            await terms.save();
        } else {
            terms = new CmsTerms(termsData);
            await terms.save();
        }

        res.json({
            success: true,
            message: 'Terms section updated successfully',
            data: terms
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating terms section',
            error: error.message
        });
    }
};

// Featured Therapist Section
exports.getFeaturedTherapistPublic = async (req, res) => {
    try {
        const therapist = await CmsFeaturedTherapist.findOne({ isPublic: true }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: therapist || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching featured therapist',
            error: error.message
        });
    }
};

exports.getFeaturedTherapistAdmin = async (req, res) => {
    try {
        const therapist = await CmsFeaturedTherapist.findOne().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: therapist || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching featured therapist',
            error: error.message
        });
    }
};

exports.updateFeaturedTherapist = async (req, res) => {
    try {
        // Clean up the request body to remove any problematic id fields
        const therapistData = { ...req.body };
        delete therapistData._id;
        delete therapistData.id;
        
        // If there's an uploaded file, update the image field with the full URL
        if (req.file) {
            therapistData.image = `${config.BASE_URL}/uploads/cms-images/${req.file.filename}`;
        }
        
        let therapist = await CmsFeaturedTherapist.findOne().sort({ createdAt: -1 });

        if (therapist) {
            Object.assign(therapist, therapistData);
            await therapist.save();
        } else {
            therapist = new CmsFeaturedTherapist(therapistData);
            await therapist.save();
        }

        res.json({
            success: true,
            message: 'Featured therapist updated successfully',
            data: therapist
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating featured therapist',
            error: error.message
        });
    }
};

// Contact Section
exports.getContactPublic = async (req, res) => {
    try {
        const contact = await CmsContact.findOne({ isPublic: true }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: contact || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching contact section',
            error: error.message
        });
    }
};

exports.getContactAdmin = async (req, res) => {
    try {
        const contact = await CmsContact.findOne().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: contact || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching contact section',
            error: error.message
        });
    }
};

exports.updateContact = async (req, res) => {
    try {
        // Clean up the request body to remove any problematic id fields
        const contactData = { ...req.body };
        delete contactData._id;
        delete contactData.id;
        
        let contact = await CmsContact.findOne().sort({ createdAt: -1 });

        if (contact) {
            Object.assign(contact, contactData);
            await contact.save();
        } else {
            contact = new CmsContact(contactData);
            await contact.save();
        }

        res.json({
            success: true,
            message: 'Contact section updated successfully',
            data: contact
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating contact section',
            error: error.message
        });
    }
};

// About Section
exports.getAboutPublic = async (req, res) => {
    try {
        const about = await CmsAbout.findOne({ isPublic: true }).sort({ createdAt: -1 });
        res.json({
            success: true,
            data: about || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching about section',
            error: error.message
        });
    }
};

exports.getAboutAdmin = async (req, res) => {
    try {
        const about = await CmsAbout.findOne().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: about || {}
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching about section',
            error: error.message
        });
    }
};

exports.updateAbout = async (req, res) => {
    try {
        // Clean up the request body to remove any problematic id fields
        const aboutData = { ...req.body };
        delete aboutData._id;
        delete aboutData.id;
        
        // Parse values if it's a JSON string
        if (aboutData.values && typeof aboutData.values === 'string') {
            try {
                const parsedValues = JSON.parse(aboutData.values);
                if (Array.isArray(parsedValues)) {
                    aboutData.values = parsedValues;
                }
            } catch (e) {
                // If parsing fails, keep the original value
                console.log('Failed to parse values, keeping original:', e.message);
            }
        }
        
        // Handle multiple image uploads
        if (req.files && req.files.length > 0) {
            // Get the current about section to preserve existing images
            const currentAbout = await CmsAbout.findOne().sort({ createdAt: -1 });
            
            // Initialize images array with existing images
            const images = [...(currentAbout?.images || [])];
            
            // Add new uploaded images
            req.files.forEach(file => {
                images.push(`${config.BASE_URL}/uploads/cms-images/${file.filename}`);
            });
            
            aboutData.images = images;
            
            // Also update the legacy single image field for backward compatibility
            if (images.length > 0) {
                aboutData.image = images[0];
            }
        }
        
        let about = await CmsAbout.findOne().sort({ createdAt: -1 });

        if (about) {
            Object.assign(about, aboutData);
            await about.save();
        } else {
            about = new CmsAbout(aboutData);
            await about.save();
        }

        res.json({
            success: true,
            message: 'About section updated successfully',
            data: about
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating about section',
            error: error.message
        });
    }
};

// Get all CMS data (for admin dashboard)
exports.getAllCmsData = async (req, res) => {
    try {
        const [
            hero,
            steps,
            conditions,
            whyUs,
            faqs,
            terms,
            featuredTherapist,
            contact,
            about
        ] = await Promise.all([
            CmsHero.findOne().sort({ createdAt: -1 }),
            CmsStep.find().sort({ createdAt: 1 }),
            CmsConditionsSection.findOne().sort({ createdAt: -1 }),
            CmsWhyUs.findOne().sort({ createdAt: -1 }),
            CmsFaq.find().sort({ createdAt: 1 }),
            CmsTerms.findOne().sort({ createdAt: -1 }),
            CmsFeaturedTherapist.findOne().sort({ createdAt: -1 }),
            CmsContact.findOne().sort({ createdAt: -1 }),
            CmsAbout.findOne().sort({ createdAt: -1 })
        ]);

        res.json({
            success: true,
            data: {
                hero: hero || {},
                steps: steps || [],
                conditions: conditions || {},
                whyUs: whyUs || {},
                faq: faqs || [],
                terms: terms || {},
                featuredTherapist: featuredTherapist || {},
                contact: contact || {},
                about: about || {}
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching all CMS data',
            error: error.message
        });
    }
};